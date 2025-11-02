import React, { useEffect, useRef } from 'react'
import { HiOutlineDownload } from 'react-icons/hi'

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface FileInfoProps {
  showFileInfo: (fileInfo: boolean) => void;
  file: UploadedFile;
  onDownload: (url: string, filename: string) => void;
}

const ShowFileInfo = ({ showFileInfo, file, onDownload }: FileInfoProps) => {
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (imageRef.current && !imageRef.current.contains(event.target as Node)) {
        showFileInfo(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFileInfo]);

  const getFileExtension = (filename: string) => {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  return (
    <div className='absolute z-50 h-full w-full bg-white/20 backdrop-blur-md top-0 left-0 flex items-center justify-center'>
      <div ref={imageRef} className='w-4/5 max-w-md bg-white shadow-lg rounded-lg p-4 flex flex-col gap-4'>
        {/* File Preview */}
        <div className='w-full aspect-video bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden relative'>
          {isImage ? (
            <img 
              src={file.url} 
              alt={file.name}
              className="w-full h-full object-contain"
            />
          ) : isVideo ? (
            <video 
              src={file.url}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-6xl text-gray-400">
              {file.type.includes('pdf') ? '📄' : 
               file.type.includes('word') ? '📝' : '📁'}
            </div>
          )}
          
          <button 
            type="button" 
            className='absolute right-2 top-2 p-2 bg-white/80 rounded-full hover:bg-white focus:bg-white ease-out duration-200 shadow-md'
            onClick={() => onDownload(file.url, file.name)}
            title="Download file"
          >
            <HiOutlineDownload className="text-xl" />
          </button>
        </div>

        {/* File Information */}
        <div className='flex flex-col gap-3'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-medium truncate flex-1 mr-2' title={file.name}>
              {file.name}
            </h3>
            <p className='text-sm text-neutral-500 font-mono bg-neutral-100 px-2 py-1 rounded'>
              {getFileExtension(file.name).toUpperCase()}
            </p>
          </div>
          
          <div className='flex items-center justify-between text-sm text-neutral-600'>
            <p><em>{formatDate(file.uploadedAt)}</em></p>
            <p><strong>{formatFileSize(file.size)}</strong></p>
          </div>

          {/* Download Button */}
          <button
            type="button"
            className="w-full bg-customViolet text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:bg-purple-700 ease-out duration-200 flex items-center justify-center gap-2"
            onClick={() => onDownload(file.url, file.name)}
          >
            <HiOutlineDownload className="text-lg" />
            Download File
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShowFileInfo