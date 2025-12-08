import React, { useState } from 'react'
import { ChangePageProps } from '@/types'
import { signIn } from "next-auth/react";
import CustomInput from './CustomInput';

interface LoginProps extends ChangePageProps {
  onLoginSuccess?: () => void;
}

const LANDLORD_APP_URL = process.env.NEXT_PUBLIC_LANDLORD_APP_URL || "http://localhost:3000";

const Login = ({ setPage, onLoginSuccess }: LoginProps) => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [redirecting, setRedirecting] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const checkRoleResponse = await fetch('/api/auth/check-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const roleData = await checkRoleResponse.json();

            if (!roleData.success) {
                setError(roleData.error || "Invalid username or password")
                setLoading(false)
                return
            }

            if (!roleData.allowLogin) {
                setRedirecting(true)
                setError("")

                setTimeout(() => {
                    window.location.href = roleData.redirectUrl || LANDLORD_APP_URL;
                }, 1500);
                return
            }

            const result = await signIn("credentials", {
                username,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid username or password")
            } else if (onLoginSuccess) {
                onLoginSuccess();
            }
        } catch (err) {
            console.error("Login error:", err)
            setError("An unexpected error occurred. Please try again.")
        } finally {
            if (!redirecting) {
                setLoading(false)
            }
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        handleLogin(e)
    }

    if (redirecting) {
        return (
            <div className='h-full w-full px-5 flex flex-col bg-customViolet items-center justify-center'>
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className='font-poppins text-2xl text-white font-light mb-2'>Landlord/Admin Account Detected</h2>
                    <p className='text-white/80 text-sm'>Redirecting you to the Landlord Portal...</p>
                </div>
            </div>
        )
    }

    return (
        <div className='h-full w-full px-5 flex flex-col bg-customViolet'>
            <h1 className='font-poppins text-3xl text-white font-light w-full text-center mt-20'>Log In Account</h1>
            <div className='h-full w-full flex items-center justify-center flex-col'>
                <form onSubmit={handleSubmit} className="w-full">
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

                    {error && (
                        <div className="bg-red-500/20 border border-red-400 text-red-100 text-sm py-2 px-4 rounded-lg mt-4 text-center">
                            {error}
                        </div>
                    )}

                    <button 
                        className='ease-in-out duration-150 h-auto w-full text-lg text-right outline-none text-white no-underline hover:underline focus:underline mt-2 mb-14'
                        onClick={() => setPage(98)}
                        type="button"
                    >
                        forgot password?
                    </button>
                    <button 
                        type="submit"
                        className='px-14 ease-in-out duration-150 py-3 hover:ring-2 hover:ring-customViolet/20 focus:ring-2 focus:ring-customViolet/50 focus:scale-105 bg-white text-customViolet text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full'
                        disabled={loading || !username || !password}
                    >
                        {loading ? "LOGGING IN..." : "LOGIN"}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login