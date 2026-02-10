import React, { useState } from 'react';
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
  Share2
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

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
    title: 'Wilson Trail Sec 4',
    description: 'Intermediate group aiming for steady pace and photo breaks.',
    date: 'Leaving in 2 hours',
    maxMembers: 5,
    currentMembers: 3,
    isOrganizer: false,
    members: ['Jason', 'Mei', 'Tom']
  },
  {
    id: 'g2',
    title: 'Photography Slow Walk',
    description: 'Very slow, photo-friendly walk suitable for beginners.',
    date: 'Tomorrow morning',
    maxMembers: 10,
    currentMembers: 8,
    isOrganizer: false,
    members: ['Lily', 'Ken', 'Sara', 'Leo']
  }
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
  const [viewMode, setViewMode] = useState<'routes' | 'partner' | 'events'>('routes');

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

  const activeRoute = routes.find(r => r.id === activeRouteId);

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

  // --- Sub-View: Find Partner ---
  if (viewMode === 'partner') {
      return (
          <div className="flex flex-col h-full bg-gray-50 animate-fade-in">
              <div className="bg-white p-4 shadow-sm flex items-center gap-3">
                  <button onClick={() => setViewMode('routes')} className="p-1"><ArrowLeft size={24} /></button>
                  <h2 className="text-xl font-bold">Find Partner</h2>
              </div>
              <div className="p-4 overflow-y-auto pb-20">
                  {/* Create Group */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <Plus size={20} className="text-orange-500" /> Organize Hike
                      </h3>
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs text-gray-500 font-bold uppercase">Event Title</label>
                              <input 
                                  value={groupTitle}
                                  onChange={e => setGroupTitle(e.target.value)}
                                  placeholder="e.g. Sunset at High West" 
                                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500"
                              />
                          </div>
                          <div>
                              <label className="text-xs text-gray-500 font-bold uppercase">Description</label>
                              <textarea 
                                  value={groupDesc}
                                  onChange={e => setGroupDesc(e.target.value)}
                                  placeholder="Route details, pace, meeting point..." 
                                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500 h-20 resize-none"
                              />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 font-bold uppercase">Group Size</label>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={groupSize}
                                onChange={e => {
                                  const v = e.target.value;
                                  setGroupSize(v === '' ? '' : Number(v));
                                }}
                                placeholder="e.g. 4"
                                className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-bold uppercase">Start Time</label>
                              <input
                                type="text"
                                value={groupTime}
                                onChange={e => setGroupTime(e.target.value)}
                                placeholder="Tomorrow 08:00"
                                className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-bold uppercase">Meeting Point</label>
                            <input
                              type="text"
                              value={groupMeetingPoint}
                              onChange={e => setGroupMeetingPoint(e.target.value)}
                              placeholder="e.g. Exit B, Central MTR"
                              className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          {/* Pre-hike planning extra fields */}
                          <div className="mt-2 p-3 bg-orange-50/60 rounded-xl border border-dashed border-orange-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-orange-700 uppercase">
                                Pre-hike Status
                              </span>
                              <span className="text-[10px] text-orange-500">
                                Optional but recommended
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-500 font-bold uppercase">Planned Duration</label>
                                <input
                                  type="text"
                                  value={plannedDuration}
                                  onChange={e => setPlannedDuration(e.target.value)}
                                  placeholder="e.g. 4h 30m"
                                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500 bg-transparent text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 font-bold uppercase">Experience Level</label>
                                <select
                                  value={experienceLevel}
                                  onChange={e => setExperienceLevel(e.target.value as any)}
                                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500 bg-transparent text-sm"
                                >
                                  <option value="">Select</option>
                                  <option value="first_time">First-time</option>
                                  <option value="occasional">Occasional</option>
                                  <option value="advanced">Advanced</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-bold uppercase">Initial Mood / Condition</label>
                              <textarea
                                value={initialMood}
                                onChange={e => setInitialMood(e.target.value)}
                                placeholder="How do you feel today? Any concerns, injuries, or notes for guardians/AI?"
                                className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-orange-500 h-16 resize-none text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-3">
                              <button onClick={handleCreateGroup} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200">
                                  Create & Publish
                              </button>
                              <button className="px-4 py-3 bg-gray-100 rounded-xl text-gray-600 font-bold flex items-center gap-2">
                                  <Share2 size={18} /> Invite
                              </button>
                          </div>
                          <p className="text-xs text-gray-400 text-center mt-2">Activity will be synced to your profile.</p>
                      </div>
                  </div>

                  {/* Nearby Groups */}
                  <h3 className="font-bold text-gray-700 mb-3">Nearby Groups</h3>
                  <div className="space-y-3">
                      {nearbyGroups.length === 0 && (
                        <div className="bg-white p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                          No nearby groups yet. Create one above!
                        </div>
                      )}

                      {nearbyGroups.map(group => {
                        const isOwner = group.isOrganizer;
                        const isConfirmed = group.status === 'confirmed';
                        const initials = group.title
                          .split(' ')
                          .map(word => word[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform relative"
                          >
                            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">
                              {initials}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-gray-800 truncate">{group.title}</div>
                                {isOwner && (
                                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                                    OWNER
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {group.date} • {group.currentMembers}/{group.maxMembers} Members
                              </div>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                if (!isOwner && !isConfirmed) {
                                  handleJoinGroup(group);
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                isOwner || isConfirmed
                                  ? 'bg-gray-100 text-gray-400 cursor-default'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {isConfirmed ? 'Locked' : isOwner ? 'Owner' : 'Join'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
              </div>

              {/* Group detail modal */}
              {selectedGroup && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{selectedGroup.title}</h3>
                      <button
                        onClick={() => setSelectedGroup(null)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      {selectedGroup.description}
                    </p>

                    <div className="mb-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Time
                      </div>
                      <div className="text-sm text-gray-800">
                        {selectedGroup.startTime || selectedGroup.date}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                        Meeting Point
                      </div>
                      <div className="text-sm text-gray-800">
                        {selectedGroup.meetingPoint || 'To be decided'}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Members
                      </div>
                      <div className="text-sm text-gray-800 mb-2">
                        {selectedGroup.currentMembers}/{selectedGroup.maxMembers} hikers
                      </div>
                      {selectedGroup.members && (
                        <ul className="space-y-1 text-sm text-gray-700 max-h-28 overflow-y-auto">
                          {selectedGroup.members.map(name => (
                            <li key={name} className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                                {name[0]}
                              </div>
                              <span>{name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button
                        disabled={selectedGroup.status === 'confirmed' || isConfirming}
                        onClick={async () => {
                          if (selectedGroup.status === 'confirmed') return;
                          try {
                            setIsConfirming(true);
                            // 将队伍状态设为 confirmed（本地 UI 锁定）
                            setNearbyGroups(prev =>
                              prev.map(g =>
                                g.id === selectedGroup.id ? { ...g, status: 'confirmed' } : g
                              )
                            );

                            // 写入 Supabase 的 hike_sessions，用于 CompanionView 安全守护
                            const { data, error } = await supabase
                              .from('hike_sessions')
                              .insert({
                                user_id: currentUserId,
                                status: 'planning',
                                planned_duration: plannedDuration || selectedGroup.startTime || selectedGroup.date,
                                companion_count: selectedGroup.companionCount || selectedGroup.currentMembers,
                                experience_level: experienceLevel || null,
                                initial_mood: initialMood || selectedGroup.description,
                                share_token: crypto.randomUUID(),
                                route_id: null,
                                team_id: null
                              })
                              .select('id')
                              .single();

                            if (!error && data?.id && onGroupConfirmed) {
                              onGroupConfirmed(data.id);
                            }
                          } finally {
                            setIsConfirming(false);
                            setSelectedGroup(null);
                          }
                        }}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform ${
                          selectedGroup.status === 'confirmed'
                            ? 'bg-gray-200 text-gray-500 cursor-default'
                            : 'bg-hike-green text-white'
                        }`}
                      >
                        {selectedGroup.status === 'confirmed'
                          ? 'Locked In'
                          : isConfirming
                          ? 'Confirming...'
                          : 'Start Hike'}
                      </button>
                      <button
                        onClick={() => setSelectedGroup(null)}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>
      )
  }

  // --- Default Route Detail View ---
  if (activeRoute) {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        {/* Header */}
        <div className="flex items-center p-4 bg-hike-green text-white shadow-md">
          <button onClick={() => setActiveRouteId(null)} className="mr-4">
             <ChevronRight className="rotate-180" />
          </button>
          <h2 className="text-lg font-bold truncate">{activeRoute.name}</h2>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {/* Map Preview Placeholder */}
          <div className="h-64 bg-gray-100 relative w-full overflow-hidden">
             <img 
               src="https://picsum.photos/800/400" 
               alt="Route Map" 
               className="w-full h-full object-cover opacity-80"
             />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm font-semibold">Interactive Map Preview</span>
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

            {/* Actions */}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                    alert("Track downloaded to My Library!");
                    onSelectRoute(activeRoute); // Actually sets it as active for companion
                }}
                className="flex-1 bg-hike-green text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Download size={20} /> Download Track
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
             <div className="border-t pt-4">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex justify-between items-center">
                  Hikers' Reviews <span className="text-sm font-normal text-gray-500">128 reviews</span>
                </h3>
                <div className="space-y-4">
                   <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                        <img src="https://picsum.photos/50/50" alt="avatar" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between">
                            <span className="font-semibold text-sm">David Chen</span>
                            <span className="text-xs text-gray-400">2 days ago</span>
                         </div>
                         <p className="text-sm text-gray-600 mt-1">Great views! A bit windy at the top. The bus stop at To Tei Wan is easy to find.</p>
                      </div>
                   </div>
                </div>
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
                onClick={() => setViewMode('partner')}
                className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center gap-3 transition-transform active:scale-95 shadow-sm"
            >
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <Users size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-gray-800">Find Partner</div>
                <div className="text-xs text-gray-500">Organize Team</div>
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
        <h3 className="font-bold text-gray-700 mb-2">Recommended Routes</h3>
        
        {routes.map(route => (
          <div 
            key={route.id}
            onClick={() => setActiveRouteId(route.id)}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer"
          >
            <div className="h-32 w-full bg-gray-200 relative">
               <img src={`https://picsum.photos/600/300?random=${route.id}`} className="w-full h-full object-cover" alt="scenery" />
               <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {route.region}
               </div>
               {route.isUserPublished && (
                 <div className="absolute top-2 right-2 bg-hike-accent text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <User size={10} /> Community
                 </div>
               )}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                 <h4 className="font-bold text-lg text-gray-900 leading-tight">{route.name}</h4>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                 {renderRating(route.difficulty)}
                 <span className="text-xs text-gray-400">Difficulty {route.difficulty}/5</span>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-600">
                <div className="flex items-center gap-1">
                   <Mountain size={16} />
                   <span>{route.elevationGain}m</span>
                </div>
                <div className="flex items-center gap-1">
                   <span>{route.distance}</span>
                </div>
                <div className="bg-gray-100 px-2 py-1 rounded text-xs">
                   {route.duration}
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t flex justify-between text-gray-400 text-xs">
                 <span className="flex items-center gap-1"><Download size={12}/> 2.4k</span>
                 <span className="flex items-center gap-1"><MessageSquare size={12}/> 128</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanningView;