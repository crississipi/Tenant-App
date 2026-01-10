import React from 'react';
import { RiToolsFill, RiRobot2Fill, RiCloseLine } from 'react-icons/ri';
import { HiSparkles } from 'react-icons/hi2';

interface MaintenanceRequestOptionsProps {
  onClose: () => void;
  onManual: () => void;
  onAI: () => void;
}

const MaintenanceRequestOptions: React.FC<MaintenanceRequestOptionsProps> = ({ onClose, onManual, onAI }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="relative p-6 pt-8 text-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <RiCloseLine className="text-2xl" />
          </button>
          
          <div className="w-16 h-16 bg-customViolet/10 text-customViolet rounded-2xl flex items-center justify-center mx-auto mb-4">
             <RiToolsFill className="text-3xl" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Request</h2>
          <p className="text-gray-500 text-sm px-6">
            Choose how you would like to submit your maintenance request.
          </p>
        </div>

        <div className="p-6 pt-2 flex flex-col gap-4">
          <button
            onClick={onAI}
            className="group relative w-full p-4 rounded-xl border-2 border-customViolet/20 bg-customViolet/5 hover:bg-customViolet/10 hover:border-customViolet transition-all duration-300 text-left flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-customViolet to-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <HiSparkles className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 group-hover:text-customViolet transition-colors flex items-center gap-2">
                Ai Assisted
                <span className="px-2 py-0.5 rounded-full bg-linear-to-r from-customViolet to-fuchsia-600 text-[10px] font-bold text-white uppercase tracking-wider">New</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Take photos and let our AI analyze the issue, suggest severity, and draft the description for you.
              </p>
            </div>
          </button>

          <button
            onClick={onManual}
            className="group w-full p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-left flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover:bg-gray-200 group-hover:text-gray-700 transition-colors">
              <RiToolsFill className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 group-hover:text-gray-900 transition-colors">
                Manual Entry
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Fill out the form manually with your own description and images.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceRequestOptions;
