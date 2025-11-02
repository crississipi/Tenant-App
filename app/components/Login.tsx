import React, { useState } from 'react'
import { ChangePageProps } from '@/types'
import { signIn, getSession } from "next-auth/react";
import CustomInput from './CustomInput';

interface LoginProps extends ChangePageProps {
  onLoginSuccess?: () => void;
}

const Login = ({ setPage, onLoginSuccess }: LoginProps) => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        try {
            const result = await signIn("credentials", {
                username,
                password,
                redirect: false,
            });

            if (result?.error) {
                alert("Invalid credentials")
            } else {
                // Get the session to verify login was successful
                const session = await getSession();
                if (session) {
                    console.log("User logged in:", {
                        id: session.user.id,
                        role: session.user.role,
                        firstName: session.user.firstName,
                        lastName: session.user.lastName,
                        email: session.user.email
                    });
                    
                    alert("Login successful!")
                    
                    // Call the success callback if provided
                    if (onLoginSuccess) {
                        onLoginSuccess();
                    }
                }
            }
        } catch (error) {
            console.error("Login error:", error)
            alert("An error occurred during login")
        } finally {
            setLoading(false)
        }
    }
    
    return (
        <div className='h-full w-full px-5 flex flex-col bg-customViolet'>
            <h1 className='font-poppins text-3xl text-white font-light w-full text-center mt-20'>Log In Account</h1>
            <div className='h-full w-full flex items-center justify-center flex-col'>
                <CustomInput 
                    placeholder='Username' 
                    inputType='text' 
                    marginBottom={true} 
                    hookValue={username} 
                    hookVariable={setUsername}
                />
                <CustomInput 
                    placeholder='Password' 
                    inputType='password' 
                    marginBottom={false} 
                    hookValue={password} 
                    hookVariable={setPassword}
                />
                <button 
                    className='ease-in-out duration-150 h-auto w-full text-lg text-right outline-none text-white no-underline hover:underline focus:underline mt-2 mb-14'
                    onClick={() => setPage(98)}
                >
                    forgot password?
                </button>
                <button 
                    className='px-14 ease-in-out duration-150 py-3 hover:ring-2 hover:ring-customViolet/20 focus:ring-2 focus:ring-customViolet/50 focus:scale-105 bg-white text-customViolet text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                    onClick={handleLogin}
                    disabled={loading || !username || !password}
                >
                    {loading ? "LOGGING IN..." : "LOGIN"}
                </button>
            </div>
        </div>
    )
}

export default Login