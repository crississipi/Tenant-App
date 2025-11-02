import React from 'react'

interface BillingCardProps {
    month: string;
    total: number;
    elec: number;
    water: number;
}

const BillingCard = ({ month, total, elec, water }: BillingCardProps) => {
  return (
    <button type='button' className='w-min rounded-xl bg-customViolet text-white px-3 py-2 pb-3 gap-1 flex flex-col shadow-md shadow-transparent hover:shadow-customViolet/50 hover:scale-101 focus:scale-103 ease-out duration-200'>
        <h5 className='text-sm w-full text-left'>{month}</h5>
        <div className='w-full flex items-end justify-between'>
            <p className='text-2xl font-medium flex items-end'>
                <span className='mr-1 text-lg font-bold'>₱</span>
                {total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`${(3734.56 - total) < 0 ? 'text-sky-200' : 'text-rose-300'} text-xs`}>
                <span className='font-medium'>₱{(Math.abs(3734.56 - total)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <i className='text-[10px]'>{(3734.56 - total) > 0 ? ' higher' : ' lower'}</i>
            </p>
        </div>
        <div className='w-full flex items-center gap-2 mt-4'>
            <p className='text-xs font-medium flex items-center py-0.5 pt-1 px-3 rounded-full bg-amber-200 text-black text-nowrap'>₱{elec.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className='text-xs font-medium flex items-center py-0.5 pt-1 px-3 rounded-full bg-sky-200 text-black text-nowrap'>₱{water.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className='text-xs font-medium flex items-center py-0.5 pt-1 px-3 rounded-full bg-emerald-200 text-black text-nowrap'>₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
    </button>
  )
}

export default BillingCard
