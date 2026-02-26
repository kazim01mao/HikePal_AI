import React, { useState, useEffect, useRef } from 'react';
import { Route, HikingEvent, GroupHike } from '../types';
import {
  MapPin,
  Download,
  MessageSquare,
  Users,
  Calendar,
  ChevronRight,
  Star,
  Mountain,
  User,
  ArrowLeft,
  Plus,
  Flag,
  Recycle,
  ShieldAlert,
  Share2,
  Compass,
  Sparkles,
  Clock, 
  QrCode
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { 
  DRAGONS_BACK_COORDINATES, 
  HK_TRAIL_SECTION_1_COORDINATES,
  SECTION_2_COORDINATES,
  SECTION_3_COORDINATES,
  SECTION_4_COORDINATES,
  SECTION_5_COORDINATES,
  SECTION_6_COORDINATES,
  SECTION_7_COORDINATES
} from '../utils/trailData';

interface PlanningViewProps {
  routes: Route[];
  onSelectRoute: (route: Route) => void;
  onCreateGroupHike: (hike: GroupHike) => void;
  onJoinGroupHike?: (group: GroupHike) => void;
  // 当前登录用户，用于写入 hike_sessions.user_id
  currentUserId: string;
  // 确认出行后，通知上层开始 Companion（携带 sessionId）
  onGroupConfirmed?: (sessionId: string) => void;
}

const MOCK_EVENTS: HikingEvent[] = [
    { id: 'e1', title: 'Dragon\'s Back Trash Cleanup', type: 'cleanup', date: 'Sat, 12 Oct', location: 'Shek O', participants: 45, imageUrl: 'https://picsum.photos/400/200?random=10' },
    { id: 'e2', title: 'Obstacle Clearing: Lantau Trail', type: 'maintenance', date: 'Sun, 13 Oct', location: 'Lantau', participants: 12, imageUrl: 'https://picsum.photos/400/200?random=11' },
    { id: 'e3', title: 'Trail Ribbon Placement Guide', type: 'guide', date: 'Sat, 19 Oct', location: 'Sai Kung', participants: 28, imageUrl: 'https://picsum.photos/400/200?random=12' },
];

const MOCK_NEARBY_GROUPS: GroupHike[] = [
  {
    id: 'g1',
    title: 'Peak Morning Walk',
    description: 'Intermediate group aiming for steady pace and photo breaks.',
    date: '2026-03-15',
    maxMembers: 5,
    currentMembers: 3,
    isOrganizer: false,
    members: ['Jason', 'Mei', 'Tom'],
    routeId: 'hk1',
    planned_duration: '3h',
    experience_level: 'occasional',
    initial_mood: 'Energetic',
  },
  {
    id: 'g2',
    title: 'Photography Slow Walk',
    description: 'Very slow, photo-friendly walk suitable for beginners.',
    date: '2026-03-20',
    maxMembers: 10,
    currentMembers: 8,
    isOrganizer: false,
    members: ['Lily', 'Ken', 'Sara', 'Leo'],
    routeId: 'hk2',
    planned_duration: '2h',
    experience_level: 'first_time',
    initial_mood: 'Peaceful',
  },
  {
    id: 'g3',
    title: 'Dragon\'s Back Challenge',
    description: 'A challenging hike for experienced hikers.',
    date: '2026-03-22',
    maxMembers: 7,
    currentMembers: 5,
    isOrganizer: false,
    members: ['John', 'Paul', 'George', 'Ringo'],
    routeId: 'hk8',
    planned_duration: '5h',
    experience_level: 'advanced',
    initial_mood: 'Adventurous',
  }
];

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
  },
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
  },
];

const MOCK_REVIEWS = [
  { id: 1, user: 'John D.', date: '2 days ago', rating: 5, comment: 'Amazing views from the ridge! The descent to Big Wave Bay was a bit steep but worth it.', avatar: 'male' },
  { id: 2, user: 'Sarah M.', date: '1 week ago', rating: 4, comment: 'Great trail for a weekend hike. Highly recommend starting early to avoid the heat.', avatar: 'female' },
  { id: 3, user: 'Mike R.', date: '3 days ago', rating: 5, comment: 'One of the best trails in HK. Well-marked and great scenery.', avatar: 'male' },
  { id: 4, user: 'Emily L.', date: '5 days ago', rating: 4, comment: 'Beautiful scenery! The Peak section is always crowded but Section 1 is lovely.', avatar: 'female' }
];

