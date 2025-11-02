"use client";

import { SetPageProps } from '@/types'
import React, { useState } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi'
import { RiToolsFill } from 'react-icons/ri'
import MaintenanceSlip from './MaintenanceSlip'
import SubmitNewRequest from './SubmitNewRequest';

const MaintenanceInfo = [
  {
    issue: 'Faulty Electrical Line',
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    stat: [
      {
        status: 'Sent',
        statusDate: 'Wed, 09-03-25'
      },
    ],
    dateSubmitted: '3hrs ago',
    severity: 'crit'
  },
  {
    issue: 'Broken Pipe',
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    stat: [
      {
        status: 'Sent',
        statusDate: 'Tue, 09-02-25'
      },
      {
        status: 'Read',
        statusDate: 'Wed, 09-03-25'
      }
    ],
    dateSubmitted: '09-02-25',
    severity: 'high'
  },
  {
    issue: 'Broken Window',
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    stat: [
      {
        status: 'Sent',
        statusDate: 'Mon, 09-01-25'
      },
      {
        status: 'Read',
        statusDate: 'Tue, 09-02-25'
      },
      {
        status: 'Scheduled',
        statusDate: 'Thurs, 09-04-25'
      }
    ],
    dateSubmitted: '09-01-25',
    severity: 'mid'
  },
  {
    issue: 'Leaking Faucet',
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    stat: [
      {
        status: 'Sent',
        statusDate: 'Sat, 08-29-25'
      },
      {
        status: 'Read',
        statusDate: 'Sun, 08-30-25'
      },
      {
        status: 'Scheduled',
        statusDate: 'Wed, 09-03-25'
      }
    ],
    dateSubmitted: '08-29-25',
    severity: 'low'
  },
]

const MaintenancePage = ({ setPage }: SetPageProps) => {
  const [newRequest, submitNewRequest] = useState(false);

  return (
    <div className='h-full w-full flex flex-col relative'>
      {newRequest ? <SubmitNewRequest submitNewRequest={submitNewRequest}/> : (
        <>
        <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden mb-2'>
            <button 
                type="button" 
                className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
                onClick={() => setPage(0)}
            >
                <HiOutlineChevronLeft />
            </button>
            <h2 className='text-xl font-medium w-full'>Maintenance</h2>
        </div>
        <div className='w-full h-full flex flex-col px-5 gap-3'>
            <h3 className='font-medium text-lg'>Pending Requests</h3>
            <div className='bg-neutral-200 w-full flex items-center justify-center rounded-xl'>
                <div className='w-full h-full flex flex-col px-14 py-20 text-neutral-600 gap-3 rounded-md items-center justify-center'>
                    <p className='w-full text-center'>You currently do not have any maintenance request.</p>
                    <button 
                        type="button" 
                        className='w-max items-stretch flex px-3 py-2 rounded-md border border-customViolet/50 gap-2 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
                        onClick={() => submitNewRequest(true)}
                    >
                        <RiToolsFill className='text-2xl'/>
                        Submit Request?
                    </button>
                </div>
            </div>
            <h3 className='font-medium text-lg'>Completed Requests</h3>
            <div className='h-full w-full flex flex-col gap-3 overflow-x-hidden px-2'>
                {MaintenanceInfo.map((val,i) => (
                    <MaintenanceSlip
                        key={i}
                        issue={val.issue}
                        desc={val.desc}
                        stat={val.stat}
                        dateSubmitted={val.dateSubmitted}
                        severity={val.severity}
                    />
                ))}
            </div>
        </div>
        </>
      )}
      
    </div>
  )
}

export default MaintenancePage
