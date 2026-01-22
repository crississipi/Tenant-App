import React, { useState } from 'react'
import { ChangePageProps } from '@/types'
import { signIn } from "next-auth/react";
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';

interface LoginProps extends ChangePageProps {
  onLoginSuccess?: () => void;
}

const LANDLORD_APP_URL = process.env.NEXT_PUBLIC_LANDLORD_APP_URL || "https://coliving-for-landlord.vercel.app";

const Login = ({ setPage, onLoginSuccess }: LoginProps) => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
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
            <div className='h-full w-full px-5 flex flex-col bg-gray-50 items-center justify-center'>
                <div className="text-center bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                    <div className="w-12 h-12 border-4 border-customViolet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className='font-semibold text-xl text-gray-800 mb-2'>Landlord/Admin Account Detected</h2>
                    <p className='text-gray-500 text-sm'>Redirecting you to the Landlord Portal...</p>
                </div>
            </div>
        )
    }

    return (
        <div className='h-full w-full px-6 flex flex-col bg-gray-50 items-center justify-center'>
            <div className='w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-customViolet/5 p-8 border border-gray-100'>
                <div className='text-center mb-10'>
                    <h1 className='text-3xl font-bold text-customViolet mb-2'>Tenant Portal</h1>
                    <p className='text-gray-400 text-sm'>Please sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <HiOutlineUser className="h-5 w-5 text-gray-400 group-focus-within:text-customViolet transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-customViolet/20 focus:border-customViolet transition-all"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <HiOutlineLockClosed className="h-5 w-5 text-gray-400 group-focus-within:text-customViolet transition-colors" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            className="block w-full pl-11 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-customViolet/20 focus:border-customViolet transition-all"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-customViolet transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <HiOutlineEyeOff className="h-5 w-5" /> : <HiOutlineEye className="h-5 w-5" />}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-500 text-sm py-3 px-4 rounded-[1.5rem] text-center animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button 
                            className='text-sm text-gray-400 hover:text-customViolet transition-colors font-medium'
                            onClick={() => setPage(98)}
                            type="button"
                        >
                            Forgot Password?
                        </button>
                    </div>

                    <button 
                        type="submit"
                        className='w-full py-4 bg-customViolet text-white text-lg font-semibold rounded-[1.5rem] shadow-lg shadow-customViolet/30 hover:shadow-customViolet/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100'
                        disabled={loading || !username || !password}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Logging in...
                            </span>
                        ) : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login