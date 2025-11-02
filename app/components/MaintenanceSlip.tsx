"use client"

import React, { useState } from 'react'
import { RiArrowDownDoubleLine, RiArrowUpDoubleLine } from 'react-icons/ri'

interface MaintenanceSlipProps {
    issue: string;
    desc: string;
    stat: { status: string; statusDate: string }[];
    dateSubmitted: string;
    severity: string;
}

const MaintenanceSlip = ( {issue, desc, stat, dateSubmitted, severity}: MaintenanceSlipProps ) => {
  const [showMore, setShowMore] = useState(false);
  return (
    <button 
        className={`rounded-md border border-customViolet/50 w-full min-h-min shadow-md shadow-transparent pt-2 gap-2 relative overflow-x-hidden text-left flex flex-col 
            ${severity === 'low' && 'bg-emerald-400'} 
            ${severity === 'mid' && 'bg-blue-400'} 
            ${severity === 'high' && 'bg-orange-400'} 
            ${severity === 'crit' && 'bg-red-400'} 
        hover:shadow-customViolet/20 focus:shadow-customViolet/50 transition-all ease-out duration-200 group`}
        onClick={() => setShowMore(!showMore)}
    >
      <span className='flex items-center gap-1 px-3'>
        <h5 className='font-medium'>{issue}</h5>
        <p className='ml-auto px-2 py-0.5 rounded-full text-[10px] bg-customViolet text-white'>{dateSubmitted}</p>
        <p className='px-2 py-0.5 rounded-full text-[10px] bg-fuchsia-600 text-white'>{stat[stat.length - 1].status}</p>
      </span>
      <p className='text-sm px-3'>{desc}</p>
      {showMore && (
        <div className='px-3'>
            <h6 className='font-medium'>Media</h6>
            <div className='w-full flex gap-2'>
                {Array.from({length: 3}).map((_,i) => (
                    <span key={i} className={`h-16 aspect-square 
                        ${severity === 'low' && 'bg-emerald-300'} 
                        ${severity === 'mid' && 'bg-blue-300'} 
                        ${severity === 'high' && 'bg-orange-300'} 
                        ${severity === 'crit' && 'bg-red-300'} 
                    `}></span>
                ))}
            </div>
            <h6 className='mt-3 font-medium'>Status</h6>
            <div className='w-full'>
                {stat.map((val, i) => (
                    <p key={`status_${i}`} className='w-3/4 flex gap-2 items-center text-sm'>
                        <span className={`h-3 w-3 rounded-full 
                            ${val.status === 'Sent' && 'bg-fuchsia-200'}
                            ${val.status === 'Read' && 'bg-fuchsia-400'}
                            ${val.status === 'Scheduled' && 'bg-fuchsia-600'}
                            `}></span>
                        <span className='font-medium'>
                            {val.status === 'Sent' && 'Request sent: '}
                            {val.status === 'Read' && 'Read at: '}
                            {val.status === 'Scheduled' && 'Scheduled on: '}
                        </span>
                        <span className='ml-auto'>{val.statusDate}</span>
                    </p>
                ))}
            </div>
        </div>
      )}
      <span className='sticky bottom-0 z-10 w-full text-neutral-600 bg-neutral-200 text-xl flex items-center justify-center group-hover:bg-customViolet group-hover:text-white ease-out duration-200'>
        {!showMore ? (<RiArrowDownDoubleLine/>) : (<RiArrowUpDoubleLine />)}
    </span>
    </button>
  )
}

export default MaintenanceSlip
