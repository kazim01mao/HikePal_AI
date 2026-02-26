import React, { useState } from 'react';
import { Tab, Route, Track, GroupHike } from './types';
import PlanningView from './components/PlanningView';
import CompanionView from './components/CompanionView';
import HomeView from './components/HomeView';
import { Map, User, Compass } from 'lucide-react';

const MOCK_ROUTES: Route[] = [
  { 
    id: 'hk1', 
    name: 'HK Trail Sec 1: The Peak to Pok Fu Lam', 
    description: 'Starts at the Peak, offering panoramic city views before descending through lush forests to the reservoir.', 
    distance: '7.0km', 
    duration: '2h', 
    elevationGain: 120, 
    region: 'Hong Kong Island', 
    difficulty: 1, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Victoria_Peak_HK.jpg/800px-Victoria_Peak_HK.jpg'
  },
  { 
    id: 'hk2', 
    name: 'HK Trail Sec 2: Reservoir to Peel Rise', 
    description: 'A gentle section along catchwaters with views of Lamma Island and the southern coastline.', 
    distance: '4.5km', 
    duration: '1.5h', 
    elevationGain: 150, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Pok_Fu_Lam_Reservoir_6.jpg/800px-Pok_Fu_Lam_Reservoir_6.jpg'
  },
  { 
    id: 'hk3', 
    name: 'HK Trail Sec 3: Peel Rise to Wan Chai Gap', 
    description: 'Winding through Aberdeen Country Park, passing historical sites and dense woodland.', 
    distance: '6.5km', 
    duration: '2h', 
    elevationGain: 200, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Aberdeen_Upper_Reservoir_view.jpg/800px-Aberdeen_Upper_Reservoir_view.jpg'
  },
  { 
    id: 'hk4', 
    name: 'HK Trail Sec 4: Wan Chai to Wong Nai Chung', 
    description: 'Forested trail with glimpses of the northern skyline and Happy Valley.', 
    distance: '7.5km', 
    duration: '2h', 
    elevationGain: 180, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Bowen_Road_Trail_Happy_Valley.jpg/800px-Bowen_Road_Trail_Happy_Valley.jpg'
  },
  { 
    id: 'hk5', 
    name: 'HK Trail Sec 5: Mount Butler Challenge', 
    description: 'Steep climb over Jardine\'s Lookout and Mount Butler; offers the best 360-degree views on the island.', 
    distance: '4.0km', 
    duration: '1.5h', 
    elevationGain: 400, 
    region: 'Hong Kong Island', 
    difficulty: 4, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Mount_Butler_View.jpg/800px-Mount_Butler_View.jpg'
  },
  { 
    id: 'hk6', 
    name: 'HK Trail Sec 6: Butler to Tai Tam Tuk', 
    description: 'A mostly downhill section leading into the scenic Tai Tam valley and its historic dams.', 
    distance: '4.5km', 
    duration: '1.5h', 
    elevationGain: 80, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Tai_Tam_Tuk_Reservoir_Dam.jpg/800px-Tai_Tam_Tuk_Reservoir_Dam.jpg'
  },
  { 
    id: 'hk7', 
    name: 'HK Trail Sec 7: Tai Tam to To Tei Wan', 
    description: 'Flat catchwater paths and shaded trails leading towards the Shek O peninsula.', 
    distance: '7.5km', 
    duration: '2h', 
    elevationGain: 100, 
    region: 'Hong Kong Island', 
    difficulty: 1, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Dragon%27s_Back_Trail.jpg/800px-Dragon%27s_Back_Trail.jpg'
  },  { 
    id: 'hk8', 
    name: 'HK Trail Sec 8: Dragon\'s Back', 
    description: 'Features the famous Dragon\'s Back ridge walk, ending at the surfing beach of Big Wave Bay.', 
    distance: '8.5km', 
    duration: '3h', 
    elevationGain: 280, 
    region: 'Hong Kong Island', 
    difficulty: 3, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Dragons_Back_Hong_Kong.jpg/800px-Dragons_Back_Hong_Kong.jpg'
  },  // ...existing code...
  { 
    id: 'hw', 
    name: 'High West Sunset Peak', 
    description: 'A steep detour from the Peak Circle Walk with incredible sunset views over the western islands.', 
    distance: '3.5km', 
    duration: '1.5h', 
    elevationGain: 200, 
    region: 'Hong Kong Island', 
    difficulty: 3, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/High_West_Hong_Kong.jpg/800px-High_West_Hong_Kong.jpg'
  }
];

const CURRENT_USER_ID = '013cb233-62e7-46b1-b25e-1f2f2c989f9e'; // TODO: replace with real auth user id

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PLANNING);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  
  // Global State
  const [routes, setRoutes] = useState<Route[]>(MOCK_ROUTES);
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [myGroupHikes, setMyGroupHikes] = useState<GroupHike[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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

  const handleJoinGroupHike = (group: GroupHike) => {
    setMyGroupHikes(prev => {
      // Avoid duplicates if already joined/created
      if (prev.find(g => g.id === group.id)) return prev;
      return [group, ...prev];
    });
  };

  const handleDeleteGroupHike = (groupId: string) => {
    setMyGroupHikes(prev => prev.filter(g => g.id !== groupId));
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.PLANNING:
        return (
          <PlanningView
            routes={routes}
            onSelectRoute={handleRouteSelect}
            onCreateGroupHike={handleCreateGroupHike}
            onJoinGroupHike={handleJoinGroupHike}
            currentUserId={CURRENT_USER_ID}
            onGroupConfirmed={(sessionId) => {
              setActiveSessionId(sessionId);
              setActiveTab(Tab.COMPANION);
            }}
          />
        );
      case Tab.COMPANION:
        return (
          <CompanionView 
            activeRoute={currentRoute} 
            onSaveTrack={handleSaveTrack} 
            userId={CURRENT_USER_ID}
            sessionId={activeSessionId || 'f8f62915-49e1-401d-a01f-8329b1b255b4'}
          />
        );
      case Tab.HOME:
        return <HomeView myTracks={myTracks} myGroupHikes={myGroupHikes} onPublishTrack={handlePublishTrack} onDeleteGroupHike={handleDeleteGroupHike} />;
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