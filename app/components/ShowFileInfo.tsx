import React, { useEffect, useRef } from 'react'
import { HiOutlineDownload, HiX } from 'react-icons/hi'

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
      month: 'long',
      day: 'numeric'
    });
  };

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  return (
    <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200'>
      <div ref={imageRef} className='w-full max-w-md bg-white shadow-2xl rounded-[2rem] p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 relative'>
        
        {/* Close Button */}
        <button 
          onClick={() => showFileInfo(false)}
          className='absolute right-4 top-4 p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors z-10'
        >
          <HiX />
        </button>

        {/* File Preview */}
        <div className='w-full aspect-video bg-gray-50 rounded-[1.5rem] flex items-center justify-center overflow-hidden relative border border-gray-100'>
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
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <span className="text-6xl">
                {file.type.includes('pdf') ? '📄' : 
                 file.type.includes('word') ? '📝' : '📁'}
              </span>
              <span className="text-sm font-medium uppercase tracking-wider">No Preview</span>
            </div>
          )}
        </div>

        {/* File Information */}
        <div className='flex flex-col gap-4'>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex flex-col overflow-hidden'>
              <h3 className='text-lg font-bold text-gray-800 truncate' title={file.name}>
                {file.name}
              </h3>
              <p className='text-xs text-gray-500 font-medium'>
                Uploaded on {formatDate(file.uploadedAt)}
              </p>
            </div>
            <span className='text-xs font-bold text-customViolet bg-customViolet/10 px-3 py-1 rounded-full whitespace-nowrap'>
              {getFileExtension(file.name).toUpperCase()}
            </span>
          </div>
          
          <div className='flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100'>
            <span className='text-sm text-gray-500'>File Size</span>
            <span className='text-sm font-bold text-gray-800'>{formatFileSize(file.size)}</span>
          </div>

          {/* Download Button */}
          <button
            type="button"
            className="w-full bg-customViolet text-white py-4 rounded-xl font-bold shadow-lg shadow-customViolet/30 hover:shadow-customViolet/50 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
            onClick={() => onDownload(file.url, file.name)}
          >
            <HiOutlineDownload className="text-xl" />
            Download File
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShowFileInfo