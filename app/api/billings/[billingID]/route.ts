import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch a specific billing by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { billingID: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const billingID = parseInt(params.billingID);

    if (isNaN(billingID)) {
      return NextResponse.json(
        { success: false, error: 'Invalid billing ID' },
        { status: 400 }
      );
    }

    // Fetch billing with all related data
    const billing = await prisma.billing.findFirst({
      where: {
        billingID,
        userID: userId // Ensure user can only access their own billings
      },
      include: {
        property: {
          select: {
            propertyId: true,
            name: true,
            address: true,
            rent: true
          }
        },
        user: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            email: true,
            unitNumber: true
          }
        },
        Payment: {
          select: {
            paymentID: true,
            amount: true,
            paymentMethod: true,
            paymentStatus: true,
            datePaid: true,
            gcashReceiptImage: true,
            gcashTransactionId: true,
            notes: true
          },
          orderBy: {
            datePaid: 'desc'
          }
        }
      }
    });

    if (!billing) {
      return NextResponse.json(
        { success: false, error: 'Billing not found' },
        { status: 404 }
      );
    }

    // Calculate totals
    const totalAmount = billing.totalRent + billing.totalWater + billing.totalElectric;
    const balance = totalAmount - billing.amountPaid;
    const isOverdue = billing.dueDate && new Date(billing.dueDate) < new Date() && billing.paymentStatus !== 'paid';

    // Format response
    const formattedBilling = {
      billingID: billing.billingID,
      billingType: billing.billingType,
      month: billing.month,
      unit: billing.unit,
      dateIssued: billing.dateIssued.toISOString(),
      dueDate: billing.dueDate?.toISOString() || null,
      paymentStatus: billing.paymentStatus,
      isOverdue,
      
      // Breakdown
      totalRent: billing.totalRent,
      totalWater: billing.totalWater,
      totalElectric: billing.totalElectric,
      totalAmount,
      amountPaid: billing.amountPaid,
      balance,
      
      // Property info
      property: billing.property,
      
      // User info
      user: billing.user,
      
      // Payment history
      payments: billing.Payment.map(payment => ({
        paymentID: payment.paymentID,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        datePaid: payment.datePaid.toISOString(),
        gcashReceiptImage: payment.gcashReceiptImage,
        gcashTransactionId: payment.gcashTransactionId,
        notes: payment.notes,
        formattedAmount: payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedDate: new Date(payment.datePaid).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      })),
      
      // Formatted amounts for display
      formattedRent: billing.totalRent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedWater: billing.totalWater.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedElectric: billing.totalElectric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedTotal: totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedPaid: billing.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedBalance: balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedDueDate: billing.dueDate 
        ? new Date(billing.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null,
      formattedDateIssued: new Date(billing.dateIssued).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    };

    return NextResponse.json({
      success: true,
      billing: formattedBilling
    });

  } catch (error) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing details' },
      { status: 500 }
    );
  }
}
