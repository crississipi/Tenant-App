import { NotifSlipProps } from '@/types'
import React, { JSX } from 'react'
import { RiErrorWarningFill, RiHandCoinFill, RiMessage3Fill, RiToolsFill } from 'react-icons/ri'
import { TbAlertTriangle, TbMessageDots, TbReportMoney, TbTool } from 'react-icons/tb'

const NotifSlip = ({icon,message,time}:NotifSlipProps) => {
  const icontype: Record<string, JSX.Element>={
    "Message":<RiMessage3Fill/>,
    "Alert":<RiErrorWarningFill/>,
    "Tool":<RiToolsFill/>,
    "Money":<RiHandCoinFill/>
  }
  return (
   <button className='bg-white p-3 h-max w-full flex items-center gap-3 border border-customViolet/50 shadow-md shadow-transparent focus:shadow-customViolet/50 rounded-2xl focus:scale-103 duration-200 group ease-out'>
    <span className='p-1.5 aspect-square rounded-md border border-customViolet/50 text-customViolet group-focus:text-white group-focus:bg-customViolet text-2xl ease-out duration-200'>
      {icontype[icon] || icontype["Message"]}
    </span>

    <p className='w-full text-sm text-left'>{message}</p>
    <span className='text-[10px] mt-auto text-nowrap rounded-full px-2 py-0.5 bg-customViolet text-white'>{time}</span>
   </button>

   
  )
}

export default NotifSlip
