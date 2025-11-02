import React, { useState } from 'react'
import { HiDownload } from 'react-icons/hi';

interface ReceiptProps {
  month: string;
  datePaid: string;
  paidAmount: number;
  rent: number;
  electric: {
    consumption: number;
    rate: number;
  };
  water: {
    consumption: number;
    rate: number;
  };
  transactionID: string;
}

const ReceiptSlip = ({ month, datePaid, paidAmount, rent, electric, water, transactionID }: ReceiptProps) => {
  const total = rent + (electric.consumption * electric.rate) + ((water.consumption * water.rate)/6);
  const [showAllInfo, setShowAllInfo] = useState(false);
  return (
    <div className='w-full flex-col overflow-hidden rounded-t-xl text-white'>
      <button className='w-full p-4 px-5 bg-customViolet flex flex-col ' onClick={() => setShowAllInfo(!showAllInfo)}>
        <span className='flex justify-between items-center text-xl'>
          <h3>{month}</h3>
          <h4 className='font-semibold text-2xl'>₱{total - paidAmount < 0 ? total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : paidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
        </span>
        <span className='flex items-center justify-between text-xs mb-7 text-neutral-400'>
          <p>Date Paid: <strong>{datePaid}</strong></p>
          <p>Balance: <i><strong>{total - paidAmount < 0 ? '₱' + 0.00.toFixed(2) : '- ₱' + Math.abs(total - paidAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></i></p>
        </span>
        <span 
        className='
          h-0.5 w-full border-b-2 border-spacing-x-20 border-dashed border-white relative 
          before:h-7 before:w-7 before:rounded-full before:bg-white before:absolute before:top-1/2 before:-left-9 before:-translate-y-1/2
          after:h-7 after:w-7 after:rounded-full after:bg-white after:absolute after:top-1/2 after:-right-9 after:-translate-y-1/2'
        >
        </span>
      </button>
      {showAllInfo && (
        <div className='w-full bg-customViolet rounded-b-xl flex flex-col p-5 pr-3 pb-0 gap-3'>
          <div className='flex items-center justify-between pr-2'>
            <span className='flex flex-col'>
              <h5 className='text-lg'>Rent</h5>
              <p className='text-neutral-300 text-xs'>Amount: <strong>₱{rent.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            </span>
            <p className='text-lg font-semibold'>₱{rent.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className='flex items-center justify-between pr-2'>
            <span className='flex flex-col'>
              <h5 className='text-lg'>Electric Bill</h5>
              <p className='text-neutral-300 text-xs'>Total Consumption: <strong>{electric.consumption} kWh</strong></p>
              <p className='text-neutral-300 text-xs'>Current Rate: <strong>₱{electric.rate.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per kWh</strong></p>
            </span>
            <p className='text-lg font-semibold'>₱{(electric.consumption * electric.rate).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className='flex items-center justify-between pr-2'>
            <span className='flex flex-col'>
              <h5 className='text-lg'>Water Bill</h5>
              <p className='text-neutral-300 text-xs'>Total Consumption: <strong>{water.consumption} cu.m.</strong></p>
              <p className='text-neutral-300 text-xs'>Current Rate: <strong>₱{water.rate.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per cu. m.</strong></p>
            </span>
            <span className='flex flex-col'>
              <p className='text-neutral-300 text-xs'><strong>₱{(water.consumption * water.rate).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 6</strong></p>
              <p className='text-lg font-semibold'>₱{((water.consumption * water.rate)/6).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </span>
          </div>

          <div className='rounded-md bg-white/75 text-customViolet flex items-center justify-between p-3 px-5 mt-5 text-lg font-medium mr-2'>
            <h6>Total Bill</h6>
            <h6 className='font-semibold'>₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h6>
          </div>

          <div className='flex items-end justify-between pb-3'>
            <p className='text-xs text-neutral-400'><em>Transaction ID: {transactionID}</em></p>
            <button type="button" className='text-2xl px-3 py-2 rounded-md hover:bg-white/50 focus:bg-white focus:text-customViolet ease-out duration-200'>
              <HiDownload />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReceiptSlip
