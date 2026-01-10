import { SetPageProps, NotificationData } from '@/types'
import React, { useState, useEffect } from 'react'
import { HiOutlineChevronLeft, HiOutlineBell } from 'react-icons/hi'
import { useSession } from 'next-auth/react'
import NotifSlip from './NotifSlip';

const Notif = ({setPage}: SetPageProps) => {
  const { data: session } = useSession();
  const [activeFilter, setActiveFilter] = useState("All");
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const Filters = ["All", "Unread", "Messages", "Alerts", "Maintenance", "Payments"];

  // Fetch notifications
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
    }
  }, [session]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications');
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      
      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.notificationId === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const groups: Record<string, NotificationData[]> = {
      'Today': [],
      'Yesterday': [],
      'This week': [],
      'Last week': [],
      'Older': []
    };

    notifications.forEach(notif => {
      const notifDate = new Date(notif.createdAt);
      
      if (notifDate >= today) {
        groups['Today'].push(notif);
      } else if (notifDate >= yesterday) {
        groups['Yesterday'].push(notif);
      } else if (notifDate >= weekAgo) {
        groups['This week'].push(notif);
      } else if (notifDate >= twoWeeksAgo) {
        groups['Last week'].push(notif);
      } else {
        groups['Older'].push(notif);
      }
    });

    return groups;
  };

  // Filter notifications based on active filter
  const filterNotifications = (notifs: NotificationData[]) => {
    switch (activeFilter) {
      case 'Unread':
        return notifs.filter(n => !n.isRead);
      case 'Messages':
        return notifs.filter(n => n.type.toLowerCase().includes('message'));
      case 'Alerts':
        return notifs.filter(n => 
          n.type.includes('overdue') || 
          n.type.includes('alert') || 
          n.type.includes('warning')
        );
      case 'Maintenance':
        return notifs.filter(n => 
          n.type.toLowerCase().includes('maintenance') || 
          n.type.toLowerCase().includes('repair')
        );
      case 'Payments':
        return notifs.filter(n => 
          n.type.includes('payment') || 
          n.type.includes('billing') || 
          n.type.includes('rent')
        );
      default:
        return notifs;
    }
  };

  // Map notification type to icon
  const getNotificationIcon = (type: string): string => {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('message') || lowerType.includes('chat')) {
      return 'Message';
    } else if (lowerType.includes('overdue') || lowerType.includes('alert') || lowerType.includes('warning')) {
      return 'Alert';
    } else if (lowerType.includes('maintenance') || lowerType.includes('repair') || lowerType.includes('tool')) {
      return 'Tool';
    } else if (lowerType.includes('payment') || lowerType.includes('billing') || lowerType.includes('rent') || lowerType.includes('money')) {
      return 'Money';
    }
    
    return 'Alert';
  };

  // Get relative time
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

  const groupedNotifications = groupNotificationsByDate();
  const filteredGroups = Object.entries(groupedNotifications).map(([date, notifs]) => ({
    date,
    notifications: filterNotifications(notifs)
  })).filter(group => group.notifications.length > 0);

  return (
    <div className='h-full w-full flex flex-col relative bg-gray-50 lg:bg-transparent'>
      {/* Sticky Header */}
      <div className='sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm rounded-b-[2rem] lg:hidden'>
        <div className='flex items-center gap-4'>
          <button 
            type="button" 
            className='p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors'
            onClick={() => setPage(0)}
          >
            <HiOutlineChevronLeft className='text-2xl' />
          </button>
          <h2 className='text-xl font-bold text-gray-800'>Notifications</h2>
        </div>
        <div className='p-2 rounded-full bg-customViolet/10 text-customViolet'>
          <HiOutlineBell className='text-xl' />
        </div>
      </div>

      {/* Desktop Header */}
      <div className='hidden lg:flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-2xl font-bold text-gray-800'>Notifications</h2>
          <p className='text-gray-500'>Stay updated with your latest activities {unreadCount > 0 && `• ${unreadCount} unread`}</p>
        </div>
        <div className='p-3 rounded-2xl bg-white shadow-sm border border-gray-100 text-customViolet relative'>
          <HiOutlineBell className='text-2xl' />
          {unreadCount > 0 && (
            <span className='absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className='w-full px-6 py-4 lg:px-0 lg:py-0 lg:mb-6 overflow-x-auto no-scrollbar'>
        <div className='flex items-center gap-3 min-w-max'>
          {Filters.map((val, i) => (
            <button 
              key={`filter-button_${i}`}
              type="button" 
              onClick={() => setActiveFilter(val)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeFilter === val
                  ? 'bg-customViolet text-white shadow-lg shadow-customViolet/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className='flex-1 overflow-y-auto px-6 pb-6 lg:px-0 lg:overflow-visible space-y-6'>
        {loading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-customViolet'></div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <div className='p-4 rounded-full bg-gray-100 text-gray-400 mb-4'>
              <HiOutlineBell className='text-4xl' />
            </div>
            <h3 className='text-lg font-semibold text-gray-700 mb-2'>No notifications</h3>
            <p className='text-gray-500 text-sm'>
              {activeFilter === 'All' 
                ? "You're all caught up!" 
                : `No ${activeFilter.toLowerCase()} notifications`}
            </p>
          </div>
        ) : (
          filteredGroups.map((group, i) => (
            <div key={i} className='flex flex-col gap-3'>
              <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider ml-1'>
                {group.date}
              </h3>
              <div className='flex flex-col gap-3 lg:grid lg:grid-cols-2'>
                {group.notifications.map((notification) => (
                  <NotifSlip 
                    key={notification.notificationId}
                    notificationId={notification.notificationId}
                    icon={getNotificationIcon(notification.type)}
                    message={notification.message}
                    time={getRelativeTime(notification.createdAt)}
                    isRead={notification.isRead}
                    relatedId={notification.relatedId}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notif
