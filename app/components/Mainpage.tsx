"use client"

import React, { useState, useEffect } from 'react'
import { RiArrowRightUpLine, RiBellFill, RiBellLine, RiHistoryLine, RiHomeOfficeFill, RiMessage3Fill, RiMessage3Line, RiToolsFill } from 'react-icons/ri';
import Image from 'next/image';
import { MdOutlineElectricalServices } from 'react-icons/md';
import { FaFaucetDrip } from 'react-icons/fa6';
import { Billing, ChatPage, MaintenancePage, MaintenanceSlip, UserProfile } from '.';
import NotifSlip from './NotifSlip';
import BillingCard from './BillingCard';
import Notif from './Notif';
import Login from './Login';
import { useSession } from 'next-auth/react';

const utility = [
  {
    icon: <MdOutlineElectricalServices className='text-xl'/>,
    amount: 784.80,
    color: 'bg-amber-200'
  },
  {
    icon: <FaFaucetDrip className='text-xl'/>,
    amount: 449.76,
    color: 'bg-sky-200'
  },
  {
    icon: <RiHomeOfficeFill className='text-xl'/>,
    amount: 2500.00,
    color: 'bg-emerald-200'
  },
]

const pastExpenses = [
  {
    month: 'Last Month',
    total: 3960.13,
    elec: 987.34,
    water: 472.79,
    rent: 2500.00
  },
  {
    month: 'Month of July',
    total: 3560.44,
    elec: 645.81,
    water: 414.19,
    rent: 2500.00
  },
  {
    month: 'Month of June',
    total: 3328.56,
    elec: 511.37,
    water: 317.19,
    rent: 2500.00
  },
]

const notifInfo = [
  {
    icon: 'Message',
    message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    time: '3 mins'
  },
  {
    icon: 'Alert',
    message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    time: '20 mins'
  },
  {
    icon: 'Tool',
    message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    time: '2hrs'
  },
  {
    icon: 'Money',
    message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    time: '1 day'
  },
]

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

