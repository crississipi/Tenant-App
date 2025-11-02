"use client";

import { SetPageProps } from '@/types'
import React, { useState, useEffect } from 'react'
import { HiOutlineChevronLeft, HiPencil } from 'react-icons/hi'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface CredentialImage {
  url: string;
  fileName: string;
  resourceId: number;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  sex: string;
  bday: string;
  age: number;
  email: string;
  firstNumber: string;
  secondNumber: string;
  unit: string;
  rent: string;
  residencyPeriod: string;
  profilePicture?: string;
  credentialImages: CredentialImage[];
}

const UserProfile = ({ setPage }: SetPageProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [editInfo, setEditInfo] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        console.error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userData) return;

    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          middleInitial: userData.middleInitial,
          sex: userData.sex,
          bday: userData.bday,
          email: userData.email,
          firstNumber: userData.firstNumber,
          secondNumber: userData.secondNumber
        }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setUserData(updatedData);
        setEditInfo(false);
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });

      if (response.ok) {
        setMessage('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage('Error changing password');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'profile');

    setSaving(true);
    try {
      const response = await fetch('/api/user/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Refresh user data to get updated images
        fetchUserData();
        setMessage('Profile picture updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setMessage('Error uploading profile picture');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      // Clear any local storage or state if needed
      localStorage.removeItem('user-preference');
      
      // Call NextAuth signOut which will clear the session
      await signOut({ 
        redirect: false,
        callbackUrl: '/auth/login'
      });
      
      // Clear any cached data
      setUserData(null);
      
      // Redirect to login page
      router.push('/auth/login');
      
    } catch (error) {
      console.error('Error during logout:', error);
      setMessage('Error during logout');
      setLogoutLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditInfo(false);
    fetchUserData(); // Reset any unsaved changes
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  if (loading) {
    return (
      <div className='h-full w-full bg-white flex items-center justify-center'>
        <div className='text-lg'>Loading...</div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className='h-full w-full bg-white flex items-center justify-center'>
        <div className='text-lg text-red-500'>Failed to load user data</div>
      </div>
    );
  }

  const fullName = `${userData.firstName} ${userData.lastName}`.trim();

  return (
    <div className='h-full w-full bg-white flex flex-col'>
      <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden mb-2'>
        <button 
          type="button" 
          className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft />
        </button>
        <h2 className='text-xl font-medium w-full'>User Profile</h2>
        <button 
          type="button" 
          className='px-3 pr-2 py-2 rounded-md hover:bg-[#8884d8] focus:bg-customViolet focus:text-white flex items-center gap-1'
          onClick={() => setEditInfo(!editInfo)}
        >
          {editInfo ? 'Cancel' : 'Edit'} <HiPencil className='text-lg'/>
        </button>
      </div>

      {message && (
        <div className={`mx-5 mb-3 p-3 rounded-lg ${
          message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className='h-full w-full flex flex-col overflow-y-auto'>
        {/* Profile Section with First Image */}
        <div className='w-full flex px-5 pb-5 gap-3 items-center'>
          <div className='relative'>
            <span className='h-20 w-20 rounded-full bg-neutral-500 flex items-center justify-center overflow-hidden'>
              {userData.profilePicture ? (
                <img 
                  src={userData.profilePicture} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white text-lg">
                  {userData.firstName?.[0]}{userData.lastName?.[0]}
                </span>
              )}
            </span>
            {editInfo && (
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            )}
          </div>
          <span className='flex flex-col'>
            <h3 className='font-medium text-lg'>{fullName || 'User'}</h3>
            <p className='text-sm'>{userData.unit}</p>
          </span>
        </div>

        <div className='grid grid-cols-6 px-5 gap-3 gap-y-1'>
          {/* Personal Information Section */}
          <h4 className='col-span-full font-medium text-customViolet'>Personal Information</h4>
          
          <span className='col-span-2 flex flex-col'>
            <label htmlFor="gender" className='text-sm'>Gender</label>
            <input 
              type="text" 
              id="gender"
              value={userData.sex || ''}
              onChange={(e) => setUserData({...userData, sex: e.target.value})}
              className={`w-full p-2 px-4 rounded-lg ${editInfo ? 'border border-customViolet' : 'bg-neutral-200'}`} 
              disabled={!editInfo}
            />
          </span>
          
          <span className='col-span-3 flex flex-col'>
            <label htmlFor="birthday" className='text-sm'>Birthday</label>
            <input 
              type="date" 
              id="birthday"
              value={userData.bday || ''}
              onChange={(e) => setUserData({...userData, bday: e.target.value})}
              className={`w-full p-2 px-4 rounded-lg ${editInfo ? 'border border-customViolet' : 'bg-neutral-200'}`} 
              disabled={!editInfo}
            />
          </span>
          
          <span className='col-span-1 flex flex-col'>
            <label htmlFor="age" className='text-sm'>Age</label>
            <input 
              type="text" 
              id="age"
              value={userData.age || ''}
              className='w-full p-2 px-4 rounded-lg bg-neutral-200'
              disabled
            />
          </span>

          {/* Contact Section */}
          <h4 className='col-span-full font-medium text-customViolet mt-5'>Contact</h4>
          
          <span className='col-span-3 flex flex-col'>
            <label htmlFor="firstNumber" className='text-sm'>Phone Number</label>
            <input 
              type="text" 
              id="firstNumber"
              value={userData.firstNumber || ''}
              onChange={(e) => setUserData({...userData, firstNumber: e.target.value})}
              className={`w-full p-2 px-4 rounded-lg ${editInfo ? 'border border-customViolet' : 'bg-neutral-200'}`} 
              disabled={!editInfo}
            />
          </span>
          
          <span className='col-span-3 flex flex-col'>
            <label htmlFor="secondNumber" className='text-sm'>2nd Phone Number</label>
            <input 
              type="text" 
              id="secondNumber"
              value={userData.secondNumber || ''}
              onChange={(e) => setUserData({...userData, secondNumber: e.target.value})}
              className={`w-full p-2 px-4 rounded-lg ${editInfo ? 'border border-customViolet' : 'bg-neutral-200'}`} 
              disabled={!editInfo}
            />
          </span>
          
          <span className='col-span-full flex flex-col mt-2'>
            <label htmlFor="email" className='text-sm'>Email Address</label>
            <input 
              type="email" 
              id="email"
              value={userData.email || ''}
              onChange={(e) => setUserData({...userData, email: e.target.value})}
              className={`w-full p-2 px-4 rounded-lg ${editInfo ? 'border border-customViolet' : 'bg-neutral-200'}`} 
              disabled={!editInfo}
            />
          </span>

          {/* Unit Information Section */}
          <h4 className='col-span-full font-medium text-customViolet mt-5'>Unit Information</h4>
          
          <span className='col-span-3 flex flex-col'>
            <label htmlFor="rent" className='text-sm'>Rent Amount</label>
            <input 
              type="text" 
              id="rent"
              value={userData.rent}
              className='w-full p-2 px-4 rounded-lg bg-neutral-200'
              disabled
            />
          </span>
          
          <span className='col-span-3 flex flex-col'>
            <label htmlFor="residencyPeriod" className='text-sm'>Residency Period</label>
            <input 
              type="text" 
              id="residencyPeriod"
              value={userData.residencyPeriod}
              className='w-full p-2 px-4 rounded-lg bg-neutral-200'
              disabled
            />
          </span>

          {/* Credentials Section with Next Two Images */}
          <h4 className='col-span-full font-medium text-customViolet mt-5'>Credentials</h4>
          
          {/* PHILSYS ID - Second Image */}
          <div className='col-span-3 flex flex-col'>
            <label className='text-sm'>PHILSYS ID</label>
            <div className='w-full aspect-square rounded-lg bg-neutral-200 flex items-center justify-center overflow-hidden'>
              {userData.credentialImages[0] ? (
                <img 
                  src={userData.credentialImages[0].url} 
                  alt="PHILSYS ID" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-gray-500">No ID submitted</span>
              )}
            </div>
          </div>
          
          {/* DRIVER'S LICENSE - Third Image */}
          <div className='col-span-3 flex flex-col'>
            <label className='text-sm'>DRIVER'S LICENSE</label>
            <div className='w-full aspect-square rounded-lg bg-neutral-200 flex items-center justify-center overflow-hidden'>
              {userData.credentialImages[1] ? (
                <img 
                  src={userData.credentialImages[1].url} 
                  alt="Driver's License" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-gray-500">No ID submitted</span>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <h4 className='col-span-full font-medium text-customViolet mt-5'>Documents</h4>
          
          <div className='col-span-3 flex flex-col'>
            <label className='text-sm'>Rental Agreement</label>
            <div className='w-full aspect-square rounded-lg bg-neutral-200 flex items-center justify-center'>
              <span className="text-gray-500">View Only</span>
            </div>
          </div>
          
          <div className='col-span-3 flex flex-col'>
            <label className='text-sm'>Rules and Regulations</label>
            <div className='w-full aspect-square rounded-lg bg-neutral-200 flex items-center justify-center'>
              <span className="text-gray-500">View Only</span>
            </div>
          </div>

          {/* Security Section */}
          <h4 className='col-span-full font-medium text-customViolet mt-5'>Security</h4>
          
          <span className='col-span-full flex flex-col'>
            <label htmlFor="currentPassword" className='text-sm'>Current Password</label>
            <input 
              type="password" 
              id="currentPassword"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              className='w-full p-2 px-4 rounded-lg border border-gray-300'
            />
          </span>
          
          <span className='col-span-full flex flex-col my-1.5'>
            <label htmlFor="newPassword" className='text-sm'>Change Password</label>
            <input 
              type="password" 
              id="newPassword"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className='w-full p-2 px-4 rounded-lg border border-gray-300'
            />
          </span>
          
          <span className='col-span-full flex flex-col'>
            <label htmlFor="confirmPassword" className='text-sm'>Confirm New Password</label>
            <input 
              type="password" 
              id="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className='w-full p-2 px-4 rounded-lg border border-gray-300'
            />
          </span>

          {/* Action Buttons */}
          <div className='col-span-2 flex flex-col'>
            <button 
              type="button" 
              className={`${editInfo ? 'block' : 'hidden'} mt-10 py-3 rounded-lg border border-customViolet focus:border-transparent focus:bg-[#8884d8] hover:bg-customViolet hover:text-white ease-out duration-200`}
              onClick={handleCancelEdit}
            >
              CANCEL
            </button>
          </div>
          
          <div className='col-span-4 flex flex-col mb-2'>
            <button 
              type="button" 
              className={`${editInfo ? 'block' : 'hidden'} mt-10 py-3 rounded-lg border border-rose-500 text-rose-500 focus:border-transparent focus:bg-rose-500 hover:bg-rose-300 hover:text-white ease-out duration-200 disabled:opacity-50`}
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? 'SAVING...' : 'CONFIRM CHANGES'}
            </button>
          </div>

          <div className='col-span-full flex flex-col mb-2'>
            <button 
              type="button" 
              className='py-3 rounded-lg border border-green-500 text-green-500 focus:border-transparent focus:bg-green-500 hover:bg-green-500 hover:text-white ease-out duration-200 disabled:opacity-50'
              onClick={handleChangePassword}
              disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            >
              {saving ? 'CHANGING PASSWORD...' : 'CHANGE PASSWORD'}
            </button>
          </div>

          <div className='col-span-full flex flex-col'>
            <button 
              type="button" 
              className='py-3 rounded-lg border border-customViolet focus:border-transparent focus:bg-[#8884d8] hover:bg-customViolet hover:text-white ease-out duration-200 disabled:opacity-50'
              onClick={handleLogout}
              disabled={logoutLoading}
            >
              {logoutLoading ? 'LOGGING OUT...' : 'LOG OUT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfile