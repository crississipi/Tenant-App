"use client";

import { MessageBubbleProps } from '@/types';
import React, { useState } from 'react';
import Image from 'next/image';
import { RiFile3Line, RiVideoLine } from 'react-icons/ri';
import { HiOutlineDocument } from 'react-icons/hi';
import { AnimatePresence } from 'framer-motion';

const MessageBubble = ({ sender, message, timestamp, files }: MessageBubbleProps) => {
  const [details, setDetails] = useState(false);

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return 'FILE';
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('word') || fileType.includes('doc')) return 'DOC';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'CSV';
    return 'TXT';
  };

  const formatFileSize = (bytes: string | null | undefined) => {
    if (!bytes) return '';
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const hasMedia = files && files.length > 0;
  const imageFiles = files?.filter(f => f.fileType?.startsWith('image/')) || [];
  const videoFiles = files?.filter(f => f.fileType?.startsWith('video/')) || [];
  const documentFiles = files?.filter(f => !f.fileType?.startsWith('image/') && !f.fileType?.startsWith('video/')) || [];

  return (
    <div className={`w-full flex flex-col ${!sender ? 'items-start' : 'items-end'} mb-2`}>
      {details && (
        <span className='text-[10px] font-medium text-gray-400 mb-1 px-2 uppercase tracking-wider'>
          {formatDate(timestamp)}
        </span>
      )}

      <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${!sender ? 'items-start' : 'items-end'} gap-1`}>
        {/* Text Message */}
        {message && (
          <button
            onClick={() => setDetails(!details)}
            className={`py-3 px-5 text-left text-sm md:text-base leading-relaxed shadow-sm transition-all duration-200 active:scale-95 ${
              !sender 
                ? 'rounded-[1.5rem] rounded-tl-none bg-white text-gray-700 border border-gray-100'
                : 'rounded-[1.5rem] rounded-tr-none bg-customViolet text-white shadow-customViolet/20'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message}</p>
          </button>
        )}

        {/* Media Grid */}
        {hasMedia && (
          <div className={`flex flex-col gap-2 mt-1 ${sender ? 'items-end' : 'items-start'}`}>
            {/* Images Grid */}
            {imageFiles.length > 0 && (
              <div className={`grid gap-1.5 ${imageFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} rounded-[1.5rem] overflow-hidden`}>
                {imageFiles.slice(0, 4).map((file, index) => (
                  <button
                    key={index}
                    onClick={() => window.open(file.url, '_blank')}
                    className={`relative overflow-hidden hover:opacity-90 transition-opacity bg-gray-100 ${
                      imageFiles.length === 1 ? 'h-64 w-64 rounded-[1.5rem]' : 'h-32 w-32'
                    }`}
                  >
                    <Image
                      src={file.url}
                      alt={file.fileName}
                      fill
                      sizes={imageFiles.length === 1 ? "256px" : "128px"}
                      className="object-cover"
                    />
                    {index === 3 && imageFiles.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xl font-bold backdrop-blur-sm">
                        +{imageFiles.length - 4}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Videos */}
            {videoFiles.map((file, index) => (
              <button
                key={index}
                onClick={() => window.open(file.url, '_blank')}
                className="relative w-64 h-40 rounded-2xl overflow-hidden bg-black hover:opacity-90 transition-opacity shadow-md"
              >
                <video src={file.url} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                    <RiVideoLine className="text-white text-2xl ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  VIDEO
                </div>
              </button>
            ))}

            {/* Documents */}
            {documentFiles.map((file, index) => (
              <button
                key={index}
                onClick={() => window.open(file.url, '_blank')}
                className={`flex items-center gap-3 p-3 rounded-2xl hover:shadow-md transition-all border ${
                  !sender 
                    ? 'bg-white text-gray-700 border-gray-100' 
                    : 'bg-white/10 backdrop-blur-sm text-white border-white/20'
                } min-w-[200px] max-w-xs`}
              >
                <div className={`
                  text-[10px] font-bold rounded-lg p-2 text-white shadow-sm
                  ${file.fileType?.includes('pdf') ? 'bg-rose-500' : 
                    file.fileType?.includes('word') || file.fileType?.includes('doc') ? 'bg-blue-500' : 
                    file.fileType?.includes('excel') || file.fileType?.includes('sheet') ? 'bg-emerald-500' : 'bg-gray-500'}
                `}>
                  {getFileIcon(file.fileType)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className={`font-medium truncate text-sm ${sender ? 'text-white' : 'text-gray-800'}`}>{file.fileName}</p>
                  <p className={`text-xs ${sender ? 'text-white/70' : 'text-gray-400'}`}>{formatFileSize(file.fileSize)}</p>
                </div>
                <HiOutlineDocument className={`text-xl ${sender ? 'text-white/70' : 'text-gray-400'}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {details && (
        <span className={`text-[10px] font-medium text-gray-400 mt-1 px-1 ${sender ? 'mr-1' : 'ml-1'}`}>
          {formatTime(timestamp)}
        </span>
      )}
    </div>
  );
};

export default MessageBubble;