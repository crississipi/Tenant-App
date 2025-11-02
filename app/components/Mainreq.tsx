import React from 'react'

const Mainreq = () => {
  return (
    <div className='h-auto w-full flex flex-col gap-3'>
      <h2 className='w-full uppercase text-xl text-center font-semibold'>Maintenace Requests</h2>
      <div className='w-full grid grid-cols-12 border-b-2 border-zinc-100/50 pb-2'>
        <span className='text-sm col-span-7 ml-3'>CONCERN</span>
        <span className='text-sm col-span-3'>DATE</span>
        <span className='text-sm col-span-2 mr-3'>URGENCY</span>
      </div>
      <div className='w-full grid grid-cols-12'>
        <span className='text-sm col-span-7 ml-3'>Broken door</span>
        <span className='text-sm col-span-3'>15-05-25</span>
        <span className='text-sm col-span-2 text-center text-emerald-500'>Low</span>
      </div>
    </div>
  )
}

export default Mainreq
