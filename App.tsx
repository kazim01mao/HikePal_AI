// App.tsx 完整逻辑参考
import React, { useState, useEffect } from 'react';
import { Tab, User, Route, Track } from './types';
import { supabase } from './utils/supabaseClient';
import { AuthPage } from './components/AuthPage';
import PlanningView from './components/PlanningView';
import CompanionView from './components/CompanionView';
import HomeView from './components/HomeView';
import { Map, User as UserIcon, Compass } from 'lucide-react';
interface AppState {
  error: string | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, AppState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">应用崩溃了</h1>
            <p className="text-gray-600 mb-4 font-mono text-sm break-words">{this.state.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 rounded-lg font-bold"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);  // 改为 HOME
  const [loading, setLoading] = useState(true);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [myGroupHikes, setMyGroupHikes] = useState([]);

  const handleSaveTrack = (track: Track) => {
    setMyTracks(prev => [...prev, track]);
    console.log('Track saved:', track);
  };

  const handlePublishTrack = (track: Track) => {
    console.log('Track published:', track);
  };

  const handleDeleteGroupHike = (groupId: string) => {
    setMyGroupHikes(prev => prev.filter(h => h.id !== groupId));
  };

  useEffect(() => {
    // 1. 初始化检查登录状态
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user as any);
      setLoading(false);
    });

    // 2. 监听状态变化（登录或退出）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as any || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // --- 逻辑判断：如果未登录显示登录页 ---
  if (!user) {
    return <AuthPage onLoginSuccess={(u) => setUser(u)} />;
  }

  // --- 逻辑判断：如果已登录显示主界面 ---
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {activeTab === Tab.PLANNING && (
          <PlanningView currentUserId={user.id} />
        )}
        {activeTab === Tab.COMPANION && (
          <CompanionView 
            user={user}
            activeRoute={activeRoute}
            onSaveTrack={handleSaveTrack}
            userId={user.id}
            sessionId={`session_${Date.now()}`}
          />
        )}
        {activeTab === Tab.HOME && (
          <HomeView 
            user={user}
            onLogout={() => supabase.auth.signOut()}
            myTracks={myTracks}
            myGroupHikes={myGroupHikes}
            onPublishTrack={handlePublishTrack}
            onDeleteGroupHike={handleDeleteGroupHike}
          />
        )}
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around py-3 z-50">
        <button onClick={() => setActiveTab(Tab.PLANNING)} className={activeTab === Tab.PLANNING ? 'text-hike-green' : 'text-gray-400'}>
          <Compass size={24} /><span className="text-[10px]">Explore</span>
        </button>
        <button onClick={() => setActiveTab(Tab.COMPANION)} className={activeTab === Tab.COMPANION ? 'text-hike-green' : 'text-gray-400'}>
          <Map size={24} /><span className="text-[10px]">HikePal AI</span>
        </button>
        <button onClick={() => setActiveTab(Tab.HOME)} className={activeTab === Tab.HOME ? 'text-hike-green' : 'text-gray-400'}>
          <UserIcon size={24} /><span className="text-[10px]">Profile</span>
        </button>
      </nav>
    </div>
  );
};

function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default RootApp;