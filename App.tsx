import React, { useState } from 'react';
import { Tab, Route, Track, GroupHike } from './types';
import PlanningView from './components/PlanningView';
import CompanionView from './components/CompanionView';
import HomeView from './components/HomeView';
import { Map, User, Compass } from 'lucide-react';

const MOCK_ROUTES: Route[] = [
  {
    id: '1',
    name: 'Dragon\'s Back to Cape D\'Aguilar',
    region: 'Hong Kong Island',
    distance: '8.5 km',
    duration: '4h 30m',
    difficulty: 3,
    description: 'A classic scenic hike combining the ridge views of Dragon\'s Back with the coastal geology of Cape D\'Aguilar. Starting from To Tei Wan.',
    startPoint: 'To Tei Wan Bus Stop',
    endPoint: 'Cape D\'Aguilar',
    elevationGain: 284
  },
  {
    id: '2',
    name: 'Lion Rock Peak',
    region: 'Kowloon',
    distance: '6 km',
    duration: '3h',
    difficulty: 4,
    description: 'Famous peak resembling a lion, offering panoramic views of Kowloon and Hong Kong Island.',
    startPoint: 'Wong Tai Sin',
    endPoint: 'Wong Tai Sin',
    elevationGain: 495
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PLANNING);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  
  // Global State
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES);
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [myGroupHikes, setMyGroupHikes] = useState<GroupHike[]>([]);

  const handleRouteSelect = (route: Route) => {
    setCurrentRoute(route);
    setActiveTab(Tab.COMPANION);
  };

  const handleSaveTrack = (track: Track) => {
    setMyTracks(prev => [track, ...prev]);
    setActiveTab(Tab.HOME); // Go to home to see saved track
  };

  const handlePublishTrack = (track: Track) => {
    // Convert Track to Route
    const newRoute: Route = {
      id: `pub-${Date.now()}`,
      name: track.name,
      region: 'Custom User Route',
      distance: track.distance,
      duration: track.duration,
      difficulty: 3, // Default for now
      description: `Community route uploaded by Alex. Recorded on ${track.date.toLocaleDateString()}.`,
      startPoint: 'Unknown',
      endPoint: 'Unknown',
      elevationGain: 100 + Math.floor(Math.random() * 500),
      isUserPublished: true
    };
    setRoutes(prev => [newRoute, ...prev]);
    alert('Route successfully published to the community!');
    setActiveTab(Tab.PLANNING);
  };

  const handleCreateGroupHike = (hike: GroupHike) => {
      setMyGroupHikes(prev => [hike, ...prev]);
      alert("Group Hike Created! It is now visible on your Profile.");
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.PLANNING:
        return <PlanningView routes={routes} onSelectRoute={handleRouteSelect} onCreateGroupHike={handleCreateGroupHike} />;
      case Tab.COMPANION:
        return <CompanionView activeRoute={currentRoute} onSaveTrack={handleSaveTrack} />;
      case Tab.HOME:
        return <HomeView myTracks={myTracks} myGroupHikes={myGroupHikes} onPublishTrack={handlePublishTrack} />;
      default:
        return <PlanningView routes={routes} onSelectRoute={handleRouteSelect} onCreateGroupHike={handleCreateGroupHike} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-16 bg-white border-t border-gray-200 flex justify-around items-center px-2 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab(Tab.PLANNING)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.PLANNING ? 'text-hike-green' : 'text-gray-400'}`}
        >
          <Compass size={24} strokeWidth={activeTab === Tab.PLANNING ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Explore</span>
        </button>

        <button 
          onClick={() => setActiveTab(Tab.COMPANION)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.COMPANION ? 'text-hike-green' : 'text-gray-400'}`}
        >
          <div className={`p-1 rounded-full ${activeTab === Tab.COMPANION ? 'bg-green-50' : ''}`}>
             <Map size={24} strokeWidth={activeTab === Tab.COMPANION ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium">HikePal AI</span>
        </button>

        <button 
          onClick={() => setActiveTab(Tab.HOME)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.HOME ? 'text-hike-green' : 'text-gray-400'}`}
        >
          <User size={24} strokeWidth={activeTab === Tab.HOME ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Me</span>
        </button>
      </nav>
    </div>
  );
};

export default App;