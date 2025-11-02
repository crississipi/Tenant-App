import { BillingSlipProps } from '@/types'
import React from 'react'
import { TbCurrencyPeso } from 'react-icons/tb'

const BillingSlip = ({ billName, billAmount}: BillingSlipProps) => {
  return (
    <div className='col-span-4 flex flex-col items-start'>
      <span className='text-sm'>{billName}</span>
      <h2 className='text-xl font-semibold inline-flex items-center'>
        <TbCurrencyPeso className='stroke-2'/>
        {billAmount.toFixed(2)}
      </h2>
    </div>
  )
}

export default BillingSlip
