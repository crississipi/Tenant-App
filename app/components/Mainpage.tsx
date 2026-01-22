"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { RiArrowRightUpLine, RiBellFill, RiBellLine, RiHistoryLine, RiHomeOfficeFill, RiMessage3Fill, RiMessage3Line, RiToolsFill } from 'react-icons/ri';
import Image from 'next/image';
import { MdOutlineElectricalServices } from 'react-icons/md';
import { FaFaucetDrip } from 'react-icons/fa6';
import { Billing, ChatPage, MaintenancePage, MaintenanceSlip, UserProfile, NavigationSidebar } from '.';
import NotifSlip from './NotifSlip';
import BillingCard from './BillingCard';
import Notif from './Notif';
import Login from './Login';
import { useSession } from 'next-auth/react';
import { NotificationData } from '@/types';

interface ExpenseData {
  month: string;
  total: number;
  elec: number;
  water: number;
  rent: number;
  formattedTotal?: string;
  formattedElec?: string;
  formattedWater?: string;
  formattedRent?: string;
}

interface CurrentMonthExpense {
  totalRent: number;
  totalWater: number;
  totalElectric: number;
  totalAmount: number;
  month?: string;
  formattedRent?: string;
  formattedWater?: string;
  formattedElectric?: string;
  formattedTotal?: string;
}

const completedStatuses = new Set(['completed', 'resolved', 'closed', 'done']);
const severityMap: Record<string, string> = {
  low: 'low',
  medium: 'mid',
  high: 'high',
  critical: 'crit'
};

interface MaintenanceTimelineStatus {
  status: string;
  statusDate: string;
}

interface MaintenanceRequestRecord {
  maintenanceId: number;
  title?: string | null;
  rawRequest: string;
  processedRequest: string;
  urgency: string;
  status: string;
  schedule?: string | null;
  dateIssued: string;
  updatedAt?: string;
  documentations?: { documentation: string; dateIssued: string }[];
  availabilities?: { date?: string | null; timeAvailableFrom?: string | null }[];
}

const formatTimeAgo = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatFullDate = (value?: string | null) => {
  if (!value) return 'TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBA';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const parseDocumentation = (request: MaintenanceRequestRecord) => {
  const doc = request.documentations?.[0]?.documentation;
  if (!doc) return null;
  try {
    return JSON.parse(doc);
  } catch {
    return null;
  }
};

const getPreviewTitle = (request: MaintenanceRequestRecord) => {
  if (request.title && request.title.trim()) {
    return request.title.trim();
  }
  const parsedDoc = parseDocumentation(request);
  const textCandidate =
    parsedDoc?.userDescription ||
    parsedDoc?.processedRequest ||
    request.processedRequest ||
    request.rawRequest;

  return textCandidate || `Maintenance #${request.maintenanceId}`;
};

const buildIssueDescription = (request: MaintenanceRequestRecord, limit = 140) => {
  const parsedDoc = parseDocumentation(request);
  const description = parsedDoc?.processedRequest || request.processedRequest || request.rawRequest;
  if (!description) return 'Maintenance request submitted.';
  if (description.length <= limit) return description;
  return `${description.slice(0, limit - 3)}...`;
};

const buildStatusTimeline = (request: MaintenanceRequestRecord): MaintenanceTimelineStatus[] => {
  const timeline: MaintenanceTimelineStatus[] = [
    {
      status: 'Sent',
      statusDate: formatFullDate(request.dateIssued)
    }
  ];

  if (request.status) {
    timeline.push({
      status: request.status,
      statusDate: formatFullDate(request.updatedAt || request.dateIssued)
    });
  }

  if (request.schedule) {
    timeline.push({
      status: 'Scheduled',
      statusDate: formatFullDate(request.schedule)
    });
  } else if (request.availabilities && request.availabilities.length > 0) {
    const firstAvailability = request.availabilities[0];
    timeline.push({
      status: 'Scheduled',
      statusDate: formatFullDate(firstAvailability.date || firstAvailability.timeAvailableFrom)
    });
  }

  return timeline;
};

const extractImageUrls = (request: MaintenanceRequestRecord) => {
  const parsedDoc = parseDocumentation(request);
  const uploadedFiles = parsedDoc?.uploadedFiles;
  if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
    return uploadedFiles.filter((url: string) => typeof url === 'string' && url.trim().length > 0);
  }
  return [];
};

