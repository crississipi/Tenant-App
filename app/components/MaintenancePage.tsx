"use client";

import { SetPageProps } from '@/types'
import MaintenanceRequestOptions from './MaintenanceRequestOptions';
import AICameraCapture from './AICameraCapture';
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

interface MaintenancePageProps extends SetPageProps {
  autoStart?: boolean;
}

const MaintenancePage = ({ setPage, autoStart = false }: MaintenancePageProps) => {
  const { data: session, status } = useSession();
  const [newRequest, submitNewRequest] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [view, setView] = useState('pending');

  useEffect(() => {
    if (autoStart) {
        setShowOptions(true);
    }
  }, [autoStart]);

  const fetchMaintenanceRequests = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingRequests(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/maintenance?userId=${session.user.id}`);
      const payload = await response.json();
      if (!response.ok) {
        // Don't show error for empty results
        if (response.status === 404) {
          setRequests([]);
          return;
        }
        throw new Error(payload?.message || 'Failed to load maintenance requests.');
      }
      setRequests(payload.maintenanceRequests || []);
    } catch (error) {
      console.error('Failed to fetch maintenance requests:', error);
      // Check if it's a network error or actual server error
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred.';
      // If it's just "Internal server error" with no requests, treat as empty
      if (errorMessage.toLowerCase().includes('internal server error')) {
        setRequests([]);
        setFetchError(null);
      } else {
        setFetchError(errorMessage);
      }
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

  const handleStartRequest = () => {
    setShowOptions(true);
  };

  const handleManualEntry = () => {
    setShowOptions(false);
    setCapturedImages([]);
    submitNewRequest(true);
  };

  const handleAIEntry = () => {
    setShowOptions(false);
    setShowCamera(true);
  };

  const handleCameraComplete = (images: File[]) => {
    setCapturedImages(images);
    setShowCamera(false);
    submitNewRequest(true);
  };

  const closeRequest = (state: boolean) => {
     submitNewRequest(state);
     if (!state) {
        setCapturedImages([]);
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
            className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-500 ease-out duration-200"
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
    <div className='w-full h-full flex flex-col px-14 py-16 text-neutral-600 gap-3 rounded-[2rem] items-center justify-center text-center bg-white border border-dashed border-neutral-200'>
      <p className='w-full'>You currently do not have any maintenance request.</p>
      <button 
          type="button" 
          className='w-max items-center flex px-6 py-3 rounded-full border border-customViolet/50 gap-2 hover:bg-customViolet/5 text-customViolet font-medium transition-all duration-300'
          onClick={handleStartRequest}
      >
          <RiToolsFill className='text-xl'/>
          Submit Request
      </button>
    </div>
  );

  const emptyCompletedState = (
    <div className='w-full h-full flex flex-col px-6 py-10 text-neutral-600 gap-3 rounded-[2rem] items-center justify-center text-center border border-dashed border-neutral-300 bg-white'>
      <p className='w-full'>No completed requests yet. We will list them here once resolved.</p>
    </div>
  );

  const showAuthWarning = status === 'unauthenticated';

  return (
    <div className='h-full w-full flex flex-col bg-gray-50 relative'>
      {showAuthWarning ? (
        <div className='h-full w-full flex flex-col items-center justify-center px-5 text-center gap-3'>
          <p className='text-lg font-medium text-gray-600'>You must be signed in to view maintenance requests.</p>
        </div>
      ) : showCamera ? (
            <AICameraCapture 
                onClose={() => setShowCamera(false)}
                onComplete={handleCameraComplete}
            />
      ) : newRequest ? (
        <SubmitNewRequest 
          submitNewRequest={closeRequest}
          onSubmissionStatus={handleSubmissionStatus}
          initialImages={capturedImages}
        />
      ) : (
        <>
        {showOptions && (
            <MaintenanceRequestOptions 
                onClose={() => setShowOptions(false)}
                onManual={handleManualEntry}
                onAI={handleAIEntry}
            />
        )}
        <div className='flex items-center justify-between px-6 py-6 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100 rounded-b-[2rem]'>
            <button 
                type="button" 
                className='p-2 -ml-2 rounded-full hover:bg-gray-100 text-customViolet transition-all duration-300'
                onClick={() => setPage(0)}
            >
                <HiOutlineChevronLeft className='text-2xl' />
            </button>
            <h2 className='text-xl font-bold text-gray-800'>Maintenance</h2>
            <button
              type="button"
              className='px-4 py-2 bg-customViolet text-white text-sm font-medium rounded-full shadow-lg shadow-customViolet/30 hover:shadow-customViolet/40 hover:scale-105 transition-all flex items-center gap-2'
              onClick={handleStartRequest}
            >
              <RiToolsFill className='text-lg' />
              <span className="hidden sm:inline">New Request</span>
            </button>
        </div>
        
        {/* Submission Loading Indicator */}
        {isSubmitting && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 bg-customViolet text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
            <span className="font-medium">Submitting request...</span>
          </div>
        )}

        <div className='flex-1 flex flex-col overflow-hidden'>
            <div className='w-full flex items-center gap-2 px-6 py-4 overflow-x-auto no-scrollbar bg-gray-50/50'>
              {['pending', 'scheduled', 'completed'].map((tab) => (
                <button 
                  key={tab}
                  type="button" 
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                    view === tab 
                      ? 'bg-customViolet text-white shadow-lg shadow-customViolet/25 scale-105' 
                      : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-customViolet border border-gray-200'
                  }`} 
                  onClick={() => setView(tab as any)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            
            <div className='flex-1 overflow-y-auto px-6 pb-20 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:pb-8'>
                {renderRequestList(view === 'pending' ? pendingRequests : view === 'scheduled' ? scheduledRequests : completedRequests, emptyPendingState)}
            </div>
        </div>
        </>
      )}
      
    </div>
  )
}

export default MaintenancePage