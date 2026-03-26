import React from 'react';
import { useHikeStore } from '../store/hikeStore';
import { X, Play, Pointer } from 'lucide-react';

export const MovementModeModal: React.FC = () => {
  const { isModalOpen, setModalOpen, setMode, isDirectRecord } = useHikeStore();

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">mode selection</h2>
          <button 
            onClick={() => setModalOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {!isDirectRecord && (
            <button
              onClick={() => {
                setMode('scrubbing');
                setModalOpen(false);
              }}
              className="w-full flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-200 mr-4">
                <Pointer className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-800">Manual Path Scrubbing</h3>
                <p className="text-sm text-gray-500">Simulate hike by dragging along the route</p>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              setMode('live');
              setModalOpen(false);
            }}
            className="w-full flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="bg-green-100 p-3 rounded-full group-hover:bg-green-200 mr-4">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-800">Live Hike</h3>
              <p className="text-sm text-gray-500">Track your real-time GPS location</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
