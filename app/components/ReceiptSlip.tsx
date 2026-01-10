import React, { useState } from 'react'
import { HiDownload, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi';

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
    <div className='w-full flex flex-col overflow-hidden rounded-[2rem] shadow-lg shadow-customViolet/20 transition-all duration-300 hover:shadow-customViolet/30'>
      {/* Ticket Header / Main View */}
      <button 
        className='w-full p-6 bg-customViolet text-white flex flex-col relative group' 
        onClick={() => setShowAllInfo(!showAllInfo)}
      >
        <div className='w-full flex justify-between items-start mb-1'>
          <h3 className='text-lg font-bold opacity-90'>{month}</h3>
          <h4 className='font-bold text-3xl tracking-tight'>
            ₱{total - paidAmount < 0 
              ? total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
              : paidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h4>
        </div>
        
        <div className='w-full flex items-center justify-between text-xs mb-6 opacity-75 font-medium'>
          <p>Paid on {datePaid}</p>
          <p className='flex items-center gap-1'>
            Balance: 
            <span className={`${total - paidAmount > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>
              {total - paidAmount < 0 
                ? '₱0.00' 
                : '- ₱' + Math.abs(total - paidAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        {/* Perforated Line Effect */}
        <div className='w-full relative h-4 flex items-center justify-center'>
          <div className='absolute left-0 w-full border-b-2 border-dashed border-white/30'></div>
          <div className='absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full'></div>
          <div className='absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full'></div>
          <div className='z-10 bg-customViolet px-2 text-white/50'>
            {showAllInfo ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {showAllInfo && (
        <div className='w-full bg-customViolet text-white p-6 pt-2 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200'>
          {/* Rent */}
          <div className='flex items-center justify-between p-3 rounded-[1.5rem] bg-white/10 backdrop-blur-sm border border-white/10'>
            <div className='flex flex-col'>
              <h5 className='text-sm font-bold'>Rent</h5>
              <p className='text-white/60 text-xs'>Base Charge</p>
            </div>
            <p className='font-bold'>₱{rent.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          {/* Electricity */}
          <div className='flex items-center justify-between p-3 rounded-[1.5rem] bg-white/10 backdrop-blur-sm border border-white/10'>
            <div className='flex flex-col'>
              <h5 className='text-sm font-bold'>Electricity</h5>
              <p className='text-white/60 text-xs'>{electric.consumption} kWh @ ₱{electric.rate}/kWh</p>
            </div>
            <p className='font-bold'>₱{(electric.consumption * electric.rate).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          {/* Water */}
          <div className='flex items-center justify-between p-3 rounded-[1.5rem] bg-white/10 backdrop-blur-sm border border-white/10'>
            <div className='flex flex-col'>
              <h5 className='text-sm font-bold'>Water</h5>
              <p className='text-white/60 text-xs'>{water.consumption} m³ @ ₱{water.rate}/m³</p>
            </div>
            <p className='font-bold'>₱{((water.consumption * water.rate)/6).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          {/* Footer / Download */}
          <div className='mt-2 pt-4 border-t border-white/20 flex items-center justify-between'>
            <div className='flex flex-col'>
              <span className='text-[10px] uppercase tracking-wider opacity-60'>Transaction ID</span>
              <span className='text-xs font-mono opacity-80'>{transactionID}</span>
            </div>
            <button className='p-2 rounded-full bg-white text-customViolet hover:bg-gray-100 transition-colors shadow-lg'>
              <HiDownload className='text-xl' />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReceiptSlip
