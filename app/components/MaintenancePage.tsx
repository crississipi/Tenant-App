"use client";

import { SetPageProps } from '@/types'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi'
import { RiToolsFill } from 'react-icons/ri'
import { useSession } from 'next-auth/react'
import MaintenanceSlip from './MaintenanceSlip'
import SubmitNewRequest from './SubmitNewRequest';

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
  availabilities?: { date?: string | null; day?: string | null; timeAvailableFrom?: string | null; timeAvailableTo?: string | null }[];
}

const completedStatuses = new Set(['completed', 'resolved', 'closed', 'done']);
const severityMap: Record<string, string> = {
  low: 'low',
  medium: 'mid',
  high: 'high',
  critical: 'crit'
};

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

const truncateText = (text: string, limit = 60) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
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

const getDisplayTitle = (request: MaintenanceRequestRecord) => {
  if (request.title && request.title.trim()) {
    return truncateText(request.title.trim(), 60);
  }
  const parsedDoc = parseDocumentation(request);
  const textCandidate =
    parsedDoc?.userDescription ||
    parsedDoc?.processedRequest ||
    request.processedRequest ||
    request.rawRequest;

  return truncateText(textCandidate || `Maintenance #${request.maintenanceId}`, 60);
};

const buildIssueDescription = (request: MaintenanceRequestRecord) => {
  const parsedDoc = parseDocumentation(request);
  const description = parsedDoc?.processedRequest || request.processedRequest || request.rawRequest;
  return description;
};

const extractImageUrls = (request: MaintenanceRequestRecord) => {
  const parsedDoc = parseDocumentation(request);
  const uploadedFiles = parsedDoc?.uploadedFiles;
  if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
    return uploadedFiles.filter((url: string) => typeof url === 'string' && url.trim().length > 0);
  }
  return [];
};

