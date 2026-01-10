export interface BillingSlipProps {
    billName: string;
    billAmount: number;
}
export interface NotifSlipProps{
    notificationId: number;
    icon:string;
    message:string; 
    time:string;
    isRead: boolean;
    relatedId?: number | null;
    onMarkAsRead?: (notificationId: number) => void;
}

export interface NotificationData {
    notificationId: number;
    type: string;
    message: string;
    relatedId: number | null;
    isRead: boolean;
    createdAt: string;
    date: string;
}

export interface ChartProps {
    name: string;
    value: number;
    electric?: number;
    water?: number;
}

export interface SetPageProps {
    setPage: (page: number) => void;
}

export interface CustomInputProps {
    placeholder: string;
    inputType: string;
    marginBottom: boolean;
    hookValue: string;
    hookVariable: (hookValue: string) => void;
}

export interface ChangePageProps {
    setPage: (page: number) => void;
}

export interface MessageType {
  messageID: number;
  senderID: number;
  receiverID: number;
  message: string | null;
  dateSent: string;
  read: boolean;
  sender?: {
    userID: number;
    firstName: string;
    lastName: string;
    role: string;
  };
  files?: {
    url: string;
    fileName: string;
    fileType: string | null;
    fileSize?: string | null;
  }[];
  batchId?: string | null;
}

export interface MessageBubbleProps {
  sender: boolean;
  message: string | null;
  timestamp: string;
  files?: {
    url: string;
    fileName: string;
    fileType: string | null;
    fileSize?: string | null;
  }[];
  batchId?: string | null;
  onViewBilling?: (billingId: number) => void;
  onViewMaintenance?: (maintenanceId: number) => void;
}
