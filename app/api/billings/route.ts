import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch billing history for the authenticated tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const limit = parseInt(searchParams.get('limit') || '50');
    const billingType = searchParams.get('type'); // 'rent', 'utility', etc.
    const paymentStatus = searchParams.get('status'); // 'pending', 'partial', 'paid'
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // Build where clause
    const where: any = {
      userID: userId
    };

    if (billingType) {
      where.billingType = billingType;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (month) {
      where.month = month;
    }

    if (year) {
      where.dateIssued = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      };
    }

    // Fetch billings with related data
    const billings = await prisma.billing.findMany({
      where,
      include: {
        Property: {
          select: {
            propertyId: true,
            name: true,
            address: true
          }
        },
        Payment: {
          select: {
            paymentID: true,
            amount: true,
            paymentMethod: true,
            paymentStatus: true,
            datePaid: true,
            gcashTransactionId: true,
            notes: true
          },
          orderBy: {
            datePaid: 'desc'
          }
        }
      },
      orderBy: {
        dateIssued: 'desc'
      },
      take: limit
    });

    // Calculate summary statistics
    const totalBilled = billings.reduce((sum, b) => sum + b.totalRent + b.totalWater + b.totalElectric, 0);
    const totalPaid = billings.reduce((sum, b) => sum + b.amountPaid, 0);
    const totalPending = totalBilled - totalPaid;
    
    const pendingBillings = billings.filter(b => b.paymentStatus === 'pending' || b.paymentStatus === 'partial');
    const paidBillings = billings.filter(b => b.paymentStatus === 'paid');

    // Format billings for frontend
    const formattedBillings = billings.map(billing => {
      const total = billing.totalRent + billing.totalWater + billing.totalElectric;
      const balance = total - billing.amountPaid;
      const isOverdue = billing.dueDate && new Date(billing.dueDate) < new Date() && billing.paymentStatus !== 'paid';
      
      return {
        billingID: billing.billingID,
        billingType: billing.billingType,
        month: billing.month,
        unit: billing.unit,
        dateIssued: billing.dateIssued.toISOString(),
        dueDate: billing.dueDate?.toISOString() || null,
        paymentStatus: billing.paymentStatus,
        isOverdue,
        
        // Amounts
        totalRent: billing.totalRent,
        totalWater: billing.totalWater,
        totalElectric: billing.totalElectric,
        totalAmount: total,
        amountPaid: billing.amountPaid,
        balance,
        
        // Property info
        property: billing.Property,
      
        // Payment history
        payments: billing.Payment.map((payment: any) => ({
          paymentID: payment.paymentID,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          datePaid: payment.datePaid.toISOString(),
          gcashTransactionId: payment.gcashTransactionId,
          notes: payment.notes
        })),
        
        // Formatted display
        formattedTotal: total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedPaid: billing.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedBalance: balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedDueDate: billing.dueDate 
          ? new Date(billing.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null
      };
    });

    return NextResponse.json({
      success: true,
      billings: formattedBillings,
      summary: {
        totalBillings: billings.length,
        totalBilled,
        totalPaid,
        totalPending,
        pendingCount: pendingBillings.length,
        paidCount: paidBillings.length,
        formattedTotalBilled: totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedTotalPaid: totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedTotalPending: totalPending.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
    });

  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing history' },
      { status: 500 }
    );
  }
}
