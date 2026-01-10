import { NotifSlipProps } from '@/types'
import React, { JSX } from 'react'
import { RiErrorWarningFill, RiHandCoinFill, RiMessage3Fill, RiToolsFill } from 'react-icons/ri'

const NotifSlip = ({notificationId, icon, message, time, isRead, onMarkAsRead}: NotifSlipProps) => {
  const handleClick = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(notificationId);
    }
  };
  const iconConfig: Record<string, { icon: JSX.Element, bg: string, text: string }> = {
    "Message": { 
      icon: <RiMessage3Fill/>, 
      bg: "bg-blue-50", 
      text: "text-blue-600" 
    },
    "Alert": { 
      icon: <RiErrorWarningFill/>, 
      bg: "bg-rose-50", 
      text: "text-rose-600" 
    },
    "Tool": { 
      icon: <RiToolsFill/>, 
      bg: "bg-amber-50", 
      text: "text-amber-600" 
    },
    "Money": { 
      icon: <RiHandCoinFill/>, 
      bg: "bg-emerald-50", 
      text: "text-emerald-600" 
    }
  }

  const config = iconConfig[icon] || iconConfig["Message"];

  return (
   <button 
     onClick={handleClick}
     className={`w-full p-4 rounded-[1.5rem] border shadow-sm hover:shadow-md hover:border-customViolet/30 transition-all duration-200 flex gap-4 group text-left ${
       isRead ? 'bg-white border-gray-100' : 'bg-blue-50/30 border-customViolet/20'
     }`}
   >
    <div className={`h-12 w-12 rounded-2xl ${config.bg} ${config.text} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform duration-200`}>
      {config.icon}
    </div>

    <div className='flex flex-col flex-1 min-w-0'>
      <div className='flex items-center justify-between gap-2 mb-1'>
        <div className='flex items-center gap-2'>
          <h4 className='font-bold text-gray-800 text-sm truncate'>{icon} Notification</h4>
          {!isRead && (
            <span className='h-2 w-2 bg-customViolet rounded-full'></span>
          )}
        </div>
        <span className='text-[10px] font-medium text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-full'>{time}</span>
      </div>
      <p className='text-xs text-gray-500 line-clamp-2 leading-relaxed group-hover:text-gray-700 transition-colors'>
        {message}
      </p>
    </div>
   </button>
  )
}

export default NotifSlip
