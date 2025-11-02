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
      initial={{x: 500}}
      animate={{x: 0}}
      exit={{x: 500}}
      transition={{
        duration: 0.3,
        ease: 'easeOut'
      }}
      className='fixed top-16 left-0 z-20 bg-white h-full w-full flex flex-col'
    >
      {/* Header */}
      <div className='w-full flex gap-3 items-center p-5 border-b'>
        <span className='rounded-full h-24 w-24 bg-customViolet z-30 flex items-center justify-center text-white text-2xl font-bold'>
          {currentConversation?.partner.name?.charAt(0) || 'L'}
        </span>
        <span className='flex flex-col'>
          <h2 className='text-lg font-medium'>{currentConversation?.partner.name || 'Landlord'}</h2>
          <p className='text-sm text-gray-600'>{currentConversation?.partner.role || 'Landlord'}</p>
          <div className='flex flex-col mt-1'>
            <span className={`inline-flex items-center gap-1 text-sm ${currentConversation?.partner.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${currentConversation?.partner.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {currentConversation?.partner.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </span>
        <span className='h-full ml-auto'>
          <button 
            type="button" 
            className='text-3xl rounded-md px-1 aspect-square hover:bg-[#8884d8] focus:bg-customViolet focus:text-white ease-out duration-200'
            onClick={() => showMessageInfo(false)}
          >
            <HiMiniArrowRightStartOnRectangle />
          </button>
        </span>
      </div>

      {/* Stats Bar */}
      <div className='w-full flex items-center justify-around py-3 border-b bg-gray-50'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-customViolet'>{imageFiles.length}</div>
          <div className='text-sm text-gray-600'>Images</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-customViolet'>{videoFiles.length}</div>
          <div className='text-sm text-gray-600'>Videos</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-customViolet'>{documentFiles.length}</div>
          <div className='text-sm text-gray-600'>Documents</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-customViolet'>{allFiles.length}</div>
          <div className='text-sm text-gray-600'>Total Files</div>
        </div>
      </div>

      {/* Options Tabs */}
      <div className='w-full flex items-center border-y border-customViolet/50'>
        <button 
          type="button" 
          className={`flex gap-2 items-center py-3 px-5 border-x border-customViolet/50 ease-out duration-200 flex-1 justify-center ${
            option === 'files' 
              ? 'bg-customViolet text-white' 
              : 'hover:bg-customViolet/50 focus:bg-customViolet focus:text-white'
          }`}
          onClick={() => setOption('files')}
        >
          <RiFile3Line className='text-xl'/>
          <span>Documents</span>
          {documentFiles.length > 0 && (
            <span className="bg-white text-customViolet text-xs rounded-full px-2 py-1 min-w-6">
              {documentFiles.length}
            </span>
          )}
        </button>
        <button 
          type="button" 
          className={`flex gap-2 items-center py-3 px-5 border-r border-customViolet/50 ease-out duration-200 flex-1 justify-center ${
            option === 'media' 
              ? 'bg-customViolet text-white' 
              : 'hover:bg-customViolet/50 focus:bg-customViolet focus:text-white'
          }`}
          onClick={() => setOption('media')}
        >
          <RiImageFill className='text-xl'/>
          <span>Media</span>
          {(imageFiles.length + videoFiles.length) > 0 && (
            <span className="bg-white text-customViolet text-xs rounded-full px-2 py-1 min-w-6">
              {imageFiles.length + videoFiles.length}
            </span>
          )}
        </button>
      </div>

      {/* Files/Media Content */}
      <div className='h-full w-full overflow-x-hidden flex flex-col'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500'>Loading files...</div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-center text-gray-500'>
              <div className='text-6xl mb-4'>📁</div>
              <p>No {option === 'media' ? 'media files' : 'documents'} found</p>
              <p className='text-sm'>Shared files and media will appear here</p>
            </div>
          </div>
        ) : option === 'files' ? (
          <div className='w-full flex flex-col gap-2 p-3 overflow-y-auto'>
            {filteredFiles.map((file, i) => (
              <button 
                key={`file-${file.messageID}-${i}`}
                type='button' 
                className='w-full p-3 bg-neutral-100 rounded-xl flex gap-3 items-center hover:bg-neutral-200 focus:bg-neutral-200 ease-out duration-200' 
                onClick={() => handleFileClick(file)}
              >
                <span className='h-12 aspect-square rounded-md bg-white flex items-center justify-center text-2xl border'>
                  {getFileIcon(file.type)}
                </span>
                <div className='flex-1 text-left min-w-0'>
                  <h3 className='font-medium truncate' title={file.name}>{file.name}</h3>
                  <div className='flex items-center gap-2 text-xs text-gray-600 mt-1'>
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                    <span>•</span>
                    <span className={isOwnFile(file) ? 'text-customViolet' : 'text-gray-500'}>
                      {isOwnFile(file) ? 'You' : currentConversation?.partner.name}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className='w-full h-auto grid grid-cols-3 gap-2 p-3 overflow-y-auto'>
            {filteredFiles.map((file, i) => (
              <button 
                key={`media-${file.messageID}-${i}`}
                className='aspect-square col-span-1 bg-neutral-200 rounded-lg overflow-hidden relative group hover:opacity-90 focus:opacity-90 ease-out duration-200'
                onClick={() => handleFileClick(file)}
              >
                {file.type.startsWith('image/') ? (
                  <img 
                    src={file.url} 
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : file.type.startsWith('video/') ? (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <video className="w-full h-full object-cover">
                      <source src={file.url} type={file.type} />
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RiVideoLine className="text-3xl text-white opacity-70" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-customViolet">
                    <span className="text-2xl text-white">🎵</span>
                  </div>
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  {file.type.startsWith('video/') && (
                    <RiVideoLine className="text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  )}
                </div>
                
                {/* File type indicator */}
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
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