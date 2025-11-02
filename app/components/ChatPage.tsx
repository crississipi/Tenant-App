"use client";

import { SetPageProps } from '@/types'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi'
import { HiFolderPlus, HiOutlineArrowLeftStartOnRectangle, HiOutlineFolderPlus } from 'react-icons/hi2'
import { RiSendPlaneFill, RiSendPlaneLine } from 'react-icons/ri'
import MessageInfo from './MessageInfo'
import ShowFileInfo from './ShowFileInfo'
import { AnimatePresence } from 'framer-motion';

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

const ChatPage = ({ setPage }: SetPageProps) => {
  const [messageInfo, showMessageInfo] = useState(false);
  const [fileInfo, showFileInfo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [openMessage, setOpenMessage] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPageNumber] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageSize = 10;

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
  }, [currentUser]);

  // Auto-select landlord conversation and fetch messages
  useEffect(() => {
    if (conversations.length > 0 && currentUser) {
      const landlordConversation = conversations[0];
      if (landlordConversation) {
        setCurrentConversation(landlordConversation);
        fetchMessages(landlordConversation.partner.userID, 1, true);
      }
    }
  }, [conversations, currentUser]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (page === 1) {
      scrollToBottom();
    }
  }, [currentMessages]);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        if (data.length === 0 && currentUser?.role === 'tenant') {
          await findOrCreateLandlordConversation();
        }
      } else {
        console.error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const findOrCreateLandlordConversation = async () => {
    try {
      const usersResponse = await fetch('/api/users');
      if (usersResponse.ok) {
        const landlords = await usersResponse.json();
        if (landlords.length > 0) {
          const landlord = landlords[0];
          const mockConversation: Conversation = {
            partner: {
              userID: landlord.userID,
              name: landlord.name,
              isOnline: landlord.isOnline,
              role: 'landlord'
            },
            lastMessage: "Start a conversation with your landlord",
            timestamp: new Date().toISOString(),
            unreadCount: 0,
            lastMessageSender: "System"
          };
          
          setConversations([mockConversation]);
          setCurrentConversation(mockConversation);
        }
      }
    } catch (error) {
      console.error('Error finding landlord:', error);
    }
  };

  const fetchMessages = async (partnerId: number, pageNum: number = 1, reset: boolean = false) => {
    try {
      const response = await fetch(`/api/messages/${partnerId}?page=${pageNum}&limit=${pageSize}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (reset) {
          setAllMessages(data.messages || data);
          setCurrentMessages(data.messages || data);
          setHasMore(data.hasMore !== undefined ? data.hasMore : (data.messages?.length === pageSize));
        } else {
          setAllMessages(prev => [...(data.messages || data), ...prev]);
          setCurrentMessages(prev => [...(data.messages || data), ...prev]);
          setHasMore(data.hasMore !== undefined ? data.hasMore : (data.messages?.length === pageSize));
        }
        
        if (reset) {
          setPageNumber(1);
        } else {
          setPageNumber(pageNum);
        }
        
        markMessagesAsRead(partnerId);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch messages:', errorData);
        
        if (response.status === 404) {
          setCurrentMessages([]);
          setAllMessages([]);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setCurrentMessages([]);
      setAllMessages([]);
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (!currentConversation || !hasMore || isLoading) return;
    
    const nextPage = page + 1;
    fetchMessages(currentConversation.partner.userID, nextPage, false);
  }, [currentConversation, hasMore, isLoading, page]);

  // Handle scroll for infinite loading
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      if (messagesContainer.scrollTop === 0 && hasMore && !isLoading) {
        loadMoreMessages();
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [loadMoreMessages, hasMore, isLoading]);

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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Poll for new messages - ONLY when MessageInfo is NOT open
  useEffect(() => {
    if (!currentConversation || messageInfo) return;

    const pollInterval = setInterval(() => {
      console.log('Polling for new messages...');
      fetchMessages(currentConversation.partner.userID, 1, true);
    }, 5000);

    return () => {
      console.log('Clearing poll interval');
      clearInterval(pollInterval);
    };
  }, [currentConversation, messageInfo]); // Added messageInfo to dependencies

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

  const refreshMessages = () => {
    if (currentConversation) {
      fetchMessages(currentConversation.partner.userID, 1, true);
    }
    fetchConversations();
  };

  const isOwnMessage = (message: Message) => {
    return currentUser && message.senderID === parseInt(currentUser.id);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.startsWith('audio/')) return '🎵';
    return '📄';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className='h-full w-full flex flex-col relative'>
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
      <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden'>
        <button 
          type="button" 
          className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
          onClick={() => setPage(0)}
        >
          <HiOutlineChevronLeft />
        </button>
        <h2 className='text-xl font-medium w-full text-center'>
          {currentConversation 
            ? `Chat with Landlord (${currentConversation.partner.name})` 
            : 'Chat with Landlord'
          }
        </h2>
        <div className='flex gap-2'>
          <button 
            type="button" 
            className='text-xl rounded-md px-2 hover:bg-[#8884d8] focus:bg-customViolet focus:text-white ease-out duration-200'
            onClick={refreshMessages}
            title="Refresh messages"
          >
            ↻
          </button>
          <button 
            type="button" 
            className='text-3xl rounded-md px-1 aspect-square hover:bg-[#8884d8] focus:bg-customViolet focus:text-white ease-out duration-200'
            onClick={() => showMessageInfo(true)}
          >
            <HiOutlineArrowLeftStartOnRectangle />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className='bg-neutral-200 h-full w-full overflow-x-hidden flex flex-col'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500'>Loading messages...</div>
          </div>
        ) : currentConversation && currentMessages.length > 0 ? (
          <div 
            ref={messagesContainerRef}
            className='h-auto w-full flex flex-col mt-auto overflow-y-auto p-2'
          >
            {hasMore && (
              <div className='text-center py-2'>
                <button 
                  onClick={loadMoreMessages}
                  className='text-sm text-customViolet hover:underline'
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load more messages'}
                </button>
              </div>
            )}
            
            {currentMessages.map((message, i) => (
              <button 
                key={`message-${message.messageID}`} 
                type='button' 
                className={`flex flex-col py-2 px-3 ${openMessage === i && 'border-y border-customViolet/50'} gap-2`}
                onClick={() => clickMessage(i)}
              >
                {openMessage === i && (
                  <span className='font-semibold text-xs text-customViolet/70'>
                    {formatDate(message.dateSent)} {formatTime(message.dateSent)}
                  </span>
                )}
                
                {message.fileUrl ? (
                  <div className={`rounded-md p-2 text-left text-sm max-w-[80%] ${
                    isOwnMessage(message)
                      ? 'bg-customViolet text-white ml-auto' 
                      : 'bg-white text-gray-800'
                  }`}>
                    <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileClick({
                          url: message.fileUrl!,
                          name: message.fileName!,
                          type: message.fileType!,
                          size: message.fileSize || 0,
                          uploadedAt: message.dateSent
                        });
                      }}
                    >
                      <span className="text-lg">{getFileIcon(message.fileType!)}</span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{message.fileName}</span>
                        <span className="text-xs opacity-75">
                          {formatFileSize(message.fileSize || 0)}
                        </span>
                      </div>
                    </div>
                    {message.message && (
                      <p className="whitespace-pre-wrap break-words mt-2">{message.message}</p>
                    )}
                  </div>
                ) : (
                  <span className={`rounded-md p-2 text-left text-sm max-w-[80%] ${
                    isOwnMessage(message)
                      ? 'bg-customViolet text-white ml-auto' 
                      : 'bg-white text-gray-800'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{message.message}</p>
                  </span>
                )}
                
                {openMessage === i && isOwnMessage(message) && (
                  <span className='ml-auto font-medium text-xs text-customViolet/70'>
                    {message.read ? 'Seen' : 'Delivered'} • {formatTime(message.dateSent)}
                  </span>
                )}
              </button>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : currentConversation ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500 text-center'>
              <p>No messages yet</p>
              <p className='text-sm'>Start a conversation with your landlord</p>
            </div>
          </div>
        ) : (
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500'>No landlord found to chat with</div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className='h-24 w-full bg-white flex items-center gap-1 p-1.5 border-t'>
        <button 
          type="button" 
          className='h-full px-2 flex items-center justify-center text-3xl hover:bg-[#8884d8] focus:bg-customViolet focus:text-white group ease-out duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={triggerFileInput}
          disabled={isUploading || !currentConversation}
          title="Attach files"
        >
          {isUploading ? (
            <div className='w-6 h-6 border-2 border-customViolet border-t-transparent rounded-full animate-spin' />
          ) : (
            <>
              <HiOutlineFolderPlus className='group-focus:hidden ease-out duration-200'/>
              <HiFolderPlus className='hidden group-focus:block ease-out duration-200'/>
            </>
          )}
        </button>
        <textarea 
          ref={textareaRef}
          className='h-full w-full bg-neutral-200 border border-customViolet/20 resize-none p-2 rounded-md focus:outline-none focus:border-customViolet'
          value={messageText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message to landlord..."
          disabled={isSending || !currentConversation}
          rows={1}
        />
        <button 
          type="button" 
          className='h-full px-2 flex items-center justify-center text-3xl hover:bg-[#8884d8] focus:bg-customViolet focus:text-white group ease-out duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={() => sendMessage()}
          disabled={(!messageText.trim() && !isUploading) || isSending || !currentConversation}
        >
          {isSending ? (
            <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin' />
          ) : (
            <>
              <RiSendPlaneLine className='group-focus:hidden ease-out duration-200'/>
              <RiSendPlaneFill className='hidden group-focus:block ease-out duration-200'/>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default ChatPage