const normalizeStatusLabel = (status?: string) => {
  if (!status) return 'Pending';
  return status
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
      status: normalizeStatusLabel(request.status),
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

const mapUrgencyToSeverity = (urgency?: string) => severityMap[urgency?.toLowerCase() || 'medium'] || 'mid';

const MaintenancePage = ({ setPage }: SetPageProps) => {
  const { data: session, status } = useSession();
  const [newRequest, submitNewRequest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [view, setView] = useState('pending');

  const fetchMaintenanceRequests = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingRequests(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/maintenance?userId=${session.user.id}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to load maintenance requests.');
      }
      setRequests(payload.maintenanceRequests || []);
    } catch (error) {
      console.error('Failed to fetch maintenance requests:', error);
      setFetchError(error instanceof Error ? error.message : 'Unexpected error occurred.');
    } finally {
      setLoadingRequests(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMaintenanceRequests();
    }
  }, [status, fetchMaintenanceRequests]);

  const handleSubmissionStatus = (submitting: boolean) => {
    setIsSubmitting(submitting);
    if (!submitting) {
      fetchMaintenanceRequests();
    }
  };

  const pendingRequests = useMemo(
    () => requests.filter(request => !completedStatuses.has(request.status?.toLowerCase())),
    [requests]
  );

  const completedRequests = useMemo(
    () => requests.filter(request => completedStatuses.has(request.status?.toLowerCase())),
    [requests]
  );

  const scheduledRequests = useMemo(
    () => requests.filter(request => request.status?.toLowerCase() === 'scheduled'),
    [requests]
  );

  const renderRequestList = (items: MaintenanceRequestRecord[], emptyState: React.ReactNode) => {
    if (loadingRequests) {
      return (
        <div className="w-full flex items-center justify-center py-10 text-sm text-neutral-600 gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-500"></div>
          <span>Loading maintenance requests...</span>
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="w-full flex flex-col items-center justify-center py-10 text-center gap-3 text-red-600">
          <p>{fetchError}</p>
          <button
            type="button"
            onClick={fetchMaintenanceRequests}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 ease-out duration-200"
          >
            Try again
          </button>
        </div>
      );
    }

    if (items.length === 0) {
      return emptyState;
    }

    return items.map(request => (
      <MaintenanceSlip
        key={request.maintenanceId}
        title={getDisplayTitle(request)}
        desc={buildIssueDescription(request)}
        stat={buildStatusTimeline(request)}
        dateSubmitted={formatTimeAgo(request.dateIssued)}
        severity={mapUrgencyToSeverity(request.urgency)}
        images={extractImageUrls(request)}
      />
    ));
  };

  const emptyPendingState = (
    <div className='w-full h-full flex flex-col px-14 py-16 text-neutral-600 gap-3 rounded-md items-center justify-center text-center'>
      <p className='w-full'>You currently do not have any maintenance request.</p>
      <button 
          type="button" 
          className='w-max items-center flex px-4 py-2 rounded-md border border-customViolet/50 gap-2 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200'
          onClick={() => submitNewRequest(true)}
      >
          <RiToolsFill className='text-2xl'/>
          Submit Request?
      </button>
    </div>
  );

  const emptyCompletedState = (
    <div className='w-full h-full flex flex-col px-6 py-10 text-neutral-600 gap-3 rounded-md items-center justify-center text-center border border-dashed border-neutral-300'>
      <p className='w-full'>No completed requests yet. We will list them here once resolved.</p>
    </div>
  );

  const showAuthWarning = status === 'unauthenticated';

  return (
    <div className='h-full w-full flex flex-col relative'>
      {showAuthWarning ? (
        <div className='h-full w-full flex flex-col items-center justify-center px-5 text-center gap-3'>
          <p className='text-lg font-medium'>You must be signed in to view maintenance requests.</p>
        </div>
      ) : newRequest ? (
        <SubmitNewRequest 
          submitNewRequest={submitNewRequest}
          onSubmissionStatus={handleSubmissionStatus}
        />
      ) : (
        <>
        <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden mb-2'>
            <button 
                type="button" 
                className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
                onClick={() => setPage(0)}
            >
                <HiOutlineChevronLeft />
            </button>
            <h2 className='text-xl font-medium w-full'>Maintenance</h2>
            <button
              type="button"
              className='px-3 py-2 text-nowrap rounded-md border border-customViolet/50 text-sm hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200 flex items-center gap-2'
              onClick={() => submitNewRequest(true)}
            >
              <RiToolsFill className='text-xl' />
              New Request
            </button>
        </div>
        
        {/* Submission Loading Indicator */}
        {isSubmitting && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Submitting maintenance request...</span>
          </div>
        )}

        <div className='w-full h-full flex flex-col gap-4 overflow-y-auto pb-4'>
            <div className='w-full flex items-center gap-3 px-5'>
              <button type="button" className={`py-2 px-4 rounded-md border border-customViolet/50 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200 ${view === 'pending' ? 'bg-customViolet text-white' : ''}`} onClick={() => setView('pending')}>Pending</button>
              <button type="button" className={`py-2 px-4 rounded-md border border-customViolet/50 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200 ${view === 'scheduled' ? 'bg-customViolet text-white' : ''}`} onClick={() => setView('scheduled')}>Scheduled</button>
              <button type="button" className={`py-2 px-4 rounded-md border border-customViolet/50 hover:bg-customViolet/50 focus:bg-customViolet focus:text-white ease-out duration-200 ${view === 'completed' ? 'bg-customViolet text-white' : ''}`} onClick={() => setView('completed')}>Completed</button>
                </div>
            <div className='w-full flex flex-col items-center h-full gap-2 p-3'>
                {renderRequestList(view === 'pending' ? pendingRequests : view === 'scheduled' ? scheduledRequests : completedRequests, emptyPendingState)}
            </div>
        </div>
        </>
      )}
      
    </div>
  )
}

export default MaintenancePage