"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import SummaryLineChart from './SummaryLineChart';
import { TbCaretDownFilled } from 'react-icons/tb';
import ReceiptSlip from './ReceiptSlip';
import { HiOutlineChevronLeft } from 'react-icons/hi';
import { SetPageProps } from '@/types';

type Expense = {
  name: string;
  value: number;
};

interface BillingRecord {
  billingID: number;
  month: string | null;
  dateIssued: string;
  dueDate: string | null;
  totalRent: number;
  totalWater: number;
  totalElectric: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentStatus: string;
  formattedTotal: string;
  formattedPaid: string;
  formattedDueDate: string | null;
  payments: Array<{
    paymentID: number;
    amount: number;
    datePaid: string;
    paymentMethod: string;
    gcashTransactionId: string | null;
  }>;
}

const filterData = [
  {
    months: '3 months',
    monthNum: 2
  },
  {
    months: '6 months',
    monthNum: 5
  },
  {
    months: '9 months',
    monthNum: 8
  },
  {
    months: '12 months',
    monthNum: 11
  },
];

const RENT = 2500;

function rentPercentage(total: number): number {
  return (RENT / total) * 100;
}

function electricPercentage(total: number): number {
  return ((0.7 * (total - RENT)) / total) * 100;
}

function waterPercentage(total: number): number {
  return ((0.3 * (total - RENT)) / total) * 100;
}

function calculateAveragePercentages(data: Expense[]) {
  let rentSum = 0;
  let electricSum = 0;
  let waterSum = 0;

  data.forEach(({ value }) => {
    rentSum += rentPercentage(value);
    electricSum += electricPercentage(value);
    waterSum += waterPercentage(value);
  });

  const n = data.length;

  return [
    {name: 'Average Rent', value: n > 0 ? rentSum / n : 0},
    {name: 'Average Electric', value: n > 0 ? electricSum / n : 0},
    {name: 'Average Water', value: n > 0 ? waterSum / n : 0}
  ];
}

