"use client";

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

export default function OnlineStatusTracker() {
  const { data: session, status } = useSession();
  const hasSetOnline = useRef(false);
  const hasCheckedBilling = useRef(false);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  const updateOnlineStatus = async (isOnline: boolean) => {
    try {
      await fetch('/api/user/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isOnline }),
      });
    } catch (error) {
      console.error('Failed to update online status:', error);
    }
  };

  const checkBillingReminders = async () => {
    try {
      const response = await fetch('/api/billing/check-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Billing check completed:', data.message);
      }
    } catch (error) {
      console.error('Failed to check billing reminders:', error);
    }
  };

  // Set user as online when they first access the app
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasSetOnline.current) {
      hasSetOnline.current = true;
      updateOnlineStatus(true);
      
      // Send heartbeat every 5 minutes to maintain online status
      heartbeatInterval.current = setInterval(() => {
        updateOnlineStatus(true);
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [status, session]);

  // Check billing reminders when user first visits (simulates cron job)
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasCheckedBilling.current) {
      hasCheckedBilling.current = true;
      // Check billing reminders after a short delay
      setTimeout(() => {
        checkBillingReminders();
      }, 2000); // 2 second delay to let the app load first
    }
  }, [status, session]);

  // Handle page visibility change (tab switching)
  useEffect(() => {
    if (status !== 'authenticated') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched to another tab - optionally keep them online
        // If you want to set them offline when they switch tabs, uncomment:
        // updateOnlineStatus(false);
      } else {
        // User came back to the tab
        updateOnlineStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]);

  // Handle page unload (closing tab/window or navigating away)
  useEffect(() => {
    if (status !== 'authenticated') return;

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status update on page close
      const data = JSON.stringify({ isOnline: false });
      navigator.sendBeacon('/api/user/status', data);
    };

    // Modern browsers - Page Lifecycle API
    const handlePageHide = () => {
      const data = JSON.stringify({ isOnline: false });
      navigator.sendBeacon('/api/user/status', data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [status]);

  // No visual component needed
  return null;
}
