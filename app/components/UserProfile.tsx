"use client";

import { SetPageProps } from '@/types'
import React, { useState, useEffect } from 'react'
import { HiOutlineChevronLeft, HiPencil, HiOutlinePaperClip, HiOutlineLogout, HiOutlineKey, HiOutlineShieldCheck, HiOutlineDocumentText, HiOutlineUser } from 'react-icons/hi'
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
  signedContractUrl?: string | null;
  signedRulesUrl?: string | null;
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
  const [previewItem, setPreviewItem] = useState<{
    url: string;
    downloadUrl: string;
    title: string;
    type: 'image' | 'document';
  } | null>(null);

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
      // Call logout endpoint to update isOnline status
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user-preference');
      await signOut({ 
        redirect: false,
        callbackUrl: '/auth/login'
      });
      setUserData(null);
      router.push('/auth/login');
    } catch (error) {
      console.error('Error during logout:', error);
      setMessage('Error during logout');
      setLogoutLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditInfo(false);
    fetchUserData();
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const normalizePreviewUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'github.com') {
        const segments = parsed.pathname.split('/').filter(Boolean);
        const blobIndex = segments.indexOf('blob');
        if (blobIndex !== -1 && segments.length > blobIndex + 2) {
          const owner = segments[0];
          const repo = segments[1];
          const branch = segments[blobIndex + 1];
          const filePath = segments.slice(blobIndex + 2).join('/');
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        }
      }
      return url;
    } catch {
      return url;
    }
  };

  const handlePreviewDocument = (url?: string | null, title?: string) => {
    if (!url) return;

    const normalizedUrl = normalizePreviewUrl(url);
    const lower = normalizedUrl.toLowerCase();
    const isImage =
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp');

    const previewUrl = isImage
      ? normalizedUrl
      : `/api/documents/preview?url=${encodeURIComponent(normalizedUrl)}`;

    setPreviewItem({
      url: previewUrl,
      downloadUrl: normalizedUrl,
      title: title || 'Preview',
      type: isImage ? 'image' : 'document',
    });
  };

  if (loading) {
    return (
      <div className='h-full w-full bg-gray-50 flex items-center justify-center'>
        <div className='animate-pulse flex flex-col items-center gap-4'>
          <div className='h-12 w-12 rounded-full bg-customViolet/20'></div>
          <div className='text-customViolet font-medium'>Loading Profile...</div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className='h-full w-full bg-gray-50 flex items-center justify-center'>
        <div className='text-lg text-rose-500 font-medium'>Failed to load user data</div>
      </div>
    );
  }

  const fullName = `${userData.firstName} ${userData.lastName}`.trim();

  return (
    <div className='h-full w-full bg-gray-50 flex flex-col relative'>
      {/* Header */}
      <div className='sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm'>
        <div className='flex items-center gap-4'>
          <button 
            type="button" 
            className='p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors'
            onClick={() => setPage(0)}
          >
            <HiOutlineChevronLeft className='text-2xl' />
          </button>
          <h2 className='text-xl font-bold text-gray-800'>My Profile</h2>
        </div>
        <button 
          type="button" 
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            editInfo 
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
              : 'bg-customViolet/10 text-customViolet hover:bg-customViolet/20'
          }`}
          onClick={() => editInfo ? handleCancelEdit() : setEditInfo(true)}
        >
          {editInfo ? 'Cancel' : 'Edit'} <HiPencil className='text-lg'/>
        </button>
      </div>

      {message && (
        <div className={`mx-6 mt-4 p-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
          message.includes('success') 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : 'bg-rose-50 text-rose-600 border border-rose-100'
        }`}>
          {message}
        </div>
      )}

      <div className='flex-1 overflow-y-auto p-6'>
        <div className='flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6'>
          {/* Profile Header Card */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center gap-6 lg:col-span-4 lg:flex-col lg:text-center lg:h-fit'>
            <div className='relative group'>
              <div className='h-24 w-24 rounded-full bg-gray-100 ring-4 ring-white shadow-lg overflow-hidden flex items-center justify-center lg:h-32 lg:w-32'>
                {userData.profilePicture ? (
                  <img 
                    src={userData.profilePicture} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-customViolet">
                    {userData.firstName?.[0]}{userData.lastName?.[0]}
                  </span>
                )}
              </div>
              {editInfo && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <HiPencil className="text-white text-xl" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className='flex flex-col lg:items-center'>
              <h3 className='text-2xl font-bold text-gray-800'>{fullName || 'User'}</h3>
              <p className='text-gray-500 font-medium'>{userData.unit}</p>
              <div className='mt-2 flex items-center gap-2 text-xs font-medium text-customViolet bg-customViolet/5 px-3 py-1 rounded-full w-fit'>
                <HiOutlineUser /> Tenant
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-8'>
            <div className='flex items-center gap-2 mb-6'>
              <div className='p-2 rounded-xl bg-customViolet/10 text-customViolet'>
                <HiOutlineUser className='text-xl' />
              </div>
              <h4 className='text-lg font-bold text-gray-800'>Personal Information</h4>
            </div>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Gender</label>
                <input 
                  type="text" 
                  value={userData.sex || ''}
                  onChange={(e) => setUserData({...userData, sex: e.target.value})}
                  className={`w-full p-3 rounded-xl transition-all ${
                    editInfo 
                      ? 'bg-white border-2 border-customViolet/20 focus:border-customViolet outline-none' 
                      : 'bg-gray-50 border-transparent text-gray-600'
                  }`} 
                  disabled={!editInfo}
                />
              </div>
              
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Birthday</label>
                <input 
                  type="date" 
                  value={userData.bday || ''}
                  onChange={(e) => setUserData({...userData, bday: e.target.value})}
                  className={`w-full p-3 rounded-xl transition-all ${
                    editInfo 
                      ? 'bg-white border-2 border-customViolet/20 focus:border-customViolet outline-none' 
                      : 'bg-gray-50 border-transparent text-gray-600'
                  }`} 
                  disabled={!editInfo}
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Age</label>
                <input 
                  type="text" 
                  value={userData.age || ''}
                  className='w-full p-3 rounded-xl bg-gray-50 border-transparent text-gray-600'
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-6'>
            <div className='flex items-center gap-2 mb-6'>
              <div className='p-2 rounded-xl bg-blue-50 text-blue-600'>
                <HiOutlineDocumentText className='text-xl' />
              </div>
              <h4 className='text-lg font-bold text-gray-800'>Contact Details</h4>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Phone Number</label>
                <input 
                  type="text" 
                  value={userData.firstNumber || ''}
                  onChange={(e) => setUserData({...userData, firstNumber: e.target.value})}
                  className={`w-full p-3 rounded-[1.5rem] transition-all ${
                    editInfo 
                      ? 'bg-white border-2 border-customViolet/20 focus:border-customViolet outline-none' 
                      : 'bg-gray-50 border-transparent text-gray-600'
                  }`} 
                  disabled={!editInfo}
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Secondary Phone</label>
                <input 
                  type="text" 
                  value={userData.secondNumber || ''}
                  onChange={(e) => setUserData({...userData, secondNumber: e.target.value})}
                  className={`w-full p-3 rounded-[1.5rem] transition-all ${
                    editInfo 
                      ? 'bg-white border-2 border-customViolet/20 focus:border-customViolet outline-none' 
                      : 'bg-gray-50 border-transparent text-gray-600'
                  }`} 
                  disabled={!editInfo}
                />
              </div>

              <div className='col-span-full space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Email Address</label>
                <input 
                  type="email" 
                  value={userData.email || ''}
                  onChange={(e) => setUserData({...userData, email: e.target.value})}
                  className={`w-full p-3 rounded-[1.5rem] transition-all ${
                    editInfo 
                      ? 'bg-white border-2 border-customViolet/20 focus:border-customViolet outline-none' 
                      : 'bg-gray-50 border-transparent text-gray-600'
                  }`} 
                  disabled={!editInfo}
                />
              </div>
            </div>
          </div>

          {/* Unit Information */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-6'>
            <div className='flex items-center gap-2 mb-6'>
              <div className='p-2 rounded-xl bg-purple-50 text-purple-600'>
                <HiOutlineKey className='text-xl' />
              </div>
              <h4 className='text-lg font-bold text-gray-800'>Unit Details</h4>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Monthly Rent</label>
                <input 
                  type="text" 
                  value={userData.rent}
                  className='w-full p-3 rounded-[1.5rem] bg-gray-50 border-transparent text-gray-600 font-medium'
                  disabled
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Residency Period</label>
                <input 
                  type="text" 
                  value={userData.residencyPeriod}
                  className='w-full p-3 rounded-[1.5rem] bg-gray-50 border-transparent text-gray-600 font-medium'
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Credentials & Documents */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-8'>
            <div className='flex items-center gap-2 mb-6'>
              <div className='p-2 rounded-xl bg-orange-50 text-orange-600'>
                <HiOutlineShieldCheck className='text-xl' />
              </div>
              <h4 className='text-lg font-bold text-gray-800'>Credentials & Documents</h4>
            </div>

            <div className='grid grid-cols-2 gap-4 mb-6'>
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>PhilSys ID</label>
                <div className='aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:border-customViolet/50 transition-colors cursor-pointer group'>
                  {userData.credentialImages[0] ? (
                    <button
                      type="button"
                      className="h-full w-full relative"
                      onClick={() => handlePreviewDocument(userData.credentialImages[0].url, 'PHILSYS ID')}
                    >
                      <img 
                        src={userData.credentialImages[0].url} 
                        alt="PHILSYS ID" 
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">No ID</span>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Driver's License</label>
                <div className='aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden hover:border-customViolet/50 transition-colors cursor-pointer group'>
                  {userData.credentialImages[1] ? (
                    <button
                      type="button"
                      className="h-full w-full relative"
                      onClick={() => handlePreviewDocument(userData.credentialImages[1].url, "Driver's License")}
                    >
                      <img 
                        src={userData.credentialImages[1].url} 
                        alt="Driver's License" 
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">No ID</span>
                  )}
                </div>
              </div>
            </div>

            <div className='space-y-3'>
              {userData.signedContractUrl && (
                <div className='flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 rounded-lg bg-white shadow-sm text-customViolet'>
                      <HiOutlinePaperClip />
                    </div>
                    <span className='text-sm font-medium text-gray-700'>Rental Agreement</span>
                  </div>
                  <a
                    href={userData.signedContractUrl}
                    download={'Signed_Contract.pdf'}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-customViolet hover:text-white hover:border-customViolet transition-all"
                  >
                    Download
                  </a>
                </div>
              )}
              
              {userData.signedRulesUrl && (
                <div className='flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 rounded-lg bg-white shadow-sm text-customViolet'>
                      <HiOutlinePaperClip />
                    </div>
                    <span className='text-sm font-medium text-gray-700'>Rules & Regulations</span>
                  </div>
                  <a
                    href={userData.signedRulesUrl}
                    download={'Signed_Rules.pdf'}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-customViolet hover:text-white hover:border-customViolet transition-all"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Security Settings */}
          <div className='bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-4 lg:h-fit'>
            <div className='flex items-center gap-2 mb-6'>
              <div className='p-2 rounded-xl bg-rose-50 text-rose-600'>
                <HiOutlineKey className='text-xl' />
              </div>
              <h4 className='text-lg font-bold text-gray-800'>Security Settings</h4>
            </div>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Current Password</label>
                <input 
                  type="password" 
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className='w-full p-3 rounded-[1.5rem] bg-gray-50 border-transparent focus:bg-white focus:border-customViolet focus:ring-0 transition-all'
                  placeholder="Enter current password"
                />
              </div>
              
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>New Password</label>
                  <input 
                    type="password" 
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className='w-full p-3 rounded-[1.5rem] bg-gray-50 border-transparent focus:bg-white focus:border-customViolet focus:ring-0 transition-all'
                    placeholder="Enter new password"
                  />
                </div>
                
                <div className='space-y-2'>
                  <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>Confirm Password</label>
                  <input 
                    type="password" 
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className='w-full p-3 rounded-[1.5rem] bg-gray-50 border-transparent focus:bg-white focus:border-customViolet focus:ring-0 transition-all'
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button 
                type="button" 
                className='w-full py-3 mt-2 rounded-[1.5rem] bg-gray-800 text-white font-bold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                onClick={handleChangePassword}
                disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {saving ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='space-y-3 pb-6 lg:col-span-12 lg:flex lg:justify-end lg:gap-4 lg:space-y-0'>
            {editInfo && (
              <button 
                type="button" 
                className='w-full lg:w-auto lg:px-8 py-4 rounded-[1.5rem] bg-customViolet text-white font-bold shadow-lg shadow-customViolet/30 hover:shadow-customViolet/50 hover:-translate-y-0.5 transition-all disabled:opacity-50'
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            )}

            <button 
              type="button" 
              className='w-full lg:w-auto lg:px-8 py-4 rounded-[1.5rem] border-2 border-rose-100 text-rose-500 font-bold hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center justify-center gap-2'
              onClick={handleLogout}
              disabled={logoutLoading}
            >
              <HiOutlineLogout className='text-xl' />
              {logoutLoading ? 'Logging out...' : 'Log Out'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200'>
          <div className='bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200'>
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
              <h3 className='font-bold text-gray-800 truncate'>{previewItem.title}</h3>
              <button
                type='button'
                className='p-2 rounded-full hover:bg-gray-100 transition-colors'
                onClick={() => setPreviewItem(null)}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className='flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4'>
              {previewItem.type === 'image' ? (
                <img
                  src={previewItem.url}
                  alt={previewItem.title}
                  className='max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm'
                />
              ) : (
                <iframe
                  src={previewItem.url}
                  title={previewItem.title}
                  className='w-full h-[70vh] border-0 rounded-lg bg-white shadow-sm'
                />
              )}
            </div>
            <div className='px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50'>
              <button
                type='button'
                className='px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors'
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
              <a
                href={previewItem.downloadUrl}
                download
                className='px-4 py-2 rounded-lg bg-customViolet text-white text-sm font-bold shadow-lg shadow-customViolet/20 hover:bg-[#4a3e56] transition-colors'
              >
                Download File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile