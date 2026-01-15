import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch current month expenses and past expenses for the authenticated tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const monthsBack = parseInt(searchParams.get('months') || '3');

    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Calculate the start date for fetching past expenses
    const startDate = new Date(currentYear, currentMonth - monthsBack, 1);

    // Fetch all billings for the user from the start date
    const billings = await prisma.billing.findMany({
      where: {
        userID: userId,
        dateIssued: {
          gte: startDate
        }
      },
      orderBy: {
        dateIssued: 'desc'
      },
      include: {
        payments: {
          select: {
            amount: true,
            datePaid: true
          }
        }
      }
    });

    // Check if user has any billings
    if (billings.length === 0) {
      return NextResponse.json({
        success: true,
        hasExpenses: false,
        message: 'You have no existing expenses',
        currentMonth: {
          totalRent: 0,
          totalWater: 0,
          totalElectric: 0,
          totalAmount: 0
        },
        pastExpenses: []
      });
    }

    // Get current month's billing (most recent)
    const currentMonthBilling = billings[0];
    const currentMonthTotal = currentMonthBilling.totalRent + currentMonthBilling.totalWater + currentMonthBilling.totalElectric;

    // Group billings by month for past expenses
    const monthlyExpenses = new Map<string, { 
      month: string; 
      rent: number; 
      water: number; 
      electric: number; 
      total: number;
      date: Date;
    }>();

    billings.forEach(billing => {
      const date = new Date(billing.dateIssued);
      const monthKey = billing.month || date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      const existing = monthlyExpenses.get(monthKey);
      if (existing) {
        existing.rent += billing.totalRent;
        existing.water += billing.totalWater;
        existing.electric += billing.totalElectric;
        existing.total += (billing.totalRent + billing.totalWater + billing.totalElectric);
      } else {
        monthlyExpenses.set(monthKey, {
          month: monthKey,
          rent: billing.totalRent,
          water: billing.totalWater,
          electric: billing.totalElectric,
          total: billing.totalRent + billing.totalWater + billing.totalElectric,
          date: date
        });
      }
    });

    // Convert to array and sort by date (most recent first)
    const pastExpenses = Array.from(monthlyExpenses.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, monthsBack)
      .map(expense => ({
        month: expense.month,
        total: expense.total,
        elec: expense.electric,
        water: expense.water,
        rent: expense.rent,
        formattedTotal: expense.total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedElec: expense.electric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedWater: expense.water.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedRent: expense.rent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }));

    return NextResponse.json({
      success: true,
      hasExpenses: true,
      currentMonth: {
        totalRent: currentMonthBilling.totalRent,
        totalWater: currentMonthBilling.totalWater,
        totalElectric: currentMonthBilling.totalElectric,
        totalAmount: currentMonthTotal,
        month: currentMonthBilling.month,
        formattedRent: currentMonthBilling.totalRent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedWater: currentMonthBilling.totalWater.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedElectric: currentMonthBilling.totalElectric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formattedTotal: currentMonthTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      },
      pastExpenses
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}
