"use client";

import { SetPageProps } from '@/types'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi'
import { HiFolderPlus, HiOutlineArrowLeftStartOnRectangle, HiOutlineFolderPlus, HiOutlineInformationCircle, HiOutlineDocument } from 'react-icons/hi2'
import { RiSendPlaneFill, RiSendPlaneLine } from 'react-icons/ri'
import { AiOutlineClose } from 'react-icons/ai'
import { IoSend } from "react-icons/io5";
import MessageInfo from './MessageInfo'
import ShowFileInfo from './ShowFileInfo'
import MessageBubble from './MessageBubble'
import { AnimatePresence } from 'framer-motion';
import { webSocketService } from '@/lib/websocket';
import { MessageType } from '@/types'

interface Message {
  messageID: number;
  senderID: number;
  receiverID: number;
  message: string;
  dateSent: string;
  read: boolean;
  sender?: {
    userID: number;
    firstName: string;
    lastName: string;
    role: string;
  };
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

interface Conversation {
  partner: {
    userID: number;
    name: string;
    isOnline: boolean;
    role: string;
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  lastMessageSender: string;
}

interface UserSession {
  id: string;
  name?: string;
  email?: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

// Updated renderProcedureMessage function in ChatPage component
const renderProcedureMessage = (message: string) => {
  // Check if this is a maintenance procedure message
  const isProcedureMessage = message.includes('🔧 **MAINTENANCE REQUEST:') && 
                            (message.includes('Step 1:') || message.includes('Step 2:'));

  if (!isProcedureMessage) {
    return <p className="whitespace-pre-wrap wrap-break-word">{message}</p>;
  }

  const isTagalog = message.includes('(Translated to Tagalog)');
  const lines = message.split('\n');
  
  return (
    <div className="whitespace-pre-wrap wrap-break-word">
      {lines.map((line, index) => {
        // Header line
        if (line.startsWith('🔧 **MAINTENANCE REQUEST:')) {
          return (
            <div key={index} className="font-bold text-lg mb-2 text-customViolet bg-customViolet/10 p-3 rounded-lg border-l-4 border-customViolet">
              {line.replace(/\*\*/g, '')}
              {isTagalog && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  🇵🇭 Tagalog
                </span>
              )}
            </div>
          );
        }
        
        // Urgency line
        if (line.startsWith('Urgency Level:')) {
          const urgencyMatch = line.match(/Urgency Level: (\d)\/4/);
          const urgencyLevel = urgencyMatch ? parseInt(urgencyMatch[1]) : 2;
          let urgencyColor = 'text-green-600';
          if (urgencyLevel === 3) urgencyColor = 'text-orange-600';
          if (urgencyLevel === 4) urgencyColor = 'text-red-600';
          
          return (
            <div key={index} className={`font-semibold mb-3 ${urgencyColor}`}>
              {line}
            </div>
          );
        }
        
        // Step lines
        if (line.startsWith('Step')) {
          const stepMatch = line.match(/Step (\d+):\s*(.*)/);
          if (stepMatch) {
            return (
              <div key={index} className="ml-2 my-2 flex items-start">
                <span className="font-semibold min-w-[70px] text-customViolet">Step {stepMatch[1]}:</span>
                <span className="ml-2 flex-1">{stepMatch[2]}</span>
              </div>
            );
          }
        }
        
        // Separator line
        if (line.startsWith('---')) {
          return <hr key={index} className="my-3 border-gray-300" />;
        }
        
        // Note line
        if (line.startsWith('*Note:') || line.startsWith('*Paunawa:')) {
          const noteClass = isTagalog 
            ? "text-xs italic text-gray-600 mt-3 p-2 bg-blue-50 rounded border border-blue-200"
            : "text-xs italic text-gray-600 mt-3 p-2 bg-yellow-50 rounded border border-yellow-200";
          
          return (
            <div key={index} className={noteClass}>
              {line}
            </div>
          );
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        // Regular text lines
        return <div key={index} className="my-1">{line}</div>;
      })}
    </div>
  );
};

const ChatPage = ({ setPage }: SetPageProps) => {
  const [messageInfo, showMessageInfo] = useState(false);
  const [fileInfo, showFileInfo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [openMessage, setOpenMessage] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [currentMessages, setCurrentMessages] = useState<MessageType[]>([]);
  const [allMessages, setAllMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagePreview, setNewMessagePreview] = useState<{ id: number; text: string } | null>(null);
  const [partner, setPartner] = useState<any>(null);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

  // File preview states
  const [selectedFileUpload, setSelectedFileUpload] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get current user session
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setCurrentUser(data.user);
          } else {
            console.error('No user session found');
          }
        } else {
          console.error('Failed to fetch user session');
        }
      } catch (error) {
        console.error('Error getting user session:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Fetch conversations when user is available
  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        console.error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [currentUser]);

  const fetchMessages = useCallback(async ({
    cursor: cursorParam,
    prepend = false,
    isInitial = false,
  }: {
    cursor?: number | null;
    prepend?: boolean;
    isInitial?: boolean;
  } = {}) => {
    if (!currentConversation) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isInitial) {
        setIsLoading(true);
      }

      const params = new URLSearchParams();
      params.set('limit', '10');
      if (cursorParam) {
        params.set('cursor', String(cursorParam));
      }

      console.log('Fetching messages for user:', currentConversation.partner.userID, 'params:', params.toString());
      const response = await fetch(`/api/messages/${currentConversation.partner.userID}?${params.toString()}`);
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched messages:', data);

        setHasMore(data.hasMore);
        setCursor(data.nextCursor);

        setCurrentMessages((prev) => {
          const nextMessages = prepend ? [...data.messages, ...prev] : data.messages;

          if (!prepend && !isInitial && !isAtBottom && nextMessages.length) {
            const last = nextMessages[nextMessages.length - 1];
            if (last && last.senderID === currentConversation.partner.userID) {
              let previewText = (last.message || '').trim();

              if (!previewText) {
                const firstFile = last.files && last.files[0];
                if (firstFile?.fileType?.startsWith('image/')) {
                  previewText = 'Sent a photo';
                } else if (firstFile?.fileType?.startsWith('video/')) {
                  previewText = 'Sent a video';
                } else if (firstFile) {
                  previewText = 'Sent a file';
                } else {
                  previewText = 'New message';
                }
              }

              const trimmed = previewText.length > 80 ? `${previewText.slice(0, 80)}…` : previewText;
              setNewMessagePreview({ id: last.messageID, text: trimmed });
            }
          }

          return nextMessages;
        });

        if (isInitial) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
          }, 50);
        }
      } else {
        console.error('Failed to fetch messages:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      isFetchingRef.current = false;
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [currentConversation, isAtBottom]);

  const fetchPartnerInfo = useCallback(async () => {
    try {
      console.log('Fetching partner info for user:', currentConversation?.partner.userID);
      const response = await fetch(`/api/users/${currentConversation?.partner.userID}`);
      console.log('Partner response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched partner:', data);
        setPartner(data);
      } else {
        console.error('Failed to fetch partner info:', response.status);
      }
    } catch (error) {
      console.error('Error fetching partner info:', error);
    }
  }, [currentConversation]);

  // Auto-select landlord conversation and fetch messages
  useEffect(() => {
    if (conversations.length > 0 && currentUser) {
      const landlordConversation = conversations[0];
      if (landlordConversation) {
        setCurrentConversation(landlordConversation);
        fetchMessages({ isInitial: true });
        fetchPartnerInfo();
      }
    }
  }, [conversations, currentUser, fetchMessages, fetchPartnerInfo]);

  const loadMoreMessages = useCallback(() => {
    if (!currentConversation || !hasMore || isLoading) return;
    
    fetchMessages({ cursor });
  }, [currentConversation, hasMore, isLoading, cursor, fetchMessages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottomNow = distanceFromBottom <= 40;
    setIsAtBottom(atBottomNow);
    if (atBottomNow) {
      setNewMessagePreview(null);
    }

    if (isLoading || !hasMore || !cursor) return;
    if (container.scrollTop <= 50) {
      fetchMessages({ cursor, prepend: true });
    }
  }, [isLoading, hasMore, cursor, fetchMessages]);

  // Handle scroll for infinite loading
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const sendMessage = async (fileData?: { url: string; name: string; type: string; size: number }) => {
    const messageContent = messageText.trim();
    if ((!messageContent && !fileData) || isSending || !currentUser || !currentConversation) return;

    try {
      setIsSending(true);
      
      const tempMessage: Message = {
        messageID: Date.now(),
        senderID: parseInt(currentUser.id),
        receiverID: currentConversation.partner.userID,
        message: messageContent,
        dateSent: new Date().toISOString(),
        read: false,
        ...(fileData && {
          fileUrl: fileData.url,
          fileName: fileData.name,
          fileType: fileData.type,
          fileSize: fileData.size
        })
      };

      // Update UI immediately
      setCurrentMessages(prev => [...prev, tempMessage]);
      setAllMessages(prev => [...prev, tempMessage]);
      
      // Update conversation
      const lastMessageText = fileData ? `Sent a file: ${fileData.name}` : messageContent;
      setConversations(prev => 
        prev.map(conv => 
          conv.partner.userID === currentConversation.partner.userID 
            ? {
                ...conv,
                lastMessage: lastMessageText,
                lastMessageSender: 'You',
                timestamp: new Date().toISOString()
              }
            : conv
        )
      );

      // Clear input if not file-only message
      if (!fileData) {
        setMessageText('');
      }

      // Send to API
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverID: currentConversation.partner.userID,
          message: messageContent,
          ...(fileData && {
            fileUrl: fileData.url,
            fileName: fileData.name,
            fileType: fileData.type,
            fileSize: fileData.size
          })
        })
      });

      if (response.ok) {
        const sentMessage = await response.json();
        setCurrentMessages(prev => 
          prev.map(msg => 
            msg.messageID === tempMessage.messageID 
              ? { 
                  ...sentMessage, 
                  sender: { 
                    userID: parseInt(currentUser.id), 
                    firstName: currentUser.firstName || '', 
                    lastName: currentUser.lastName || '',
                    role: currentUser.role
                  } 
                }
              : msg
          )
        );
        setAllMessages(prev => 
          prev.map(msg => 
            msg.messageID === tempMessage.messageID 
              ? { 
                  ...sentMessage, 
                  sender: { 
                    userID: parseInt(currentUser.id), 
                    firstName: currentUser.firstName || '', 
                    lastName: currentUser.lastName || '',
                    role: currentUser.role
                  } 
                }
              : msg
          )
        );
      } else {
        const error = await response.json();
        console.error('Failed to send message:', error);
      }

      if (textareaRef.current) {
        textareaRef.current.focus();
      }

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !currentUser || !currentConversation) return;

    try {
      setIsUploading(true);
      
      const uploadedFiles: { url: string; name: string; type: string; size: number }[] = [];
      
      for (const file of Array.from(files)) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            const base64String = result.split(',')[1];
            resolve(base64String);
          };
          reader.readAsDataURL(file);
        });

        const folderName = `chat-files/${currentUser.id}-${currentConversation.partner.userID}`;
        
        const uploadResponse = await fetch('/api/upload-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: [{
              name: file.name,
              content: base64
            }],
            folderName
          })
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          if (uploadData.success && uploadData.urls.length > 0) {
            uploadedFiles.push({
              url: uploadData.urls[0],
              name: file.name,
              type: file.type,
              size: file.size
            });
          }
        } else {
          console.error('Failed to upload file:', await uploadResponse.json());
        }
      }

      // Send messages for each uploaded file
      for (const fileData of uploadedFiles) {
        await sendMessage(fileData);
      }

    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const cancelFileUpload = () => {
    setSelectedFileUpload(null);
    setFilePreview(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const sendFileMessage = async () => {
    if (!selectedFileUpload || !currentConversation) return;
    await handleFileUpload(new DataTransfer().files);
    cancelFileUpload();
  };

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = webSocketService.onMessage((message: any) => {
      if (message.type === 'new_message' && message.receiverID === parseInt(currentUser.id)) {
        console.log('Received new message via WebSocket:', message);
        
        // Add the new message to the list
        const newMessage = message.data;
        setCurrentMessages(prev => {
          const messageExists = prev.some(msg => msg.messageID === newMessage.messageID);
          if (messageExists) return prev;

          const updatedMessages = [...prev, newMessage];

          // Show preview if not at bottom
          if (!isAtBottom) {
            let previewText = (newMessage.message || '').trim();
            if (!previewText) {
              const firstFile = newMessage.files && newMessage.files[0];
              if (firstFile?.fileType?.startsWith('image/')) {
                previewText = 'Sent a photo';
              } else if (firstFile?.fileType?.startsWith('video/')) {
                previewText = 'Sent a video';
              } else if (firstFile) {
                previewText = 'Sent a file';
              } else {
                previewText = 'New message';
              }
            }
            const trimmed = previewText.length > 80 ? `${previewText.slice(0, 80)}…` : previewText;
            setNewMessagePreview({ id: newMessage.messageID, text: trimmed });
          }

          return updatedMessages;
        });

        // Update conversation last message
        setConversations(prev => 
          prev.map(conv => 
            conv.partner.userID === message.senderID 
              ? {
                  ...conv,
                  lastMessage: newMessage.message || 'New message',
                  lastMessageSender: 'Them',
                  timestamp: newMessage.dateSent,
                  unreadCount: conv.unreadCount + 1
                }
              : conv
          )
        );
      }
    });

    webSocketService.connect(currentUser.id);

    return () => {
      unsubscribe();
      webSocketService.disconnect();
    };
  }, [currentUser, isAtBottom]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const markMessagesAsRead = async (partnerId: number) => {
    try {
      setConversations(prev => 
        prev.map(conv => 
          conv.partner.userID === partnerId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clickMessage = (index: number) => {
    setOpenMessage(openMessage === index ? null : index);
  };

  const isOwnMessage = (message: MessageType): boolean => {
    return !!(currentUser && message.senderID === parseInt(currentUser.id));
  };

  const handleFileClick = (file: UploadedFile) => {
    setSelectedFile(file);
    showFileInfo(true);
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className='h-full w-full flex flex-col relative items-center overflow-x-hidden bg-gray-50/50 lg:bg-white lg:rounded-[2rem] lg:shadow-sm lg:border lg:border-gray-100'>
      <AnimatePresence>
        {messageInfo && (
          <MessageInfo 
            showMessageInfo={showMessageInfo}
            currentConversation={currentConversation}
            currentUser={currentUser}
          />
        )}
        {fileInfo && selectedFile && (
          <ShowFileInfo 
            showFileInfo={showFileInfo} 
            file={selectedFile}
            onDownload={downloadFile}
          />
        )}
      </AnimatePresence>
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
      
      {/* Header */}
      <div className='w-full flex items-center px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm z-20 rounded-b-[2rem] lg:rounded-t-[2rem] lg:rounded-b-none'>
        <button 
          type="button" 
          className='p-2 mr-2 rounded-full hover:bg-gray-100 text-customViolet transition-all duration-300 lg:hidden'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft className='text-2xl' />
        </button>
        <div className='flex flex-col mr-auto'>
          <h2 className='text-lg font-semibold text-gray-800'>
            {currentConversation 
              ? currentConversation.partner.name
              : 'Chat with Landlord'
            }
          </h2>
          {currentConversation && (
            <span className='text-xs font-medium text-customViolet bg-customViolet/10 px-2 py-0.5 rounded-full w-fit'>
              Landlord
            </span>
          )}
        </div>
        <button 
          type="button" 
          className='p-2 rounded-full hover:bg-gray-100 text-customViolet transition-all duration-300'
          onClick={() => showMessageInfo(true)}
        >
          <HiOutlineInformationCircle className='text-2xl' />
        </button>
      </div>

      {/* Messages Area */}
      <div className='flex-1 w-full overflow-x-hidden flex flex-col relative'>
        {isLoading ? (
          <div className='flex flex-col items-center justify-center h-full gap-3'>
            <div className='w-8 h-8 border-3 border-customViolet border-t-transparent rounded-full animate-spin' />
            <div className='text-customViolet/70 text-sm font-medium'>Loading messages...</div>
          </div>
        ) : currentConversation && currentMessages.length > 0 ? (
          <div 
            ref={messagesContainerRef}
            className='h-full w-full flex flex-col overflow-y-auto p-4 gap-3 custom-scrollbar'
          >
            {hasMore && (
              <div className='text-center py-4'>
                <button 
                  onClick={loadMoreMessages}
                  className='text-xs font-medium text-customViolet bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 transition-all'
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            
            {currentMessages.map((message, i) => (
              <MessageBubble
                key={`message-${message.messageID}`}
                sender={isOwnMessage(message)}
                message={message.message}
                timestamp={message.dateSent}
                files={message.files}
                batchId={message.batchId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : currentConversation ? (
          <div className='flex flex-col items-center justify-center h-full text-center p-8 opacity-60'>
            <div className='text-6xl mb-4'>💬</div>
            <p className='text-gray-600 font-medium'>No messages yet</p>
            <p className='text-sm text-gray-400 mt-1'>Start a conversation with your landlord</p>
          </div>
        ) : (
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500'>No landlord found to chat with</div>
          </div>
        )}

        {newMessagePreview && !isAtBottom && (
          <div className='absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-30'>
            <button
              type='button'
              className='pointer-events-auto bg-customViolet text-white text-xs md:text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-customViolet/90 transition-all transform hover:scale-105'
              onClick={() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
                setIsAtBottom(true);
                setNewMessagePreview(null);
              }}
            >
              <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
              <span className='font-medium'>New message</span>
              <span className='max-w-[150px] truncate opacity-80 border-l border-white/20 pl-2 ml-1'>{newMessagePreview.text}</span>
            </button>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {showPreview && selectedFileUpload && (
        <div className='absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-[2rem] max-w-md w-full p-6 shadow-2xl transform transition-all'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-800'>Preview File</h3>
              <button 
                onClick={cancelFileUpload}
                className='p-2 hover:bg-gray-100 rounded-full transition-colors'
              >
                <AiOutlineClose className='text-xl text-gray-500' />
              </button>
            </div>
            
            {/* Preview Content */}
            <div className='mb-4'>
              {filePreview ? (
                <div className='relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100'>
                  <img 
                    src={filePreview} 
                    alt="Preview" 
                    className='w-full h-64 object-contain'
                  />
                </div>
              ) : (
                <div className='w-full h-64 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center'>
                  <HiOutlineDocument className='text-5xl text-customViolet/50 mb-3' />
                  <p className='text-sm text-gray-600 font-medium'>{selectedFileUpload.name}</p>
                  <p className='text-xs text-gray-400 mt-1'>{formatFileSize(selectedFileUpload.size)}</p>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className='relative mb-4'>
              <input
                type="text"
                placeholder="Add a caption..."
                className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-customViolet/20 focus:border-customViolet transition-all text-sm'
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className='flex gap-3'>
              <button
                onClick={cancelFileUpload}
                className='flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm'
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={sendFileMessage}
                disabled={isUploading}
                className='flex-1 px-4 py-2.5 bg-customViolet text-white font-medium rounded-xl hover:shadow-lg hover:shadow-customViolet/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm'
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <IoSend />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Input Area */}
      <div className='w-full bg-white p-3 border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-20 lg:rounded-b-[2rem]'>
        <div className='flex items-end gap-2 bg-gray-50 p-1.5 rounded-[2rem] border border-gray-200 focus-within:border-customViolet/30 focus-within:ring-4 focus-within:ring-customViolet/5 transition-all duration-300'>
          <button 
            type="button" 
            className='h-10 w-10 flex items-center justify-center rounded-full text-customViolet hover:bg-white hover:shadow-sm transition-all duration-200 disabled:opacity-50'
            onClick={triggerFileInput}
            disabled={isUploading || !currentConversation}
            title="Attach files"
          >
            {isUploading ? (
              <div className='w-5 h-5 border-2 border-customViolet border-t-transparent rounded-full animate-spin' />
            ) : (
              <HiOutlineFolderPlus className='text-2xl' />
            )}
          </button>
          
          <textarea 
            ref={textareaRef}
            className='flex-1 max-h-32 min-h-10 py-2 px-2 bg-transparent border-none resize-none focus:ring-0 text-gray-700 placeholder:text-gray-400 text-sm leading-relaxed custom-scrollbar'
            value={messageText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            disabled={isSending || !currentConversation}
            rows={1}
            style={{ height: 'auto' }}
          />
          
          <button 
            type="button" 
            className={`h-10 w-10 flex items-center justify-center rounded-full transition-all duration-300 ${
              (!messageText.trim() && !isUploading) || isSending || !currentConversation
                ? 'text-gray-400 bg-transparent' 
                : 'bg-customViolet text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
            }`}
            onClick={() => sendMessage()}
            disabled={(!messageText.trim() && !isUploading) || isSending || !currentConversation}
          >
            {isSending ? (
              <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
            ) : (
              <IoSend className={`${(!messageText.trim() && !isUploading) ? 'ml-0' : 'ml-0.5'}`} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage