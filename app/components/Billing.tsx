"use client";

import React, { useState } from 'react';
import SummaryLineChart from './SummaryLineChart';
import { TbCaretDownFilled } from 'react-icons/tb';
import ReceiptSlip from './ReceiptSlip';
import { HiOutlineChevronLeft } from 'react-icons/hi';
import { SetPageProps } from '@/types';

type Expense = {
  name: string;
  value: number;
};

const TotalExpenses: Expense[] = [
  { name: 'Sep', value: 3450.60 },
  { name: 'Aug', value: 4763.34 },
  { name: 'Jul', value: 4478.12 },
  { name: 'Jun', value: 3896.54 },
  { name: 'May', value: 3670.88 },
  { name: 'Apr', value: 3355.30 },
  { name: 'Mar', value: 4972.72 },
  { name: 'Feb', value: 4512.96 },
  { name: 'Jan', value: 4255.74 },
  { name: 'Dec', value: 3789.81 },
  { name: 'Nov', value: 3973.33 },
  { name: 'Oct', value: 4220.89 },
]

const adjusted = TotalExpenses.map(item => ({
  name: item.name,
  adjustedValue: item.value - 2500,
}));

const WaterBill = adjusted.map(item => ({
  name: item.name,
  value: item.adjustedValue * 0.3,
}));

const ElectricBill = adjusted.map(item => ({
  name: item.name,
  value: item.adjustedValue * 0.7,
}));

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
    {name: 'Average Rent', value: rentSum / n},
    {name: 'Average Electric', value: electricSum / n},
    {name: 'Average Water', value: waterSum / n}
  ];
}

const ReceiptData = [
  {
    month: 'August', 
    datePaid: '08.29.25', 
    paidAmount: 4000,
    rent: 2500, 
    electric: {
      consumption: 119,
      rate: 12.37,
    }, 
    water: {
      consumption: 37,
      rate: 26.39,
    }, 
    transactionID: '202508-001'
  },
  {
    month: 'July', 
    datePaid: '07.30.25', 
    paidAmount: 4000,
    rent: 2500, 
    electric: {
      consumption: 95,
      rate: 12.02,
    }, 
    water: {
      consumption: 26,
      rate: 26.39,
    }, 
    transactionID: '202507-004'
  },
  {
    month: 'June', 
    datePaid: '06.29.25', 
    paidAmount: 4000,
    rent: 2500, 
    electric: {
      consumption: 107,
      rate: 11.87,
    }, 
    water: {
      consumption: 30,
      rate: 26.30,
    }, 
    transactionID: '202506-002'
  },
]

const Billing = ({ setPage }: SetPageProps) => {
  const [showFilter, setShowFilter] = useState(false);
  const [filterValue, setFilterValue] = useState(2);
  const averages = calculateAveragePercentages(TotalExpenses);

  return (
    <div className='h-full w-full flex flex-col py-3 gap-5'>
      <div className='flex items-center justify-between px-5'>
        <button 
          type="button" 
          className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft />
        </button>
        <h2 className='text-xl font-medium w-full'>Transaction History</h2>
        <div className='w-auto h-auto relative'>
          <button 
            type="button" 
            className='flex px-3 py-2 pr-2 gap-3 items-center text-nowrap border border-customViolet text-customViolet text-sm rounded-sm hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
            onClick={() => setShowFilter(!showFilter)}
          >
            {filterValue === 2 && '3 months'}
            {filterValue === 5 && '6 months'}
            {filterValue === 8 && '9 months'}
            {filterValue === 11 && '12 months'}
            <TbCaretDownFilled className='text-xl'/>
          </button>
          {showFilter && (
            <span className='h-auto min-w-full w-max rounded-md bg-white flex flex-col text-xs absolute z-20 mt-1 left-1/2 -translate-x-1/2 shadow-md'>
              {filterData.map((val,i) => (
                <button 
                  key={`filter_${i}`}
                  type="button" 
                  className='p-3 text-nowrap hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
                  onClick={() => {setShowFilter(false); setFilterValue(val.monthNum);}}
                >
                  {val.months}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className={`w-full grid ${filterValue > 5 ? 'grid-cols-1' : 'grid-cols-2'} px-5 gap-3 transition-all ease-out duration-200`}>
        <div className='col-span-full w-full h-60 rounded-lg bg-customViolet shadow-md flex items-end transition-all ease-out duration-200'>
          <SummaryLineChart 
            title='Total Expenses' 
            data={TotalExpenses} 
            filterValue={filterValue}
            genAve={TotalExpenses.reduce((sum, item) => sum + item.value, 0) / TotalExpenses.length}
          />
        </div>
        <div className='col-span-1 w-full h-48 rounded-lg bg-customViolet text-rose-400 shadow-md flex items-end transition-all ease-out duration-200'>
          <SummaryLineChart 
            title='Electric Bills' 
            data={ElectricBill}
            filterValue={filterValue}
            genAve={ElectricBill.reduce((sum, item) => sum + item.value, 0) / ElectricBill.length}
          />
        </div>
        <div className='col-span-1 w-full h-48 rounded-lg bg-customViolet shadow-md flex items-end transition-all ease-out duration-200'>
          <SummaryLineChart 
            title='Water Bills' 
            data={WaterBill}
            filterValue={filterValue}
            genAve={WaterBill.reduce((sum, item) => sum + item.value, 0) / WaterBill.length}
          />
        </div>
        <div className='col-span-full h-60 grid grid-cols-2 items-start'>
          <h3 className='col-span-full mt-5 font-medium text-lg'>Expenses Average %</h3>
          <div className='col-span-1 aspect-square -mt-5'>
            <SummaryLineChart 
              title='Expenses Average %' 
              data={averages}
              filterValue={filterValue}
              genAve={WaterBill.reduce((sum, item) => sum + item.value, 0) / WaterBill.length}
            />
          </div>
          <div className='col-span-1 w-full h-full flex flex-col justify-center gap-3 -mt-5'>
            <p className='flex gap-3'>
              <span className='min-w-5 min-h-5 bg-[#8884d8]'></span>
              <span>Rent Average %</span>
            </p>
            <p className='flex gap-3'>
              <span className='min-w-5 min-h-5 bg-amber-400'></span>
              <span>Electric Bill %</span>
            </p>
            <p className='flex gap-3'>
              <span className='min-w-5 min-h-5 bg-sky-300'></span>
              <span>Water Bill %</span>
            </p>
          </div>
        </div>
      </div>
      <div className='px-5 flex flex-col gap-5 pb-3'>
        <h3 className='text-lg font-medium'>Receipts</h3>
        {ReceiptData.map((val, i) => (
          <ReceiptSlip 
            key={`receipt-record_${i}`}
            month={val.month}
            paidAmount={val.paidAmount}
            datePaid={val.datePaid}
            rent={val.rent}
            electric={val.electric}
            water={val.water}
            transactionID={val.transactionID} 
          />
        ))}
      </div>
    </div>
  )
}

export default Billing