const mapUrgencyToSeverity = (urgency?: string) => severityMap[urgency?.toLowerCase() || 'medium'] || 'mid';

const Mainpage = () => {
  const [page, setPage] = useState(0);
  const { data: session, status } = useSession();
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [currentMonthExpense, setCurrentMonthExpense] = useState<CurrentMonthExpense | null>(null);
  const [pastExpenses, setPastExpenses] = useState<ExpenseData[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [hasExpenses, setHasExpenses] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchMaintenanceRequests = useCallback(async () => {
    if (!session?.user?.id) return;
    setMaintenanceLoading(true);
    setMaintenanceError(null);
    try {
      const response = await fetch(`/api/maintenance?userId=${session.user.id}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to load maintenance requests.');
      }
      setMaintenanceRequests(payload.maintenanceRequests || []);
    } catch (error) {
      console.error('Failed to fetch maintenance requests:', error);
      setMaintenanceError(error instanceof Error ? error.message : 'Unexpected error occurred.');
    } finally {
      setMaintenanceLoading(false);
    }
  }, [session?.user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=4');
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [session?.user?.id]);

  const fetchExpenses = useCallback(async () => {
    if (!session?.user?.id) return;
    setExpensesLoading(true);
    try {
      const response = await fetch('/api/expenses?months=3');
      const data = await response.json();
      if (data.success) {
        setHasExpenses(data.hasExpenses);
        if (data.hasExpenses) {
          setCurrentMonthExpense(data.currentMonth);
          setPastExpenses(data.pastExpenses);
        } else {
          setCurrentMonthExpense(null);
          setPastExpenses([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      setHasExpenses(false);
    } finally {
      setExpensesLoading(false);
    }
  }, [session?.user?.id]);

  const fetchUnreadMessages = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        const totalUnread = data.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0);
        setUnreadMessages(totalUnread);
      }
    } catch (error) {
      console.error('Failed to fetch unread messages:', error);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMaintenanceRequests();
      fetchNotifications();
      fetchExpenses();
      fetchUnreadMessages();
    }
  }, [status, fetchMaintenanceRequests, fetchNotifications, fetchExpenses, fetchUnreadMessages]);

  // Poll for unread messages every 5 seconds
  useEffect(() => {
    if (status !== 'authenticated') return;
    
    const interval = setInterval(fetchUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, [status, fetchUnreadMessages]);

  // Clear unread count when opening messages page
  useEffect(() => {
    if (page === 2 && unreadMessages > 0) {
      setUnreadMessages(0);
    }
  }, [page, unreadMessages]);

  const pendingRequests = useMemo(
    () => maintenanceRequests.filter(request => !completedStatuses.has(request.status?.toLowerCase())).slice(0, 3),
    [maintenanceRequests]
  );

  const completedRequests = useMemo(
    () => maintenanceRequests.filter(request => completedStatuses.has(request.status?.toLowerCase())).slice(0, 3),
    [maintenanceRequests]
  );

  const getNotificationIcon = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('message') || lowerType.includes('chat')) return 'Message';
    if (lowerType.includes('overdue') || lowerType.includes('alert') || lowerType.includes('warning')) return 'Alert';
    if (lowerType.includes('maintenance') || lowerType.includes('repair') || lowerType.includes('tool')) return 'Tool';
    if (lowerType.includes('payment') || lowerType.includes('billing') || lowerType.includes('rent') || lowerType.includes('money')) return 'Money';
    return 'Alert';
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const emptyPendingPreview = (
    <div className='w-full flex flex-col px-6 py-8 text-neutral-500 gap-3 rounded-[2rem] items-center justify-center text-center bg-gray-50/50 border border-dashed border-gray-200'>
      <p className='w-full text-sm'>You currently do not have any pending maintenance request.</p>
      <button 
        type="button" 
        className='w-max items-center flex px-5 py-2.5 rounded-full bg-customViolet text-white text-sm font-medium shadow-lg shadow-customViolet/20 hover:shadow-customViolet/40 active:scale-95 transition-all duration-300 gap-2'
        onClick={() => setPage(6)}
      >
        <RiToolsFill className='text-lg'/>
        Submit Request
      </button>
    </div>
  );

  const emptyCompletedPreview = (
    <div className='w-full flex flex-col px-6 py-8 text-neutral-500 gap-2 rounded-[2rem] items-center justify-center text-center bg-gray-50/50 border border-dashed border-gray-200'>
      <p className='w-full text-sm'>No recently completed requests. Once resolved, they will appear here.</p>
    </div>
  );

  const renderMaintenancePreview = (
    items: MaintenanceRequestRecord[],
    emptyContent: React.ReactNode
  ) => {
    if (maintenanceLoading) {
      return (
        <div className='w-full flex items-center justify-center py-10 text-sm text-neutral-500 gap-2'>
          <div className='animate-spin rounded-full h-5 w-5 border-2 border-customViolet border-t-transparent'></div>
          <span>Loading requests...</span>
        </div>
      );
    }

    if (maintenanceError) {
      return (
        <div className='w-full flex flex-col items-center justify-center py-6 text-center gap-2 text-rose-500 text-sm'>
          <p>{maintenanceError}</p>
          <button
            type="button"
            onClick={fetchMaintenanceRequests}
            className='px-4 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors'
          >
            Retry
          </button>
        </div>
      );
    }

    if (items.length === 0) {
      return emptyContent;
    }

    return items.map(request => (
      <MaintenanceSlip
        key={request.maintenanceId}
        title={getPreviewTitle(request)}
        desc={buildIssueDescription(request)}
        stat={buildStatusTimeline(request)}
        dateSubmitted={formatTimeAgo(request.dateIssued)}
        severity={mapUrgencyToSeverity(request.urgency)}
        images={extractImageUrls(request)}
      />
    ));
  };

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className='h-full w-full flex flex-col bg-neutral-50 items-center justify-center'>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-customViolet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading...</p>
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
    <div className='h-screen w-screen flex bg-[#F5F5F7] overflow-hidden select-none'>
      {/* Sidebar for Desktop */}
      <NavigationSidebar setPage={setPage} currentPage={page} />

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col h-full relative overflow-hidden'>
        
        {/* Mobile Header - Hidden on LG */}
        <div className='lg:hidden sticky top-0 z-50 w-full flex bg-white/80 backdrop-blur-xl shadow-sm border-b border-white/20 rounded-b-[2rem] px-2 shrink-0'>
          <button 
            className='w-full h-20 flex items-center px-4 gap-4 hover:bg-white/50 rounded-[2rem] transition-all duration-300 group'
            onClick={() => setPage(4)}
          >
            <div className='relative'>
              <span className='h-12 w-12 block rounded-full overflow-hidden bg-gray-100 ring-2 ring-white shadow-md group-hover:scale-105 transition-transform duration-300'>
                <Image
                  height={500}
                  width={500}
                  src='/profile-template.png'
                  alt='profile template'
                  className='h-full w-full object-cover'
                />
              </span>
              <span className='absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-400 border-2 border-white rounded-full'></span>
            </div>
            <span className='flex flex-col items-start'>
              <h1 className='font-bold text-base text-gray-800 group-hover:text-customViolet transition-colors'>
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.name || 'User'
                }
              </h1>
              <h2 className='text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>Unit 101</h2>
            </span>
          </button>
          <div className='h-full flex items-center pr-4'>
            <button 
              type="button" 
              className='h-10 w-10 flex items-center justify-center text-2xl text-customViolet hover:bg-customViolet/10 rounded-full transition-all duration-300 relative active:scale-95'
              onClick={() => setPage(2)}
            >
              <RiMessage3Line />
              {unreadMessages > 0 && (
                <span className='h-2.5 w-2.5 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white animate-pulse'></span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop Header / Top Bar */}
        <div className='hidden lg:flex w-full h-16 bg-white border-b border-gray-200 items-center justify-between px-8 shrink-0'>
           <h1 className='text-xl font-bold text-gray-800'>
             {page === 0 && 'Dashboard'}
             {page === 1 && 'Billing History'}
             {page === 2 && 'Messages'}
             {page === 3 && 'Notifications'}
             {page === 4 && 'My Profile'}
             {page === 5 && 'Maintenance'}
           </h1>
           <div className='flex items-center gap-4'>
              <div className='flex flex-col items-end'>
                 <span className='font-semibold text-sm text-gray-700'>
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name || 'User'}
                 </span>
                 <span className='text-xs text-gray-500'>Unit 101</span>
              </div>
              <div className='h-10 w-10 rounded-full overflow-hidden bg-gray-100 ring-2 ring-gray-100'>
                 <Image
                    height={100}
                    width={100}
                    src='/profile-template.png'
                    alt='profile'
                    className='h-full w-full object-cover'
                 />
              </div>
           </div>
        </div>

        {/* Scrollable Content */}
        <div className={`flex-1 ${page === 2 ? 'overflow-hidden' : 'overflow-y-auto'} no-scrollbar p-0 lg:p-8`}>
          <div className={`w-full max-w-7xl mx-auto flex flex-col gap-6 ${page === 2 ? 'h-full pb-0' : 'pb-24 lg:pb-8'}`}>
            
            {/* Logo Watermark - Mobile Only */}
            <div className={`w-full px-5 mt-2 lg:hidden ${page === 2 ? 'hidden' : ''}`}>
              <Image
                height={500}
                width={500}
                src='/logo.png'
                alt='logo'
                className='h-6 w-auto object-contain mx-auto opacity-40 grayscale'
              />
            </div>

            {page === 0 && (
              <>                <div className='flex flex-col w-full px-5 lg:px-0 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500'>
                  {/* Expenses Summary */}
                  <div className='flex justify-between items-end'>
                    <span className='flex flex-col gap-1'>
                      <h3 className='text-xs font-semibold text-gray-400 uppercase tracking-widest'>This Month's Expenses</h3>
                      {expensesLoading ? (
                        <div className='h-12 flex items-center'>
                          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-customViolet'></div>
                        </div>
                      ) : !hasExpenses ? (
                        <h4 className='text-gray-400 text-2xl font-semibold'>₱0.00</h4>
                      ) : (
                        <h4 className='text-customViolet text-4xl font-bold tracking-tighter drop-shadow-sm'>
                          <span className='text-2xl mr-1 font-medium text-gray-400 align-top mt-1 inline-block'>₱</span>
                          {currentMonthExpense?.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </h4>
                      )}
                    </span>
                    <button 
                      type='button' 
                      className='flex py-2.5 px-5 items-center gap-2 bg-white rounded-full text-xs font-semibold text-customViolet shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300'
                      onClick={() => setPage(1)}
                    >
                      <RiHistoryLine className='text-lg'/>
                      History
                    </button>
                  </div>
                  
                  {/* Utility Pills */}
                  {expensesLoading ? (
                    <div className='w-full flex items-center justify-center py-8'>
                      <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-customViolet'></div>
                    </div>
                  ) : !hasExpenses ? (
                    <div className='w-full py-8 px-6 bg-white rounded-[2rem] border border-dashed border-gray-200 text-center'>
                      <p className='text-gray-400 text-sm'>You have no existing expenses</p>
                    </div>
                  ) : (
                    <div className='w-full flex items-center gap-3 justify-start overflow-x-auto no-scrollbar py-2 mask-linear-fade'>
                      <div className='rounded-[2rem] flex items-center gap-3 pl-2 pr-5 py-2 bg-amber-100 text-amber-600 bg-opacity-50 border border-white/50 shadow-sm min-w-max backdrop-blur-sm'>
                        <span className='p-2.5 rounded-full bg-white shadow-sm text-current'>
                          <MdOutlineElectricalServices className='text-xl'/>
                        </span>
                        <p className='text-sm font-bold text-gray-700'>₱{currentMonthExpense?.totalElectric.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                      </div>
                      <div className='rounded-[2rem] flex items-center gap-3 pl-2 pr-5 py-2 bg-sky-100 text-sky-600 bg-opacity-50 border border-white/50 shadow-sm min-w-max backdrop-blur-sm'>
                        <span className='p-2.5 rounded-full bg-white shadow-sm text-current'>
                          <FaFaucetDrip className='text-xl'/>
                        </span>
                        <p className='text-sm font-bold text-gray-700'>₱{currentMonthExpense?.totalWater.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                      </div>
                      <div className='rounded-[2rem] flex items-center gap-3 pl-2 pr-5 py-2 bg-emerald-100 text-emerald-600 bg-opacity-50 border border-white/50 shadow-sm min-w-max backdrop-blur-sm'>
                        <span className='p-2.5 rounded-full bg-white shadow-sm text-current'>
                          <RiHomeOfficeFill className='text-xl'/>
                        </span>
                        <p className='text-sm font-bold text-gray-700'>₱{currentMonthExpense?.totalRent.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Past Expenses Cards */}
                  {expensesLoading ? (
                    <div className='w-full flex items-center justify-center py-8'>
                      <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-customViolet'></div>
                    </div>
                  ) : !hasExpenses || pastExpenses.length === 0 ? (
                    <div className='w-full py-8 px-6 bg-white rounded-[2rem] border border-dashed border-gray-200 text-center'>
                      <p className='text-gray-400 text-sm'>No past expense records available</p>
                    </div>
                  ) : (
                    <div className='w-full flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3'>
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
                  )}
                </div>

                {/* Notifications Section */}
                <div className='w-full px-5 lg:px-0 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100'>
                  <div className='flex justify-between items-center'>
                    <h2 className='text-lg font-bold text-gray-800 tracking-tight'>Recent Notifications</h2>
                    <button 
                      type="button" 
                      className='text-xs font-semibold text-customViolet flex items-center gap-1 hover:underline decoration-2 underline-offset-4'
                      onClick={() => setPage(3)}
                    >
                      View all <RiArrowRightUpLine />
                    </button>
                  </div>
                  <div className='w-full flex flex-col gap-3 lg:grid lg:grid-cols-2'>
                    {notificationsLoading ? (
                      <div className='col-span-2 flex items-center justify-center py-8 text-sm text-neutral-500 gap-2'>
                        <div className='animate-spin rounded-full h-5 w-5 border-2 border-customViolet border-t-transparent'></div>
                        <span>Loading notifications...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className='col-span-2 flex flex-col items-center justify-center py-8 text-center gap-2 text-neutral-400'>
                        <RiBellLine className='text-3xl' />
                        <p className='text-sm'>No notifications yet. You're all caught up!</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <NotifSlip 
                          key={notification.notificationId}
                          notificationId={notification.notificationId}
                          icon={getNotificationIcon(notification.type)}
                          message={notification.message}
                          time={getRelativeTime(notification.createdAt)}
                          isRead={notification.isRead}
                          relatedId={notification.relatedId}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Maintenance Section */}
                <div className='w-full px-5 lg:px-0 flex flex-col gap-4 pb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200'>
                  <h2 className='text-lg font-bold text-gray-800 tracking-tight'>Maintenance</h2>
                    <div className='w-full flex flex-col lg:flex-row gap-6'>
                      {/* Pending Requests */}
                      <div className='card__style w-full flex flex-col gap-4 lg:flex-1'>
                        <span className='w-full flex items-center justify-between border-b border-gray-100 pb-3'>
                          <h3 className='font-semibold text-gray-700 flex items-center gap-2'>
                            <span className='w-2 h-2 rounded-full bg-amber-400'></span>
                            Pending Requests
                          </h3>
                          <button 
                            type="button" 
                            className='text-xs font-semibold text-customViolet flex items-center gap-1 hover:underline decoration-2 underline-offset-4'
                            onClick={() => setPage(5)}
                          >
                            See all
                          </button>
                        </span>
                        <div className='flex flex-col gap-3'>
                          {renderMaintenancePreview(pendingRequests, emptyPendingPreview)}
                        </div>
                      </div>
                      
                      {/* Completed Requests */}
                      <div className='card__style w-full flex flex-col gap-4 lg:flex-1'>
                        <span className='w-full flex items-center justify-between border-b border-gray-100 pb-3'>
                          <h3 className='font-semibold text-gray-700 flex items-center gap-2'>
                            <span className='w-2 h-2 rounded-full bg-emerald-400'></span>
                            Recently Completed
                          </h3>
                          <button                     
                            type="button" 
                            className='text-xs font-semibold text-customViolet flex items-center gap-1 hover:underline decoration-2 underline-offset-4'
                            onClick={() => setPage(5)}
                          >
                            See all
                          </button>
                        </span>
                        <div className='flex flex-col gap-3'>
                          {renderMaintenancePreview(completedRequests, emptyCompletedPreview)}
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
            {page === 6 && (<MaintenancePage setPage={setPage} autoStart={true} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Mainpage