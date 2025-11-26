"use client"

import React, { useState } from 'react'
import { RiArrowDownDoubleLine, RiArrowUpDoubleLine } from 'react-icons/ri'

interface MaintenanceSlipProps {
    title: string;
    desc: string;
    stat: { status: string; statusDate: string }[];
    dateSubmitted: string;
    severity: string;
    images?: string[];
}

const statusColorMap: Record<string, string> = {
  sent: 'bg-fuchsia-200',
  read: 'bg-fuchsia-400',
  scheduled: 'bg-fuchsia-600',
  pending: 'bg-amber-400',
  in_progress: 'bg-blue-500',
  scheduled_visit: 'bg-blue-500',
  completed: 'bg-emerald-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-gray-500'
};

const statusLabelMap: Record<string, string> = {
  sent: 'Request sent:',
  read: 'Read at:',
  scheduled: 'Scheduled on:',
  pending: 'Pending process:',
  in_progress: 'Work in progress:',
  scheduled_visit: 'Visit scheduled:',
  completed: 'Completed on:',
  resolved: 'Resolved on:',
  closed: 'Closed on:'
};

const normalizeStatus = (status: string) =>
  status?.toLowerCase().replace(/\s+/g, '_') || 'sent';

const getStatusColor = (status: string) =>
  statusColorMap[normalizeStatus(status)] || 'bg-fuchsia-200';

const getStatusLabel = (status: string) =>
  statusLabelMap[normalizeStatus(status)] || 'Status update:';

const MaintenanceSlip = ({ title, desc, stat, dateSubmitted, severity, images = [] }: MaintenanceSlipProps) => {
  const [showMore, setShowMore] = useState(false);
  const timeline = stat.length > 0 ? stat : [{ status: 'Sent', statusDate: dateSubmitted }];
  const latestStatus = timeline[timeline.length - 1];
  const hasImages = images.length > 0;

  return (
    <button 
        className={`rounded-md border border-customViolet/50 w-full min-h-max shadow-md shadow-transparent pt-2 gap-2 relative overflow-x-hidden text-left flex flex-col 
          ${severity === 'low' && 'bg-emerald-300'} 
          ${severity === 'mid' && 'bg-blue-300'} 
          ${severity === 'high' && 'bg-orange-300'} 
          ${severity === 'crit' && 'bg-red-300'} 
        hover:shadow-customViolet/20 focus:shadow-customViolet/50 transition-all ease-out duration-200 group`}
        onClick={() => setShowMore(!showMore)}
    >
      <span className='flex flex-wrap items-center gap-1 px-3 text-sm'>
        <h5 className='font-medium'>{title}</h5>
        <p className='ml-auto px-2 py-0.5 rounded-full text-[10px] bg-customViolet text-white text-nowrap'>{dateSubmitted}</p>
        <p className={`px-2 py-0.5 rounded-full text-[10px] text-white ${getStatusColor(latestStatus.status)}`}>{latestStatus.status}</p>
      </span>
      <p className='text-sm px-3 w-full h-max'>{desc}</p>
      {showMore && (
        <div className='px-3'>
            <h6 className='font-medium'>Media</h6>
            {hasImages ? (
              <div className='w-full flex gap-2 overflow-x-auto py-2'>
                  {images.map((url, i) => (
                      <div key={`${title}-img-${i}`} className='h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-white border border-white/50 shadow'>
                          <img 
                              src={url} 
                              alt={`${title} evidence ${i + 1}`} 
                              className='h-full w-full object-cover' 
                              loading="lazy"
                              onError={(event) => {
                                (event.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                          />
                      </div>
                  ))}
              </div>
            ) : (
              <p className='text-sm text-neutral-700 mb-2'>Walang naka-attach na larawan sa request na ito.</p>
            )}
            <h6 className='mt-3 font-medium'>Status</h6>
            <div className='w-full'>
                {timeline.map((val, i) => (
                    <p key={`status_${i}`} className='w-full flex gap-2 items-center text-sm'>
                        <span className={`h-3 w-3 rounded-full ${getStatusColor(val.status)}`}></span>
                        <span className='font-medium'>
                            {getStatusLabel(val.status)}
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
