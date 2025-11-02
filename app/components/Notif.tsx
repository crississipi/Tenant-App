import { SetPageProps } from '@/types'
import React from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi'
import NotifSlip from './NotifSlip';
import { filterProps } from 'framer-motion';

const Notif = ({setPage}: SetPageProps) => {
  const Dates = ["Today", "Yesterday", "This week", "Last week"];
  const NotifTypes = ["Message", "Alert", "Tool", "Money"];
  const Filter = ["Recents", "Unread", "Messages", "Alerts", "Maintenance", "Transaction"];
  return (
    <div className='h-full w-full flex flex-col relative'>
      <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden mb-2'>
        <button 
          type="button" 
          className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft />
        </button>
        <h2 className='text-xl font-medium w-full'>Notifications</h2>
      </div>
      <div className='w-full flex items-center border-y border-customViolet/50 overflow-y-hidden'>
        {Filter.map((val, i) => (
          <button 
            key={`filter-button_${i}`}
            type="button" 
            className='flex gap-2 items-center py-3 px-5 border-r border-customViolet/50 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
          >{val}</button>
        ))}
      </div>
      <div className='h-full w-full overflow-x-hidden flex flex-col p-3'>
        {Dates.map((val, i) => (
          <div key={i} className='w-full flex flex-col gap-2 py-3'>
            <h3 className='text-sm font-medium text-customViolet/50'>{val}</h3>
            <div className='w-full flex flex-col gap-2'>
              {NotifTypes.map((value,j) => (
                <NotifSlip key={j} icon={value} message='Lorem ipsum dolor sit amet, consectetur adipiscing elit' time={val} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Notif
