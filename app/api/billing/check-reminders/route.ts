import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendBillingReminderEmail } from '@/lib/email';

/**
 * Check for upcoming, due, and overdue rent payments
 * Creates notifications for landlord and tenants
 * Sends email notifications to both parties
 * This should be called when users first visit the app
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Find all rent billings that are not yet fully paid
    const pendingRentBillings = await prisma.billing.findMany({
      where: {
        billingType: 'rent',
        paymentStatus: {
          in: ['pending', 'partial']
        },
        dueDate: {
          not: null
        }
      },
      include: {
        user: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            email: true,
            unitNumber: true,
            propertyId: true
          }
        },
        property: {
          select: {
            propertyId: true,
            name: true
          }
        }
      }
    });

    const notifications: Array<{
      userId: number;
      type: string;
      message: string;
      relatedId: number;
    }> = [];

    const emailsToBeSent: Array<{
      to: string;
      name: string;
      role: 'tenant' | 'landlord';
      billingType: 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
      billingAmount: number;
      dueDate: string;
      daysUntilDue?: number;
      tenantName?: string;
      unitNumber?: string;
    }> = [];

    for (const billing of pendingRentBillings) {
      if (!billing.dueDate) continue;

      const dueDate = new Date(billing.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const tenantName = `${billing.user.firstName || ''} ${billing.user.lastName || ''}`.trim() || 'Tenant';
      const unitNumber = billing.user.unitNumber || billing.unit || 'Unit';
      const amount = billing.totalRent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      let notificationType = '';
      let tenantMessage = '';
      let landlordMessage = '';
      let emailBillingType: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | '' = '';

      if (diffDays < 0) {
        // Overdue
        const daysOverdue = Math.abs(diffDays);
        notificationType = 'payment_overdue';
        emailBillingType = 'overdue';
        tenantMessage = `⚠️ Rent Payment Overdue! Your rent payment of ₱${amount} for ${unitNumber} was due on ${dueDateStr}. It is now ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Please settle your payment as soon as possible to avoid penalties.`;
        landlordMessage = `⚠️ Overdue Payment Alert: ${tenantName} (${unitNumber}) has an overdue rent payment of ₱${amount}. Due date was ${dueDateStr} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago).`;
      } else if (diffDays === 0) {
        // Due today
        notificationType = 'payment_due_today';
        emailBillingType = 'due_today';
        tenantMessage = `📅 Rent Due Today! Your rent payment of ₱${amount} for ${unitNumber} is due today. Please make your payment to avoid late fees.`;
        landlordMessage = `📅 Payment Due Today: ${tenantName} (${unitNumber}) has a rent payment of ₱${amount} due today.`;
      } else if (diffDays <= 3) {
        // Due in 1-3 days
        notificationType = 'payment_due_soon';
        emailBillingType = 'due_soon';
        tenantMessage = `🔔 Rent Payment Reminder: Your rent payment of ₱${amount} for ${unitNumber} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${dueDateStr}). Please prepare your payment.`;
        landlordMessage = `🔔 Upcoming Payment: ${tenantName} (${unitNumber}) has a rent payment of ₱${amount} due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${dueDateStr}).`;
      } else if (diffDays <= 7) {
        // Due in 4-7 days
        notificationType = 'payment_reminder';
        emailBillingType = 'upcoming';
        tenantMessage = `📢 Rent Payment Notice: Your rent payment of ₱${amount} for ${unitNumber} is due on ${dueDateStr} (in ${diffDays} days).`;
        landlordMessage = `📢 Payment Notice: ${tenantName} (${unitNumber}) has a rent payment of ₱${amount} due on ${dueDateStr} (in ${diffDays} days).`;
      }

      // Create notifications if applicable
      if (notificationType && tenantMessage && landlordMessage && emailBillingType) {
        // Check if tenant notification already exists today
        const existingTenantNotif = await prisma.notification.findFirst({
          where: {
            userId: billing.userID,
            type: notificationType,
            relatedId: billing.billingID,
            createdAt: {
              gte: currentDate
            }
          }
        });

        // Add tenant notification and email only if not exists
        if (!existingTenantNotif && billing.user.email) {
          notifications.push({
            userId: billing.userID,
            type: notificationType,
            message: tenantMessage,
            relatedId: billing.billingID
          });

          // Queue email for tenant
          emailsToBeSent.push({
            to: billing.user.email,
            name: tenantName,
            role: 'tenant',
            billingType: emailBillingType,
            billingAmount: billing.totalRent,
            dueDate: dueDateStr,
            daysUntilDue: diffDays > 0 ? diffDays : undefined,
            unitNumber: unitNumber
          });
        }

        // Notification for landlord (get landlord from property)
        const landlords = await prisma.users.findMany({
          where: {
            role: 'landlord',
            propertyId: billing.propertyId
          },
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            email: true
          }
        });

        for (const landlord of landlords) {
          // Check if landlord notification already exists today
          const existingLandlordNotif = await prisma.notification.findFirst({
            where: {
              userId: landlord.userID,
              type: notificationType,
              relatedId: billing.billingID,
              createdAt: {
                gte: currentDate
              }
            }
          });

          // Add landlord notification and email only if not exists
          if (!existingLandlordNotif) {
            notifications.push({
              userId: landlord.userID,
              type: notificationType,
              message: landlordMessage,
              relatedId: billing.billingID
            });

            // Queue email for landlord
            if (landlord.email) {
              const landlordName = `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim() || 'Landlord';
              emailsToBeSent.push({
                to: landlord.email,
                name: landlordName,
                role: 'landlord',
                billingType: emailBillingType,
                billingAmount: billing.totalRent,
                dueDate: dueDateStr,
                daysUntilDue: diffDays > 0 ? diffDays : undefined,
                tenantName: tenantName,
                unitNumber: unitNumber
              });
            }
          }
        }
      }
    }

    // Create notifications individually with final duplicate check
    let createdCount = 0;
    let emailsSentCount = 0;
    let emailsFailedCount = 0;
    
    if (notifications.length > 0) {
      for (let i = 0; i < notifications.length; i++) {
        const notif = notifications[i];
        
        // Final safety check before creating
        const exists = await prisma.notification.findFirst({
          where: {
            userId: notif.userId,
            type: notif.type,
            relatedId: notif.relatedId,
            createdAt: {
              gte: currentDate
            }
          }
        });

        if (!exists) {
          await prisma.notification.create({
            data: notif
          });
          createdCount++;

          // Send corresponding email if notification was created
          if (emailsToBeSent[i]) {
            const emailResult = await sendBillingReminderEmail(emailsToBeSent[i]);
            if (emailResult.success) {
              emailsSentCount++;
            } else {
              emailsFailedCount++;
              console.error(`Failed to send email to ${emailsToBeSent[i].to}:`, emailResult.error);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Billing check completed. ${createdCount} notification${createdCount !== 1 ? 's' : ''} created, ${emailsSentCount} email${emailsSentCount !== 1 ? 's' : ''} sent.`,
      notificationsCreated: createdCount,
      notificationsSkipped: notifications.length - createdCount,
      emailsSent: emailsSentCount,
      emailsFailed: emailsFailedCount,
      billingsChecked: pendingRentBillings.length
    });

  } catch (error) {
    console.error('Error checking billing reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Check status without creating notifications (for testing)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const pendingRentBillings = await prisma.billing.findMany({
      where: {
        billingType: 'rent',
        paymentStatus: {
          in: ['pending', 'partial']
        },
        dueDate: {
          not: null
        }
      },
      include: {
        user: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            unitNumber: true
          }
        }
      }
    });

    const summary = {
      overdue: 0,
      dueToday: 0,
      dueSoon: 0,
      upcoming: 0,
      total: pendingRentBillings.length,
      details: [] as Array<{
        billingID: number;
        tenant: string;
        unit: string;
        amount: number;
        dueDate: string;
        status: string;
        daysUntilDue: number;
      }>
    };

    for (const billing of pendingRentBillings) {
      if (!billing.dueDate) continue;

      const dueDate = new Date(billing.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let status = '';
      if (diffDays < 0) {
        summary.overdue++;
        status = 'overdue';
      } else if (diffDays === 0) {
        summary.dueToday++;
        status = 'due_today';
      } else if (diffDays <= 3) {
        summary.dueSoon++;
        status = 'due_soon';
      } else if (diffDays <= 7) {
        summary.upcoming++;
        status = 'upcoming';
      }

      if (diffDays <= 7 || diffDays < 0) {
        summary.details.push({
          billingID: billing.billingID,
          tenant: `${billing.user.firstName || ''} ${billing.user.lastName || ''}`.trim(),
          unit: billing.user.unitNumber || billing.unit || 'N/A',
          amount: billing.totalRent,
          dueDate: billing.dueDate.toISOString(),
          status,
          daysUntilDue: diffDays
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Error getting billing status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
