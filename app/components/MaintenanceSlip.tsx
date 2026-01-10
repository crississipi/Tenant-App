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

  const severityColor = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    mid: 'bg-blue-100 text-blue-700 border-blue-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    crit: 'bg-red-100 text-red-700 border-red-200'
  }[severity] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <button 
        className={`w-full bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-customViolet/20 transition-all duration-300 text-left group relative overflow-hidden`}
        onClick={() => setShowMore(!showMore)}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${severityColor.split(' ')[0].replace('bg-', 'bg-').replace('100', '500')}`}></div>
      
      <div className="flex flex-col gap-3 pl-2">
        <div className="flex items-start justify-between gap-3">
          <h5 className='font-semibold text-gray-800 text-lg leading-tight'>{title}</h5>
          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${severityColor}`}>
            {severity.toUpperCase()}
          </span>
        </div>
        
        <p className='text-gray-600 text-sm line-clamp-2'>{desc}</p>
        
        <div className="flex items-center gap-3 mt-1">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(latestStatus.status)}`}>
            {latestStatus.status.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-gray-400">{dateSubmitted}</span>
          
          <div className={`ml-auto transform transition-transform duration-300 ${showMore ? 'rotate-180' : ''}`}>
            <RiArrowDownDoubleLine className="text-customViolet text-xl opacity-50 group-hover:opacity-100" />
          </div>
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${showMore ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
        <div className="overflow-hidden pl-2">
          <div className="pt-4 border-t border-gray-100 space-y-4">
            {/* Media Section */}
            <div>
              <h6 className='text-sm font-semibold text-gray-700 mb-2'>Attached Media</h6>
              {hasImages ? (
                <div className='flex gap-3 overflow-x-auto pb-2 no-scrollbar'>
                    {images.map((url, i) => (
                        <div key={`${title}-img-${i}`} className='h-24 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm hover:scale-105 transition-transform'>
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
                <p className='text-sm text-gray-400 italic'>No images attached.</p>
              )}
            </div>

            {/* Timeline Section */}
            <div>
              <h6 className='text-sm font-semibold text-gray-700 mb-3'>Status History</h6>
              <div className='space-y-3 relative before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100'>
                  {timeline.map((val, i) => (
                      <div key={`status_${i}`} className='flex gap-3 items-start relative'>
                          <span className={`h-3 w-3 rounded-full mt-1.5 flex-shrink-0 z-10 ring-2 ring-white ${getStatusColor(val.status)}`}></span>
                          <div className="flex-1">
                            <p className='text-sm font-medium text-gray-700'>
                                {getStatusLabel(val.status)}
                            </p>
                            <p className='text-xs text-gray-400'>{val.statusDate}</p>
                          </div>
                      </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

export default MaintenanceSlip
