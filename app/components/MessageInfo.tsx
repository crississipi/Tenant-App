"use client";

import React, { useState, useEffect } from 'react'
import { HiDocumentText, HiMiniArrowRightStartOnRectangle } from 'react-icons/hi2'
import { RiFile3Line, RiImageFill, RiVideoLine } from 'react-icons/ri'
import ShowFileInfo from './ShowFileInfo';
import { motion } from 'framer-motion';

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

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  messageID: number;
  senderID: number;
}

interface MessageInfoProps {
  showMessageInfo: (messageInfo: boolean) => void;
  currentConversation?: {
    partner: {
      userID: number;
      name: string;
      isOnline: boolean;
      role: string;
    };
  } | null;
  currentUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

const MessageInfo = ({ showMessageInfo, currentConversation, currentUser }: MessageInfoProps) => {
  const [fileInfo, showFileInfo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [option, setOption] = useState<'files' | 'media'>('files');
  const [allFiles, setAllFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all files when component mounts or conversation changes
  useEffect(() => {
    if (currentConversation && currentUser) {
      fetchAllFiles();
    }
  }, []);

  const fetchAllFiles = async () => {
    if (!currentConversation) return;

    try {
        setIsLoading(true);
        console.log('Fetching files for partner:', currentConversation.partner.userID);
        
        const response = await fetch(`/api/messages/${currentConversation.partner.userID}?all=true`);
        
        if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        
        const messages: Message[] = data.messages || data;
        console.log('All messages:', messages);
        
        // Extract files from messages
        const files: UploadedFile[] = messages
            .filter(message => message.fileUrl && message.fileName)
            .map(message => ({
            url: message.fileUrl!,
            name: message.fileName!,
            type: message.fileType || 'application/octet-stream',
            size: message.fileSize || 0,
            uploadedAt: message.dateSent,
            messageID: message.messageID,
            senderID: message.senderID
            }))
            .reverse();

        console.log('Extracted files:', files);
        setAllFiles(files);
        } else {
        console.error('Failed to fetch messages for files, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        }
    } catch (error) {
        console.error('Error fetching files:', error);
    } finally {
        setIsLoading(false);
    }
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

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.startsWith('audio/')) return '🎵';
    
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️';
    
    return '📁';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOwnFile = (file: UploadedFile) => {
    return currentUser && file.senderID === parseInt(currentUser.id);
  };

  // Filter files based on selected option
  const filteredFiles = allFiles.filter(file => {
    if (option === 'media') {
      return file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
    } else {
      return !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/');
    }
  });

  const imageFiles = allFiles.filter(file => file.type.startsWith('image/'));
  const videoFiles = allFiles.filter(file => file.type.startsWith('video/'));
  const documentFiles = allFiles.filter(file => !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/'));

  return (
    <motion.div 
      initial={{x: '100%'}}
      animate={{x: 0}}
      exit={{x: '100%'}}
      transition={{
        duration: 0.3,
        ease: 'easeOut'
      }}
      className='fixed top-0 right-0 z-50 bg-white h-full w-full md:max-w-md shadow-2xl flex flex-col border-l border-gray-100'
    >
      {/* Header */}
      <div className='w-full flex gap-4 items-center p-6 border-b border-gray-100 bg-white/80 backdrop-blur-md'>
        <button 
          type="button" 
          className='text-2xl p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-all duration-200'
          onClick={() => showMessageInfo(false)}
        >
          <HiMiniArrowRightStartOnRectangle />
        </button>
        <div className='flex items-center gap-4'>
          <span className='rounded-full h-12 w-12 bg-customViolet flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-customViolet/20'>
            {currentConversation?.partner.name?.charAt(0) || 'L'}
          </span>
          <span className='flex flex-col'>
            <h2 className='text-base font-bold text-gray-800'>{currentConversation?.partner.name || 'Landlord'}</h2>
            <div className='flex items-center gap-2'>
              <span className={`w-2 h-2 rounded-full ${currentConversation?.partner.isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
              <p className='text-xs text-gray-500 font-medium'>{currentConversation?.partner.role || 'Landlord'}</p>
            </div>
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className='w-full grid grid-cols-4 gap-2 p-4 bg-gray-50/50 border-b border-gray-100'>
        <div className='flex flex-col items-center p-2 rounded-2xl bg-white shadow-sm border border-gray-100'>
          <div className='text-lg font-bold text-customViolet'>{imageFiles.length}</div>
          <div className='text-[10px] font-medium text-gray-500 uppercase tracking-wide'>Images</div>
        </div>
        <div className='flex flex-col items-center p-2 rounded-2xl bg-white shadow-sm border border-gray-100'>
          <div className='text-lg font-bold text-customViolet'>{videoFiles.length}</div>
          <div className='text-[10px] font-medium text-gray-500 uppercase tracking-wide'>Videos</div>
        </div>
        <div className='flex flex-col items-center p-2 rounded-2xl bg-white shadow-sm border border-gray-100'>
          <div className='text-lg font-bold text-customViolet'>{documentFiles.length}</div>
          <div className='text-[10px] font-medium text-gray-500 uppercase tracking-wide'>Docs</div>
        </div>
        <div className='flex flex-col items-center p-2 rounded-2xl bg-white shadow-sm border border-gray-100'>
          <div className='text-lg font-bold text-customViolet'>{allFiles.length}</div>
          <div className='text-[10px] font-medium text-gray-500 uppercase tracking-wide'>Total</div>
        </div>
      </div>

      {/* Options Tabs */}
      <div className='w-full flex items-center p-4 gap-3'>
        <button 
          type="button" 
          className={`flex gap-2 items-center py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 flex-1 justify-center ${
            option === 'files' 
              ? 'bg-customViolet text-white shadow-lg shadow-customViolet/20' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onClick={() => setOption('files')}
        >
          <RiFile3Line className='text-lg'/>
          <span>Documents</span>
        </button>
        <button 
          type="button" 
          className={`flex gap-2 items-center py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 flex-1 justify-center ${
            option === 'media' 
              ? 'bg-customViolet text-white shadow-lg shadow-customViolet/20' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onClick={() => setOption('media')}
        >
          <RiImageFill className='text-lg'/>
          <span>Media</span>
        </button>
      </div>

      {/* Files/Media Content */}
      <div className='flex-1 w-full overflow-x-hidden flex flex-col bg-gray-50/30'>
        {isLoading ? (
          <div className='flex flex-col items-center justify-center h-full gap-3 text-gray-400'>
            <div className='w-8 h-8 border-2 border-customViolet border-t-transparent rounded-full animate-spin'></div>
            <span className='text-sm font-medium'>Loading files...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-center text-gray-400 p-8'>
            <div className='text-5xl mb-4 opacity-50'>
              {option === 'media' ? '🖼️' : '📁'}
            </div>
            <p className='font-medium text-gray-600'>No {option === 'media' ? 'media files' : 'documents'} found</p>
            <p className='text-xs mt-1'>Shared files will appear here</p>
          </div>
        ) : option === 'files' ? (
          <div className='w-full flex flex-col gap-3 p-4 overflow-y-auto custom-scrollbar'>
            {filteredFiles.map((file, i) => (
              <button 
                key={`file-${file.messageID}-${i}`}
                type='button' 
                className='w-full p-3 bg-white rounded-[1.5rem] flex gap-3 items-center hover:shadow-md border border-gray-100 transition-all duration-200 group' 
                onClick={() => handleFileClick(file)}
              >
                <span className='h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl border border-gray-100 group-hover:scale-105 transition-transform'>
                  {getFileIcon(file.type)}
                </span>
                <div className='flex-1 text-left min-w-0'>
                  <h3 className='font-semibold text-sm text-gray-800 truncate' title={file.name}>{file.name}</h3>
                  <div className='flex items-center gap-2 text-[10px] text-gray-500 mt-0.5'>
                    <span className='font-medium bg-gray-100 px-1.5 py-0.5 rounded-md'>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                </div>
                <div className='text-xs text-gray-400'>
                  {isOwnFile(file) ? 'You' : 'Landlord'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className='w-full h-auto grid grid-cols-3 gap-2 p-4 overflow-y-auto custom-scrollbar content-start'>
            {filteredFiles.map((file, i) => (
              <button 
                key={`media-${file.messageID}-${i}`}
                className='aspect-square col-span-1 bg-gray-200 rounded-2xl overflow-hidden relative group hover:shadow-lg transition-all duration-200'
                onClick={() => handleFileClick(file)}
              >
                {file.type.startsWith('image/') ? (
                  <img 
                    src={file.url} 
                    alt={file.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : file.type.startsWith('video/') ? (
                  <div className="w-full h-full flex items-center justify-center bg-black group-hover:scale-110 transition-transform duration-500">
                    <video className="w-full h-full object-cover opacity-80">
                      <source src={file.url} type={file.type} />
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className='w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30'>
                        <RiVideoLine className="text-white text-lg ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-customViolet/10 group-hover:bg-customViolet/20 transition-colors">
                    <span className="text-3xl">🎵</span>
                  </div>
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                
                {/* File type indicator */}
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                  {file.type.startsWith('image/') ? 'IMG' : 
                   file.type.startsWith('video/') ? 'VID' : 'AUD'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* File Info Modal */}
      {fileInfo && selectedFile && (
        <ShowFileInfo 
          showFileInfo={showFileInfo}
          file={selectedFile}
          onDownload={downloadFile}
        />
      )}
    </motion.div>
  )
}

export default MessageInfo