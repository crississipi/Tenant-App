import { CustomInputProps } from '@/types'
import React from 'react'
import { RiUserFill, RiLockPasswordFill } from 'react-icons/ri'

const CustomInput = ({ placeholder, inputType, marginBottom, hookVariable, hookValue }: CustomInputProps) => {
  return (
    <div className={`flex items-center h-14 w-full gap-3 px-3 border border-white rounded-lg ${ marginBottom && 'mb-5' }`}>
      {
        inputType === "text" ? (
          <div className='flex items-center justify-center h-9 min-w-9 max-w-9 rounded-full border-[2px] border-white text-white overflow-hidden'>
            <RiUserFill className='h-10 w-10 mt-2'/>
          </div>
        ): (
          <div className='h-9 min-w-9 text-white'>
            <RiLockPasswordFill className='h-full w-full'/>
          </div>
        )
      }
      <input 
        type={inputType} 
        className='h-full w-full overflow-ellipsis text-nowrap overflow-hidden outline-none bg-transparent text-lg text-white placeholder:text-white' 
        placeholder={placeholder} 
        value={hookValue} 
        onChange={(e) => hookVariable(e.target.value)}
      />
    </div>
  )
}

export default CustomInput