const Mainpage = () => {
  const [page, setPage] = useState(0);
  const { data: session, status } = useSession();

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className='h-full w-full flex flex-col bg-neutral-50 items-center justify-center'>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-customViolet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!session) {
    return (
      <div className='h-full w-full flex flex-col bg-neutral-50 items-center justify-center'>
        <Login setPage={setPage} />
      </div>
    );
  }

  // User is authenticated, show main content
  const user = session.user;

  return (
    <div className='h-full w-full flex flex-col bg-neutral-50 items-center gap-3 select-none relative'>
      <Image
        height={500}
        width={500}
        src='/logo.png'
        alt='profile template'
        className='absolute mt-3 h-10 w-10 z-10 aspect-square object-contain object-center'
      />
      <div className='sticky top-0 z-99 h-16 w-full flex border-b border-t border-customViolet/50 bg-white/30 backdrop-blur-xs shadow-xs shadow-customViolet/50'>
        <button 
          className='w-full h-full flex py-2 pl-5 border-r border-customViolet/50 gap-3 hover:bg-customViolet/50 focus:bg-customViolet group ease-out duration-200'
          onClick={() => setPage(4)}
        >
          <span className='h-full aspect-square p-1 bg-neutral-200 rounded-full group-focus:bg-white/50 ease-out duration-200'>
            <Image
              height={500}
              width={500}
              src='/profile-template.png'
              alt='profile template'
              className='h-full w-full aspect-square object-contain object-center'
            />
          </span>
          <span className='flex flex-col w-full items-start group-focus:text-white ease-out duration-200'>
            <h1 className='font-medium text-lg mt-1'>
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.name || 'User'
              }
            </h1>
            <h2 className='text-sm font-light -mt-1.5'>Unit 101</h2>
          </span>
        </button>
        <button 
          type="button" 
          className='h-full aspect-square border-r border-customViolet/50 flex items-center justify-center group hover:bg-customViolet/50 focus:bg-customViolet text-4xl ease-out duration-200 relative'
          onClick={() => setPage(2)}
        >
          <RiMessage3Line className='text-white hidden group-focus:block ease-out duration-200'/>
          <RiMessage3Fill className='text-customViolet group-focus:hidden ease-out duration-200'/>
          <span className='h-4 w-4 aspect-square flex items-center justify-center rounded-full text-xs font-semibold text-white bg-rose-500 absolute top-2.5 right-2.5'></span>
        </button>
      </div>
      {page === 0 && (
        <>
          <div className='flex flex-col w-full pt-5 gap-5'>
            <div className='flex justify-between items-end'>
              <span className='w-1/2 pl-5 flex flex-col gap-1'>
                <h3 className=''>This Month's Expenses</h3>
                <h4 className='text-customViolet text-5xl font-semibold'><span className='text-4xl mr-2 font-medium'>₱</span>3,734.56</h4>
              </span>
              <button 
                type='button' 
                className='flex py-2 pl-3 pr-2 items-center gap-2 bg-customViolet/50 rounded-l-full text-sm mb-2 hover:bg-customViolet/75 focus:bg-customViolet focus:text-white ease-out duration-200'
                onClick={() => setPage(1)}
              >
                <RiHistoryLine className='text-xl'/>
                History
              </button>
            </div>
            <div className='w-full flex items-center px-5 gap-2 justify-center'>
              {utility.map((val, i) => (
                <div 
                  key={`utility_${i}`} 
                  className={`rounded-full flex items-center gap-2 pl-1.5 pr-3 py-1 ${val.color}`}
                >
                  <span className='p-1 rounded-full bg-white'>{val.icon}</span>
                  <p className='text-sm font-medium flex items-center mt-0.5'>₱{val.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
            <div className='w-full flex gap-3 overflow-y-hidden flex-nowrap px-5 py-3 no__scrollbar'>
              {pastExpenses.map((val, i) => (
                <BillingCard
                  key={`pastExpenses_${i}`}
                  month={val.month}
                  total={val.total}
                  elec={val.elec}
                  water={val.water}
                />
              ))}
            </div>
          </div>
          <div className='w-full mt-5 flex flex-col'>
            <h2 className='text-xl font-medium pl-5 w-full'>Recent Notifications</h2>
            <div className='w-full flex flex-col gap-3 px-5 py-3 items-end'>
              {notifInfo.map((val, i) => (
                <NotifSlip key={i} icon={val.icon} message={val.message} time={val.time} />
              ))}
              <button 
                type="button" 
                className='text-sm flex items-center px-3 py-1 rounded-full focus:bg-customViolet focus:text-white ease-out duration-200'
                onClick={() => setPage(3)}
              >more<RiArrowRightUpLine /></button>
            </div>
          </div>
          <div className='w-full mt-5 flex flex-col'>
            <h2 className='text-xl font-medium pl-5'>Maintenance</h2>
              <div className='w-full flex flex-nowrap overflow-y-hidden gap-3 px-5 py-3 no__scrollbar'>
                <div className='h-full overflow-hidden bg-white shadow-md shadow-customViolet/50 max-h-155 min-w-full flex flex-col items-center gap-3 rounded-xl border border-customViolet/50 px-1 py-2 pb-3'>
                  <span className='w-full flex items-center justify-between px-2'>
                    <h3 className='w-full text-left font-medium text-lg'>Pending Requests</h3>
                    <button 
                      type="button" 
                      className='text-nowrap flex items-center gap-1 rounded-full border border-customViolet/50 px-3 py-1 pr-2 text-sm hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
                      onClick={() => setPage(5)}
                    >
                      see all
                      <RiArrowRightUpLine />
                    </button>
                  </span>
                  <div className='hidden w-full h-full flex-col px-14 py-2 text-neutral-600 gap-3 rounded-md items-center justify-center'>
                    <p className='w-full text-left'>You currently do not have any maintenance request.</p>
                    <button type="button" className='w-max items-stretch flex px-3 py-2 rounded-md border border-customViolet/50 gap-2 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'>
                      <RiToolsFill className='text-2xl'/>
                      Submit Request?
                    </button>
                  </div>
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
                <div className='bg-white shadow-md shadow-customViolet/50 max-h-110 min-w-full flex flex-col items-center gap-2 rounded-xl border border-customViolet/50 px-3 py-2 pb-3 '>
                  <span className='w-full flex items-center justify-between'>
                    <h3 className='w-full text-left font-medium text-lg'>Recently Completed</h3>
                    <button                     
                      type="button" 
                      className='text-nowrap flex items-center gap-1 rounded-full border border-customViolet/50 px-3 py-1 pr-2 text-sm hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
                      onClick={() => setPage(5)}
                    >
                      see all
                      <RiArrowRightUpLine />
                    </button>
                  </span>
                  <div className='w-full h-full flex flex-col px-14 py-2 text-neutral-600 gap-3 rounded-md items-center justify-center'>
                    <p className='w-full text-left'>You currently do not have any maintenance request.</p>
                    <button type="button" className='w-max items-stretch flex px-3 py-2 rounded-md border border-customViolet/50 gap-2 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'>
                      <RiToolsFill className='text-2xl'/>
                      Submit Request?
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </>
      )}
      {page === 1 && (<Billing setPage={setPage}/>)}
      {page === 2 && (<ChatPage setPage={setPage}/>)}
      {page === 3 && (<Notif setPage={setPage}/>)}
      {page === 4 && (<UserProfile setPage={setPage}/>)}
      {page === 5 && (<MaintenancePage setPage={setPage}/>)}
    </div>
  )
}

export default Mainpage