const Billing = ({ setPage }: SetPageProps) => {
  const { data: session } = useSession();
  const [showFilter, setShowFilter] = useState(false);
  const [filterValue, setFilterValue] = useState(2);
  const [billings, setBillings] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBillings = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/billings?limit=12');
      const data = await response.json();
      
      if (data.success) {
        setBillings(data.billings);
      }
    } catch (error) {
      console.error('Error fetching billings:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchBillings();
    }
  }, [session?.user?.id, fetchBillings]);

  // Process billing data for charts
  const processChartData = () => {
    if (billings.length === 0) {
      return {
        totalExpenses: [],
        electricBill: [],
        waterBill: []
      };
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last12Months = billings.slice(0, 12).reverse();

    const totalExpenses = last12Months.map(billing => ({
      name: billing.month || new Date(billing.dateIssued).toLocaleDateString('en-US', { month: 'short' }),
      value: billing.totalAmount
    }));

    const electricBill = last12Months.map(billing => ({
      name: billing.month || new Date(billing.dateIssued).toLocaleDateString('en-US', { month: 'short' }),
      value: billing.totalElectric
    }));

    const waterBill = last12Months.map(billing => ({
      name: billing.month || new Date(billing.dateIssued).toLocaleDateString('en-US', { month: 'short' }),
      value: billing.totalWater
    }));

    return { totalExpenses, electricBill, waterBill };
  };

  const { totalExpenses, electricBill, waterBill } = processChartData();
  const averages = calculateAveragePercentages(totalExpenses.length > 0 ? totalExpenses : [{ name: 'None', value: 0 }]);

  return (
    <div className='h-full w-full flex flex-col py-6 gap-6 bg-gray-50/50'>
      <div className='flex items-center justify-between px-6'>
        <button 
          type="button" 
          className='p-2 -ml-2 rounded-full hover:bg-gray-100 text-customViolet transition-all duration-300'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft className='text-2xl' />
        </button>
        <h2 className='text-xl font-semibold text-gray-800'>Transaction History</h2>
        <div className='relative'>
          <button 
            type="button" 
            className='flex px-4 py-2 gap-2 items-center bg-white border border-gray-200 text-customViolet text-sm font-medium rounded-full shadow-sm hover:shadow-md hover:border-customViolet/30 transition-all duration-300'
            onClick={() => setShowFilter(!showFilter)}
          >
            {filterValue === 2 && '3 months'}
            {filterValue === 5 && '6 months'}
            {filterValue === 8 && '9 months'}
            {filterValue === 11 && '12 months'}
            <TbCaretDownFilled className='text-lg opacity-70'/>
          </button>
          {showFilter && (
            <div className='absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-200'>
              {filterData.map((val,i) => (
                <button 
                  key={`filter_${i}`}
                  type="button" 
                  className='w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700 hover:text-customViolet transition-colors border-b border-gray-50 last:border-none'
                  onClick={() => {setShowFilter(false); setFilterValue(val.monthNum);}}
                >
                  {val.months}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 px-6 gap-4 transition-all ease-out duration-300`}>
        <div className='col-span-full lg:col-span-2 lg:row-span-2 w-full h-64 lg:h-auto rounded-[2rem] bg-customViolet shadow-lg shadow-customViolet/20 flex items-end p-4 transition-all hover:scale-[1.01] duration-300'>
          <SummaryLineChart 
            title='Total Expenses' 
            data={totalExpenses.length > 0 ? totalExpenses : [{ name: 'No Data', value: 0 }]} 
            filterValue={filterValue}
            genAve={totalExpenses.length > 0 ? totalExpenses.reduce((sum, item) => sum + item.value, 0) / totalExpenses.length : 0}
          />
        </div>
        <div className='col-span-1 lg:col-span-1 w-full h-52 rounded-[2rem] bg-white border border-gray-100 shadow-sm flex items-end p-4 transition-all hover:shadow-md duration-300'>
          <SummaryLineChart 
            title='Electric Bills' 
            data={electricBill.length > 0 ? electricBill : [{ name: 'No Data', value: 0 }]}
            filterValue={filterValue}
            genAve={electricBill.length > 0 ? electricBill.reduce((sum, item) => sum + item.value, 0) / electricBill.length : 0}
          />
        </div>
        <div className='col-span-1 lg:col-span-1 w-full h-52 rounded-[2rem] bg-white border border-gray-100 shadow-sm flex items-end p-4 transition-all hover:shadow-md duration-300'>
          <SummaryLineChart 
            title='Water Bills' 
            data={waterBill.length > 0 ? waterBill : [{ name: 'No Data', value: 0 }]}
            filterValue={filterValue}
            genAve={waterBill.length > 0 ? waterBill.reduce((sum, item) => sum + item.value, 0) / waterBill.length : 0}
          />
        </div>
        
        <div className='col-span-full lg:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mt-2 lg:mt-0'>
          <h3 className='font-semibold text-lg mb-4 text-gray-800'>Expenses Breakdown</h3>
          <div className='grid grid-cols-2 gap-6 items-center'>
            <div className='aspect-square max-h-48 flex items-center justify-center'>
              <SummaryLineChart 
                title='Expenses Average %' 
                data={averages}
                filterValue={filterValue}
                genAve={waterBill.length > 0 ? waterBill.reduce((sum, item) => sum + item.value, 0) / waterBill.length : 0}
              />
            </div>
            <div className='flex flex-col justify-center gap-4'>
              <div className='flex items-center gap-3 p-3 rounded-xl bg-gray-50'>
                <span className='w-3 h-3 rounded-full bg-customViolet shadow-sm'></span>
                <span className='text-sm font-medium text-gray-700'>Rent</span>
                <span className='ml-auto text-xs font-bold text-gray-500'>{(averages[0].value).toFixed(1)}%</span>
              </div>
              <div className='flex items-center gap-3 p-3 rounded-xl bg-gray-50'>
                <span className='w-3 h-3 rounded-full bg-amber-400 shadow-sm'></span>
                <span className='text-sm font-medium text-gray-700'>Electric</span>
                <span className='ml-auto text-xs font-bold text-gray-500'>{(averages[1].value).toFixed(1)}%</span>
              </div>
              <div className='flex items-center gap-3 p-3 rounded-xl bg-gray-300 shadow-sm'>
                <span className='w-3 h-3 rounded-full bg-sky-300 shadow-sm'></span>
                <span className='text-sm font-medium text-gray-700'>Water</span>
                <span className='ml-auto text-xs font-bold text-gray-500'>{(averages[2].value).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='px-6 flex flex-col gap-4 pb-6'>
        <h3 className='text-lg font-semibold text-gray-800 ml-1'>Receipts</h3>
        {loading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-customViolet'></div>
          </div>
        ) : billings.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 px-6 bg-white rounded-[2rem] border border-dashed border-gray-200'>
            <div className='text-4xl mb-3 text-gray-300'>📄</div>
            <p className='text-gray-500 text-sm font-medium'>You have no billings yet</p>
          </div>
        ) : (
          <div className='flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4'>
            {billings.filter(b => b.paymentStatus === 'paid').slice(0, 6).map((billing) => {
              const latestPayment = billing.payments[0];
              return (
                <ReceiptSlip 
                  key={`receipt-record_${billing.billingID}`}
                  month={billing.month || new Date(billing.dateIssued).toLocaleDateString('en-US', { month: 'long' })}
                  paidAmount={billing.amountPaid}
                  datePaid={latestPayment ? new Date(latestPayment.datePaid).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, '.') : 'N/A'}
                  rent={billing.totalRent}
                  electric={{
                    consumption: 0,
                    rate: billing.totalElectric
                  }}
                  water={{
                    consumption: 0,
                    rate: billing.totalWater
                  }}
                  transactionID={latestPayment?.gcashTransactionId || `BILL-${billing.billingID}`} 
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Billing