const PlanningView: React.FC<PlanningViewProps> = ({
  routes,
  onSelectRoute,
  onCreateGroupHike,
  onJoinGroupHike,
  currentUserId,
  onGroupConfirmed
}) => {
  const [selectedCity] = useState('Hong Kong');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'routes' | 'start_hiking' | 'events'>('routes');
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>(routes);

  // Start Hiking / AI Search State
  const [aiMood, setAiMood] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [aiCondition, setAiCondition] = useState('');
  const [aiMatched, setAiMatched] = useState(false);
  // Start Hiking selection state: 'solo' | 'group' | 'join' | ''
  const [startSelection, setStartSelection] = useState<'solo'|'group'|'join'|''>('');
  const [createdGroup, setCreatedGroup] = useState<GroupHike | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [teamIdInput, setTeamIdInput] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<''|'easy'|'medium'|'hard'>('');
  const [showTeamDetail, setShowTeamDetail] = useState(false);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(true);

  // Partner Form State
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSize, setGroupSize] = useState<number | ''>('');
  const [groupTime, setGroupTime] = useState('');
  const [groupMeetingPoint, setGroupMeetingPoint] = useState('');
  const [plannedDuration, setPlannedDuration] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'first_time' | 'occasional' | 'advanced' | ''>('');
  const [initialMood, setInitialMood] = useState('');
  const [nearbyGroups, setNearbyGroups] = useState<GroupHike[]>(MOCK_NEARBY_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<GroupHike | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const detailMapRef = useRef<HTMLDivElement>(null);
  const detailMapInstanceRef = useRef<any>(null);

  const activeRoute = routes.find(r => r.id === activeRouteId);

  useEffect(() => {
    if (activeRouteId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Also scroll the inner container if it's the one overflowing
      const container = document.querySelector('.flex-1.overflow-y-auto');
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeRouteId]);

  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    if (!detailMapRef.current || !L || !activeRoute) return;

    if (detailMapInstanceRef.current) {
        detailMapInstanceRef.current.remove();
        detailMapInstanceRef.current = null;
    }

    const map = L.map(detailMapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        touchZoom: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    let coords: [number, number][] = [];
    if (activeRoute.id === 'hk8') {
        coords = DRAGONS_BACK_COORDINATES;
    } else if (activeRoute.id === 'hk7') {
        coords = SECTION_7_COORDINATES;
    } else if (activeRoute.id === 'hk1') {
        coords = HK_TRAIL_SECTION_1_COORDINATES;
    } else if (activeRoute.id === 'hk2') {
        coords = SECTION_2_COORDINATES;
    } else if (activeRoute.id === 'hk3') {
        coords = SECTION_3_COORDINATES;
    } else if (activeRoute.id === 'hk4') {
        coords = SECTION_4_COORDINATES;
    } else if (activeRoute.id === 'hk5') {
        coords = SECTION_5_COORDINATES;
    } else if (activeRoute.id === 'hk6') {
        coords = SECTION_6_COORDINATES;
    }

    if (coords.length > 0) {
        const polyline = L.polyline(coords, { color: '#2E7D32', weight: 5, opacity: 0.8 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } else {
        map.setView([22.26, 114.18], 12); // Focus on HK Island
    }

    detailMapInstanceRef.current = map;

    // Fix for Leaflet initialization in a dynamic container
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            if (coords.length > 0) {
                map.fitBounds(L.polyline(coords).getBounds(), { padding: [20, 20] });
            }
        }
    }, 100);

    return () => {
        if (detailMapInstanceRef.current) {
            detailMapInstanceRef.current.remove();
            detailMapInstanceRef.current = null;
        }
    };
  }, [activeRoute]);

  // AI Route Search Handler
  const handleAIRouteSearch = () => {
    if (!aiMood && !aiDifficulty && !aiCondition) {
      alert('Please enter your mood, difficulty, or condition');
      return;
    }

    let filtered = routes;
    
    if (aiDifficulty) {
      filtered = filtered.filter(r => 
        (aiDifficulty === 'easy' && r.difficulty <= 2) ||
        (aiDifficulty === 'medium' && (r.difficulty === 2 || r.difficulty === 3 || r.difficulty === 4)) ||
        (aiDifficulty === 'hard' && r.difficulty >= 4)
      );
    }

    setFilteredRoutes(filtered);
    setAiMatched(true);
  };

  // Route Search Handler
  const handleRouteSearch = (query: string) => {
    setRouteSearchQuery(query);
    if (!query.trim()) {
      setFilteredRoutes(routes);
    } else {
      const filtered = routes.filter(r =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.region.toLowerCase().includes(query.toLowerCase()) ||
        r.description.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredRoutes(filtered);
    }
  };

  const renderRating = (rating: number) => {
    return (
      <div className="flex text-yellow-500">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} fill={i < rating ? "currentColor" : "none"} className={i < rating ? "" : "text-gray-300"} />
        ))}
      </div>
    );
  };

  const handleCreateGroup = () => {
    if (!groupTitle) return;
    const size = typeof groupSize === 'number' ? groupSize : 4;
    const newGroup: GroupHike = {
      id: Date.now().toString(),
      title: groupTitle,
      description: groupDesc || 'Join us for a hike!',
      date: groupTime || 'To be decided',
      maxMembers: size || 4,
      currentMembers: 1,
      isOrganizer: true,
      members: ['You'],
      meetingPoint: groupMeetingPoint || 'To be decided',
      startTime: groupTime,
      companionCount: size,
      status: 'draft'
    };
    // 1) 写入全局「我的活动」
    onCreateGroupHike(newGroup);
    // 2) 立即插入当前页面的 Nearby 列表
    setNearbyGroups(prev => [newGroup, ...prev]);
    // 3) 重置表单，但保持在 partner 视图，方便直接看到新建的 group
    setGroupTitle('');
    setGroupDesc('');
    setGroupSize('');
    setGroupTime('');
    setGroupMeetingPoint('');
    // keep createdGroup available for dashboard
    setCreatedGroup(newGroup);
  };

  const handleCreateGroupAndStart = () => {
    if (!groupTitle) return;
    handleCreateGroup();
    setStartSelection('group');
  };

  const handleJoinGroup = (group: GroupHike) => {
    // 不允许超过上限
    if (group.currentMembers >= group.maxMembers) return;

    const updatedGroup: GroupHike = {
      ...group,
      currentMembers: Math.min(group.currentMembers + 1, group.maxMembers)
    };

    // 本地更新「Nearby Groups」的人数
    setNearbyGroups(prev =>
      prev.map(g => (g.id === group.id ? updatedGroup : g))
    );

    // 通知上层，把这个活动也写入「My Activities」
    if (onJoinGroupHike) {
      onJoinGroupHike(updatedGroup);
    }
  };

  // --- Sub-View: Events ---
  if (viewMode === 'events') {
      return (
          <div className="flex flex-col h-full bg-gray-50 animate-fade-in">
              <div className="bg-white p-4 shadow-sm flex items-center gap-3">
                  <button onClick={() => setViewMode('routes')} className="p-1"><ArrowLeft size={24} /></button>
                  <h2 className="text-xl font-bold">Community Events</h2>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto pb-20">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm flex items-start gap-3">
                      <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                      <div>
                          <span className="font-bold">Official Activities</span>
                          <p className="text-blue-600/80 text-xs mt-1">Earn badges and points by participating in conservation efforts.</p>
                      </div>
                  </div>

                  {MOCK_EVENTS.map(evt => (
                      <div key={evt.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                          <div className="h-32 w-full relative">
                              <img src={evt.imageUrl} className="w-full h-full object-cover" alt={evt.title} />
                              <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-bold text-gray-700">
                                  {evt.type.toUpperCase()}
                              </div>
                          </div>
                          <div className="p-4">
                              <h3 className="font-bold text-lg mb-1">{evt.title}</h3>
                              <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                                  <Calendar size={14} /> {evt.date}
                                  <span className="mx-1">•</span>
                                  <MapPin size={14} /> {evt.location}
                              </div>
                              <div className="flex items-center justify-between">
                                  <div className="flex -space-x-2">
                                      {[1,2,3].map(i => (
                                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-300"></div>
                                      ))}
                                      <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold">+{evt.participants}</div>
                                  </div>
                                  <button className="bg-hike-green text-white px-4 py-1.5 rounded-full text-sm font-bold shadow hover:bg-hike-dark">Join</button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )
  }

  // --- Sub-View: Start Hiking ---
  if (viewMode === 'start_hiking') {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-100 to-gray-50 animate-fade-in">
        {/* Glassmorphism Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm px-4 py-5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode('routes')} 
              className="p-2.5 hover:bg-gray-100 rounded-full transition active:scale-90 duration-200"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">Start Hiking</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose your adventure type</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
          {/* Premium Selection Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button 
              onClick={() => setStartSelection('solo')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'solo' 
                  ? 'bg-gradient-to-br from-hike-green to-hike-dark text-white shadow-lg shadow-hike-green/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-hike-green/30'
              }`}
            >
              <div className="text-2xl mb-1">🏔️</div>
              <div className="text-sm font-bold">Solo</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'solo' ? 'Selected' : 'Just you'}</div>
            </button>
            <button 
              onClick={() => setStartSelection('group')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'group' 
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-orange-300/30'
              }`}
            >
              <div className="text-2xl mb-1">👥</div>
              <div className="text-sm font-bold">Group</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'group' ? 'Selected' : 'With friends'}</div>
            </button>
            <button 
              onClick={() => setStartSelection('join')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'join' 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300/30'
              }`}
            >
              <div className="text-2xl mb-1">🤝</div>
              <div className="text-sm font-bold">Join</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'join' ? 'Selected' : 'Open teams'}</div>
            </button>
          </div>

          {/* Conditional panels based on selection */}
          {startSelection === 'solo' && (
            <div className={`transition-all duration-300 opacity-100 space-y-5 animate-fade-in`}>
              {/* AI Route Recommendation */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 mb-6">
                <h3 className="font-bold text-xl mb-5 flex items-center gap-2 text-gray-900">
                  <Sparkles size={24} className="text-orange-500" /> Your Perfect Match
                </h3>
                <div className="space-y-5">
                  {/* Mood Selection - Preset Emojis */}
                  <div>
                    <label className="text-xs text-gray-600 font-bold uppercase tracking-wider block mb-3">How are you feeling?</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { emoji: '⚡', label: 'Energetic', value: 'Energetic' },
                        { emoji: '😌', label: 'Peaceful', value: 'Peaceful' },
                        { emoji: '🎯', label: 'Adventurous', value: 'Adventurous' },
                        { emoji: '🌅', label: 'Scenic', value: 'Scenic' }
                      ].map((mood) => (
                        <button
                          key={mood.value}
                          onClick={() => setAiMood(mood.value)}
                          className={`py-3 px-2 rounded-xl text-center transition-all duration-200 transform active:scale-95 ${
                            aiMood === mood.value
                              ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30'
                              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <div className="text-2xl mb-1">{mood.emoji}</div>
                          <div className="text-[10px] font-bold">{mood.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty Level */}
                  <div>
                    <label className="text-xs text-gray-600 font-bold uppercase tracking-wider block mb-3">Challenge Level</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Easy', value: 'easy', icon: '🟢' },
                        { label: 'Medium', value: 'medium', icon: '🟡' },
                        { label: 'Hard', value: 'hard', icon: '🔴' }
                      ].map((diff) => (
                        <button
                          key={diff.value}
                          onClick={() => setAiDifficulty(diff.value)}
                          className={`py-3 px-3 rounded-xl text-center font-bold transition-all duration-200 transform active:scale-95 ${
                            aiDifficulty === diff.value
                              ? 'bg-gradient-to-br from-hike-green to-hike-dark text-white shadow-lg shadow-hike-green/30'
                              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="text-lg mb-1">{diff.icon}</div>
                          <div className="text-xs">{diff.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Your Condition */}
                  <div>
                    <label className="text-xs text-gray-600 font-bold uppercase tracking-wider block mb-2">Your Condition</label>
                    <textarea 
                      value={aiCondition}
                      onChange={e => setAiCondition(e.target.value)}
                      placeholder="E.g. Well-rested, had coffee, feeling strong..." 
                      className="w-full border-2 border-gray-200 py-3 px-3 focus:outline-none focus:border-orange-500 h-24 resize-none rounded-xl bg-gray-50/50 focus:bg-white transition-colors"
                    />
                  </div>

                  <button 
                    onClick={handleAIRouteSearch}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    Find My Perfect Route
                  </button>
                </div>
              </div>

              {/* Recommended Routes (only after matching) */}
              {!aiMatched ? (
                <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-4 text-center">
                  <p className="text-blue-900 font-semibold text-sm">💡 Tap "Find My Perfect Route" to discover trails that match your mood and energy level.</p>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-bold text-gray-900 text-lg">✨ Routes Made for You</h3>
                    <span className="text-xs bg-hike-green text-white px-2 py-1 rounded-full font-bold">{filteredRoutes.length}</span>
                  </div>
                  <div className="space-y-3">
                    {filteredRoutes.map((route, idx) => (
                      <div
                        key={route.id}
                        onClick={() => setActiveRouteId(route.id)}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-hike-green/50 cursor-pointer active:scale-[0.98] transition-all duration-300 overflow-hidden flex hover:scale-102"
                      >
                        <div className="w-28 h-28 flex-shrink-0 relative overflow-hidden">
                          <img 
                            src={route.imageUrl || `https://picsum.photos/seed/${route.id}/200/200`} 
                            className="w-full h-full object-cover" 
                            alt={route.name} 
                          />
                          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[10px] font-bold">#{ idx + 1}</div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{route.name}</h4>
                              <span className="text-[10px] bg-hike-light text-hike-green font-bold px-2 py-1 rounded-full flex-shrink-0 ml-2">
                                {route.difficulty <= 2 ? '🟢 Easy' : route.difficulty <= 3 ? '🟡 Medium' : '🔴 Hard'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mb-2">{route.region}</p>
                          </div>
                          <div className="flex gap-3 text-[11px] text-gray-600 font-semibold">
                            <span className="flex items-center gap-1">📍 {route.distance}</span>
                            <span className="flex items-center gap-1">⏱️ {route.duration}</span>
                            <span className="flex items-center gap-1">🎒 {route.elevationGain}m</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {startSelection === 'join' && (
            <div className={`transition-all duration-300 opacity-100 space-y-5 animate-fade-in`}>
              {/* Quick Search by Team ID */}
              <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-sm border border-white/50">
                <label className="text-xs text-gray-600 font-bold uppercase tracking-wider block mb-3">Have a Team ID?</label>
                <div className="flex gap-2">
                  <input 
                    value={teamIdInput} 
                    onChange={e => setTeamIdInput(e.target.value)} 
                    placeholder="Enter Team ID..." 
                    className="flex-1 border-2 border-gray-200 py-3 px-3 rounded-xl focus:outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-colors" 
                  />
                  <button 
                    className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm" 
                    onClick={() => {
                      const found = MOCK_NEARBY_GROUPS.find(g => g.id === teamIdInput);
                      if (found) setSelectedGroup(found);
                      else alert('Team not found');
                    }}
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Discover Teams */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50">
                <h4 className="font-bold text-lg mb-4 text-gray-900 flex items-center gap-2">
                  🌍 Discover Teams
                </h4>
                <div className="flex gap-3 mb-5">
                  {/* Date Filter */}
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="flex-1 border-2 border-gray-200 p-2.5 rounded-xl text-sm font-medium bg-gray-50/50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  >
                    <option value="">📅 Any Date</option>
                    <option value="2026-03-15">March 15, 2026</option>
                    <option value="2026-03-20">March 20, 2026</option>
                    <option value="2026-03-22">March 22, 2026</option>
                  </select>
                  {/* Difficulty Filter */}
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as any)}
                    className="flex-1 border-2 border-gray-200 p-2.5 rounded-xl text-sm font-medium bg-gray-50/50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  >
                    <option value="">🎯 Any Level</option>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                  </select>
                </div>

                {
                  (() => {
                    const filteredNearbyGroups = MOCK_NEARBY_GROUPS.filter(group => {
                      if (filterDate && group.date !== filterDate) return false;
                      if (filterDifficulty) {
                        const route = MOCK_ROUTES.find(r => r.id === group.routeId);
                        if (!route) return false;
                        if (
                          (filterDifficulty === 'easy' && route.difficulty > 2) ||
                          (filterDifficulty === 'medium' && (route.difficulty < 2 || route.difficulty > 4)) ||
                          (filterDifficulty === 'hard' && route.difficulty < 4)
                        ) return false;
                      }
                      return true;
                    });

                    return (
                      <div className="space-y-3 mt-5">
                        {filteredNearbyGroups.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <div className="text-4xl mb-2">🔍</div>
                            <div className="text-sm font-medium">No teams match your filters</div>
                          </div>
                        ) : (
                          filteredNearbyGroups.map(g => {
                            const route = MOCK_ROUTES.find(r => r.id === g.routeId);
                            const diffColor = 
                              !route ? 'gray' :
                              route.difficulty <= 2 ? 'green' :
                              route.difficulty <= 4 ? 'amber' : 'red';
                            
                            return (
                              <div key={g.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-100 hover:border-blue-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{g.title}</h5>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">{g.description}</p>
                                  </div>
                                  {route && (
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${
                                      diffColor === 'green' ? 'bg-green-100 text-green-700' :
                                      diffColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {route.difficulty <= 2 ? '🟢 Easy' : route.difficulty <= 4 ? '🟡 Medium' : '🔴 Hard'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-4 flex-wrap gap-2">
                                  <div className="flex items-center gap-1">📅 {g.date}</div>
                                  <div className="flex items-center gap-1">👥 {g.currentMembers}/{g.maxMembers}</div>
                                  {g.planned_duration && <div className="flex items-center gap-1">⏱️ {g.planned_duration}</div>}
                                </div>
                                <button 
                                  onClick={() => setSelectedGroup(g)} 
                                  className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-xs font-bold hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm"
                                >
                                  View & Join
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}

                {selectedGroup && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50 animate-fade-in">
                    <div className="bg-white rounded-t-3xl p-6 w-full shadow-2xl max-h-[85vh] overflow-y-auto">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold text-gray-900">Join Team</h3>
                        <button 
                          onClick={() => setSelectedGroup(null)} 
                          className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-lg text-gray-900 mb-2">{selectedGroup.title}</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{selectedGroup.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Date</div>
                            <div className="font-bold text-gray-900 text-sm">📅 {selectedGroup.date}</div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Members</div>
                            <div className="font-bold text-gray-900 text-sm">👥 {selectedGroup.currentMembers}/{selectedGroup.maxMembers}</div>
                          </div>
                        </div>

                        {selectedGroup.planned_duration && (
                          <div className="bg-purple-50 p-4 rounded-xl flex items-center gap-3">
                            <Clock size={20} className="text-purple-600 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-purple-600 font-bold uppercase">Duration</div>
                              <div className="font-bold text-gray-900">{selectedGroup.planned_duration}</div>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={() => {
                            handleJoinGroup(selectedGroup);
                            setSelectedGroup(null);
                          }} 
                          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all duration-200"
                        >
                          Join this Team
                        </button>
                        
                        <button 
                          onClick={() => setSelectedGroup(null)} 
                          className="w-full py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {startSelection === 'group' && (
            <div className={`transition-opacity duration-300 opacity-100`}>
              {/* Group creation form */}
              {showCreateGroupForm ? (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 text-left">
                  <h3 className="font-bold text-lg mb-4">Create Group</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Event Title</label>
                      <input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Description</label>
                      <textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="w-full border-b border-gray-200 py-2 h-20 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase">Group Size</label>
                        <input type="number" min={1} max={20} value={groupSize as any} onChange={e => setGroupSize(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 4" className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase">Start Time</label>
                        <input type="text" value={groupTime} onChange={e => setGroupTime(e.target.value)} placeholder="yyyymmdd, 0830-1630" className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <button onClick={() => { handleCreateGroupAndStart(); setShowCreateGroupForm(false); }} className="flex-1 bg-hike-green text-white py-3 rounded-xl font-bold">Form Group</button>
                      <button onClick={() => { setStartSelection(''); setGroupTitle(''); setGroupDesc(''); setShowCreateGroupForm(true); }} className="flex-1 bg-gray-100 py-3 rounded-xl">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Form Another Group</h3>
                  <button onClick={() => setShowCreateGroupForm(true)} className="text-sm font-semibold text-hike-green hover:underline">+</button>
                </div>
              )}

              {/* After creation: invitation + dashboard */}
              {createdGroup && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 text-left">
                    <h3 className="font-bold text-lg mb-4 flex justify-between items-center">
                      Your Group: {createdGroup.title}
                      <button onClick={() => { setCreatedGroup(null); setShowCreateGroupForm(true); }} className="text-sm font-semibold text-hike-green hover:underline">Clear</button>
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                        <Share2 size={20} className="text-hike-green flex-shrink-0" />
                        <div className="flex-1 text-sm text-gray-700 font-medium">
                          Share Group Link:
                          <p className="font-mono text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md break-all mt-1">{`${window.location.origin}/?team=${createdGroup.id}`}</p>
                        </div>
                        <button className="px-3 py-1.5 bg-green-200 text-green-800 rounded-lg text-xs font-semibold hover:bg-green-300 transition" onClick={async () => {
                          const link = `${window.location.origin}/?team=${createdGroup.id}`;
                          try {
                            await navigator.clipboard.writeText(link);
                            setInviteCopied(true);
                            setTimeout(() => setInviteCopied(false), 2000);
                          } catch (e) {
                            alert(link);
                          }
                        }}>Copy</button>
                      </div>

                      <div className="flex items-center gap-3 bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                        <QrCode size={20} className="text-hike-green flex-shrink-0" />
                        <div className="flex-1 text-sm text-gray-700 font-medium">Group QR Code</div>
                        <button className="px-3 py-1.5 bg-green-200 text-green-800 rounded-lg text-xs font-semibold hover:bg-green-300 transition" onClick={() => setShowQRCode(true)}>Show QR</button>
                      </div>

                      {showQRCode && (
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-md text-center">
                          <p className="text-sm text-green-800 font-medium mb-3">Scan this QR code to join the group!</p>
                          <div className="mx-auto w-48 h-48 bg-white flex items-center justify-center rounded-lg shadow-inner border border-gray-200">
                            <p className="text-base text-gray-400 text-center">QR Code Placeholder<br/>{createdGroup.id}</p>
                          </div>
                          <div className="mt-4"><button onClick={() => setShowQRCode(false)} className="px-4 py-2 bg-gray-200 rounded-xl text-gray-800 font-semibold hover:bg-gray-300">Close QR</button></div>
                        </div>
                      )}

                      <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                        <h4 className="font-bold text-lg mb-3">Members ({createdGroup.currentMembers}/{createdGroup.maxMembers})</h4>
                        <div className="space-y-2">
                          {(createdGroup.members || []).map(m => (
                            <div key={m} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center gap-2">
                                <Users size={18} className="text-gray-500"/>
                                <span className="text-base text-gray-700">{m}</span>
                              </div>
                              <span className="text-xs bg-hike-light text-hike-green px-2 py-0.5 rounded-full font-semibold">Ready</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <button onClick={() => onGroupConfirmed?.(createdGroup.id)} className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            <Compass size={20} /> Start Hike with Group
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Default Route Detail View ---
  if (activeRoute) {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        {/* Header */}
        <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex items-center gap-3">
        <button className="p-1" onClick={() => setActiveRouteId(null)}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Route Detail</h2>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {/* Map Preview with Route Highlight */}
          <div className="h-64 bg-gray-100 relative w-full overflow-hidden">
             <div ref={detailMapRef} className="w-full h-full z-0" />
             {/* Route label */}
             <div className="absolute bottom-3 left-3 z-10 bg-hike-green text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                <Flag size={13} fill="currentColor" /> {activeRoute.name}
             </div>
             {/* Info badge */}
             <div className="absolute top-3 right-3 z-10 bg-white/90 text-gray-800 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm shadow-sm border border-gray-100">
                {activeRoute.distance} • {activeRoute.duration}
             </div>
          </div>

          <div className="p-4 space-y-6">
            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-hike-light p-3 rounded-lg">
                <div className="text-xs text-gray-500">Distance</div>
                <div className="font-bold text-hike-dark">{activeRoute.distance}</div>
              </div>
              <div className="bg-hike-light p-3 rounded-lg">
                <div className="text-xs text-gray-500">Duration</div>
                <div className="font-bold text-hike-dark">{activeRoute.duration}</div>
              </div>
              <div className="bg-hike-light p-3 rounded-lg">
                <div className="text-xs text-gray-500">Gain</div>
                <div className="font-bold text-hike-dark">{activeRoute.elevationGain}m</div>
              </div>
            </div>

            {/* Actions - Solo Hike & Group Hike */}
            <div className="space-y-3">
              <button 
                onClick={() => {
                    onSelectRoute(activeRoute);
                }}
                className="w-full bg-hike-green text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Compass size={20} /> Start Solo Hike
              </button>
              <button 
                onClick={() => {
                    setGroupTitle(`Hike at ${activeRoute.name}`);
                    setViewMode('start_hiking');
                    setStartSelection('group');
                    setActiveRouteId(null);
                }}
                className="w-full bg-orange-500 text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Users size={20} /> Start Group Hike
              </button>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">Route Description</h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                {activeRoute.description}
              </p>
            </div>

             {/* Comments */}
             <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex justify-between items-center">
                  Hikers' Reviews <span className="text-sm font-normal text-gray-500">{MOCK_REVIEWS.length * 32} reviews</span>
                </h3>
                <div className="space-y-6">
                   {MOCK_REVIEWS.map(review => (
                     <div key={review.id} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                          <User size={20} className="text-gray-400" />
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="font-bold text-sm text-gray-800">{review.user}</span>
                                <div className="flex mt-0.5">
                                  {renderRating(review.rating)}
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium">{review.date}</span>
                           </div>
                           <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                        </div>
                     </div>
                   ))}
                </div>
                <button className="w-full mt-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
                  Show More Reviews
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // List View (Default)
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1 font-bold text-lg">
            <MapPin size={20} className="text-hike-green" />
            <span>{selectedCity}</span>
          </div>
          <div className="text-sm text-gray-500">Sunny, 24°C</div>
        </div>
        
        {/* Functional Buttons (Active Now) */}
        <div className="grid grid-cols-2 gap-4 mb-2">
           <button 
             onClick={() => { setViewMode('start_hiking'); setAiMatched(false); }}
                className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center gap-3 transition-transform active:scale-95 shadow-sm"
            >
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <MapPin size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-gray-800">Start Hiking</div>
                <div className="text-xs text-gray-500">Find Routes</div>
              </div>
           </button>
           <button 
                onClick={() => setViewMode('events')}
                className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3 transition-transform active:scale-95 shadow-sm"
           >
              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                <Calendar size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-gray-800">Events</div>
                <div className="text-xs text-gray-500">Official Hikes</div>
              </div>
           </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Route searching..."
            value={routeSearchQuery}
            onChange={e => handleRouteSearch(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-hike-green"
          />
        </div>
        <h3 className="font-bold text-gray-700 mb-2">Recommended Routes</h3>
        
        {filteredRoutes.map(route => (
          <div 
            key={route.id}
            onClick={() => setActiveRouteId(route.id)}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-all duration-300 cursor-pointer hover:shadow-md group"
          >
            <div className="h-44 w-full bg-gray-100 relative overflow-hidden">
               <img 
                 src={route.imageUrl || `https://picsum.photos/seed/${route.id}/600/400`} 
                 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                 alt={route.name} 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
               <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/30">
                    {route.region}
                  </span>
               </div>
               {route.isUserPublished && (
                 <div className="absolute top-3 right-3 bg-hike-accent text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <User size={10} /> Community
                 </div>
               )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-2">
                 <h4 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-hike-green transition-colors">{route.name}</h4>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                 {renderRating(route.difficulty)}
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Difficulty {route.difficulty}/5</span>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-gray-50 pt-4 text-gray-600">
                <div className="flex flex-col items-center">
                   <Mountain size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.elevationGain}m</span>
                </div>
                <div className="flex flex-col items-center border-x border-gray-50">
                   <Compass size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.distance}</span>
                </div>
                <div className="flex flex-col items-center">
                   <Clock size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.duration}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanningView;