import React from 'react'

interface BillingCardProps {
    month: string;
    total: number;
    elec: number;
    water: number;
}

const BillingCard = ({ month, total, elec, water }: BillingCardProps) => {
  return (
    <button type='button' className='min-w-[200px] rounded-[2rem] bg-customViolet text-white p-5 gap-2 flex flex-col shadow-lg shadow-customViolet/20 hover:shadow-customViolet/40 hover:-translate-y-1 transition-all duration-300 group'>
        <h5 className='text-sm font-medium w-full text-left opacity-80 uppercase tracking-wider'>{month}</h5>
        <div className='w-full flex items-end justify-between mb-2'>
            <p className='text-3xl font-bold flex items-start'>
                <span className='mr-1 text-lg font-medium opacity-70 mt-1'>₱</span>
                {total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
        <div className='w-full flex items-center justify-between text-xs mb-2'>
             <p className={`${(3734.56 - total) < 0 ? 'text-sky-200' : 'text-rose-300'} flex items-center gap-1`}>
                <span className='font-medium'>₱{(Math.abs(3734.56 - total)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <i className='opacity-80 not-italic'>{(3734.56 - total) > 0 ? ' higher' : ' lower'}</i>
            </p>
        </div>
        
        <div className='w-full flex flex-wrap gap-2 mt-auto'>
            <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10'>
                <div className='w-2 h-2 rounded-full bg-amber-300'></div>
                <p className='text-xs font-medium'>₱{elec.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
            <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10'>
                <div className='w-2 h-2 rounded-full bg-sky-300'></div>
                <p className='text-xs font-medium'>₱{water.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
        </div>
    </button>
  )
}

export default BillingCard
