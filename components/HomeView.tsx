import React, { useState, useEffect } from 'react';
import { User, UserStats, Track, GroupHike } from '../types';
import { Settings, QrCode, Map, Clock, Zap, Activity, Share2, Users, Trash2, LogOut, Flame, Mountain, AlertCircle, Loader, Compass, History, Info } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { createTeam } from '../services/teamService';

interface HomeViewProps {
    user: User; 
    onLogout: () => void; 
    myTracks: Track[];
    myGroupHikes: GroupHike[];
    onPublishTrack: (track: Track) => void;
    onDeleteGroupHike?: (groupId: string) => void;
    onGotoPlanning?: (teamId?: string) => void; 
    onReviewTrack?: (track: Track) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ user, onLogout, myTracks, myGroupHikes, onPublishTrack, onDeleteGroupHike, onGotoPlanning, onReviewTrack }) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const trackMapRef = React.useRef<HTMLDivElement>(null);
  const trackMapInstanceRef = React.useRef<any>(null);
  const [profileUsername, setProfileUsername] = useState(user.name || 'Explorer');
  const [profileRole, setProfileRole] = useState<'hiker' | 'guardian' | 'ngo_admin'>('hiker');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [userLevel, setUserLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setCreateError('Please enter a team name');
      return;
    }
    try {
      setCreatingTeam(true);
      setCreateError(null);
      const newTeam = await createTeam(teamName.trim(), '', true, 1);
      setShowCreateTeam(false);
      setTeamName('');
      if (onGotoPlanning) {
        onGotoPlanning(newTeam.id);
      }
    } catch (error) {
      console.error('Error creating team:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const updates = {
        id: user.id,
        full_name: profileUsername,
        role: profileRole,
        updated_at: new Date(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      setShowEditProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfileUsername(profileData.full_name || profileData.username || user.name || 'Explorer');
          setProfileAvatarUrl(profileData.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.id);
          setProfileRole(profileData.role || 'hiker');
          setUserLevel((profileData as any).level || 1);
        } else {
          setProfileUsername(user.name || 'Explorer');
          setProfileAvatarUrl('https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.id);
        }
        setLoading(false);
      } catch (error) {
        setProfileUsername(user.name || 'Explorer');
        setProfileAvatarUrl('https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.id);
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user.id]);

  useEffect(() => {
    setShowEditProfile(false);
    setShowCreateTeam(false);
    setShowJoinTeam(false);
    setTeamName('');
    setJoinCode('');
  }, [user.id]);

  const stats: UserStats = {
    totalDistanceKm: myTracks.reduce((acc, t) => acc + (parseFloat(t.distance) || 0), 0),
    hikesCompleted: myTracks.length,
    elevationGainedM: myTracks.reduce((acc, t) => acc + 150, 0),
    status: 'Ready to Hike'
  };

  // Effect to handle track map
  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    if (!selectedTrack || !trackMapRef.current || !L) return;

    if (trackMapInstanceRef.current) {
      trackMapInstanceRef.current.remove();
      trackMapInstanceRef.current = null;
    }

    const map = L.map(trackMapRef.current, {
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    if (selectedTrack.coordinates && selectedTrack.coordinates.length > 0) {
      const polyline = L.polyline(selectedTrack.coordinates, {
        color: '#2E7D32',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } else {
      map.setView([22.3193, 114.1694], 11);
    }

    trackMapInstanceRef.current = map;

    return () => {
      if (trackMapInstanceRef.current) {
        trackMapInstanceRef.current.remove();
        trackMapInstanceRef.current = null;
      }
    };
  }, [selectedTrack]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white pb-24 overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-hike-green border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 text-sm">Loading profile...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <div className="relative pt-6 pb-12">
            <div className="absolute inset-0 bg-gradient-to-b from-hike-green/10 to-transparent"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-hike-green/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-5 -left-10 w-32 h-32 bg-blue-400/5 rounded-full blur-3xl"></div>

            <div className="relative z-10 px-4 sm:px-6">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-white shadow-lg overflow-hidden bg-gradient-to-br from-hike-green/20 to-blue-400/20">
                      <img 
                        src={profileAvatarUrl} 
                        className="w-full h-full object-cover" 
                        alt="Profile" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.id;
                        }}
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-400 border-3 border-white rounded-full shadow-md"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-3xl font-black text-gray-900 truncate mb-2">{profileUsername}</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-hike-green to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                        <Flame size={14} />
                        LV. {userLevel}
                      </div>
                      <span className="text-xs sm:text-sm text-gray-600 font-medium">
                        {profileRole === 'hiker' && '🥾 Hiker'}
                        {profileRole === 'guardian' && '👨‍⚖️ Guardian'}
                        {profileRole === 'ngo_admin' && '🏢 NGO Admin'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button className="p-2.5 bg-white/80 backdrop-blur-md rounded-full text-gray-600 hover:bg-gray-100 transition shadow-sm border border-gray-100/50">
                    <QrCode size={18}/>
                  </button>
                  <button
                    onClick={() => setShowEditProfile(true)}
                    className="p-2.5 bg-white/80 backdrop-blur-md rounded-full text-gray-600 hover:bg-gray-100 transition shadow-sm border border-gray-100/50"
                  >
                    <Settings size={18}/>
                  </button>
                  <button
                    onClick={onLogout}
                    className="p-2.5 bg-red-50/80 backdrop-blur-md rounded-full text-red-600 hover:bg-red-100 transition shadow-sm border border-red-100/50"
                  >
                    <LogOut size={18}/>
                  </button>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-lg rounded-3xl p-6 sm:p-8 shadow-lg border border-white/20 mb-2 text-center">
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-widest font-semibold mb-2">This Month Progress</p>
                  <div className="flex items-baseline justify-center gap-2 mb-4">
                    <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-hike-green to-emerald-600 bg-clip-text text-transparent">
                      {stats.totalDistanceKm.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-500 font-medium">km</span>
                  </div>
                  <p className="text-sm text-gray-600">You're crushing it! Keep exploring 🏔️</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 sm:px-6 space-y-5 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-md border border-white/20 hover:shadow-lg transition flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mb-2">
                    <Zap className="text-orange-600" size={20}/>
                  </div>
                  <span className="text-2xl font-black text-gray-900">{stats.hikesCompleted}</span>
                  <span className="text-xs text-gray-500 text-center mt-1 font-medium">Hikes Done</span>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-md border border-white/20 hover:shadow-lg transition flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-2">
                    <Mountain className="text-blue-600" size={20}/>
                  </div>
                  <span className="text-xl font-black text-gray-900">{(stats.elevationGainedM / 1000).toFixed(1)}k</span>
                  <span className="text-xs text-gray-500 text-center mt-1 font-medium">Elevation</span>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-md border border-white/20 hover:shadow-lg transition flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-200 rounded-full flex items-center justify-center mb-2">
                    <Activity className="text-green-600" size={20}/>
                  </div>
                  <span className="text-xs text-center font-bold text-gray-900 leading-tight">Ready to Hike</span>
                  <span className="text-xs text-gray-500 text-center mt-1 font-medium">Status</span>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-md border border-white/20 p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-black text-lg text-gray-900">My Teams</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Ongoing & completed group hikes</p>
                </div>
                <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-full">{myGroupHikes.length} teams</span>
              </div>

              <div className="space-y-3">
                {myGroupHikes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No teams yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create or join a team to start planning</p>
                  </div>
                ) : (
                  myGroupHikes.map(team => (
                    <div 
                      key={team.id} 
                      onClick={() => {
                        if (onGotoPlanning) {
                          onGotoPlanning(team.id);
                        }
                      }}
                      className="bg-white/50 hover:bg-white/80 cursor-pointer transition p-4 rounded-2xl border border-gray-100/50 backdrop-blur-sm flex items-start gap-3 group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:shadow-md transition">
                        <Users size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 select-text">
                          <h4 className="font-bold text-gray-900 truncate select-text">{team.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            team.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            team.status === 'exited' ? 'bg-red-100 text-red-700' :
                            team.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {team.status === 'completed' ? '完成' : 
                             team.status === 'exited' ? '退出' :
                             team.status || 'Planning'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3 select-text">
                          <span className="flex items-center gap-1 select-text"><Users size={12} /> {team.currentMembers}/{team.maxMembers} members</span>
                          {team.date && <span className="flex items-center gap-1 select-text"><Clock size={12} /> {new Date(team.date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {team.status === 'confirmed' && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (onGotoPlanning) onGotoPlanning(team.id); 
                            }}
                            className="p-2 text-hike-green hover:bg-green-50 rounded-lg transition" 
                          >
                            <Compass size={18} />
                          </button>
                        )}
                        {onDeleteGroupHike && (
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              const confirmMsg = team.isOrganizer 
                                ? 'Are you sure you want to delete this team?'
                                : 'Are you sure you want to leave this team?';
                              
                              if (window.confirm(confirmMsg)) {
                                try {
                                  if (team.isOrganizer) {
                                    const { error } = await supabase.from('teams').delete().eq('id', team.id);
                                    if (error) throw error;
                                  } else {
                                    const { error } = await supabase
                                      .from('team_members')
                                      .delete()
                                      .eq('team_id', team.id)
                                      .eq('user_id', user.id);
                                    if (error) throw error;
                                  }
                                  onDeleteGroupHike(team.id); 
                                } catch (err) {
                                  console.error('Failed to delete/leave team:', err);
                                  alert('Action failed.');
                                }
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" 
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-md border border-white/20 p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-black text-lg text-gray-900">Track Library</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Your recorded hikes</p>
                </div>
                <span className="text-xs text-hike-green font-bold bg-green-50 px-2 py-1 rounded-full">{myTracks.length} tracks</span>
              </div>
              <div className="space-y-3">
                {myTracks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Map className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No tracks yet</p>
                  </div>
                ) : (
                  myTracks.map(track => (
                    <div 
                      key={track.id} 
                      onClick={() => setSelectedTrack(track)}
                      className="bg-white/50 hover:bg-white/80 transition p-4 rounded-2xl border border-gray-100/50 backdrop-blur-sm flex items-start gap-3 group cursor-pointer active:scale-[0.98]"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center text-hike-green flex-shrink-0 group-hover:shadow-md transition">
                        <Map size={22} />
                      </div>
                      <div className="flex-1 min-w-0 select-text">
                        <div className="font-bold text-gray-800 text-sm truncate select-text">{track.name}</div>
                        <div className="text-xs text-gray-500 flex gap-3 mt-2 flex-wrap select-text">
                          <span className="flex items-center gap-1 select-text"><Clock size={12}/> {new Date(track.date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="flex items-center gap-1 select-text"><Activity size={12}/> {track.distance}</span>
                          <span className="flex items-center gap-1 select-text"><Map size={12}/> {track.duration}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onPublishTrack(track); }}
                          className="p-2 text-hike-green hover:bg-green-50 rounded-lg transition" 
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl border border-white/20 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-900">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-light">✕</button>
            </div>
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-hike-green shadow-lg overflow-hidden">
                  <img src={profileAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-600 font-bold uppercase mb-2">Display Name</label>
                <input
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  className="w-full border-b-2 border-gray-200 py-3 focus:border-hike-green outline-none"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-bold uppercase mb-2">Role</label>
                <select
                  value={profileRole}
                  onChange={e => setProfileRole(e.target.value as any)}
                  className="w-full border-b-2 border-gray-200 py-3 focus:border-hike-green outline-none bg-transparent"
                >
                  <option value="hiker">🥾 Hiker</option>
                  <option value="guardian">👨‍⚖️ Guardian</option>
                  <option value="ngo_admin">🏢 NGO Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={handleUpdateProfile} className="flex-1 bg-gradient-to-r from-hike-green to-emerald-600 text-white py-3.5 rounded-2xl font-bold">Save</button>
              <button onClick={() => setShowEditProfile(false)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Track Detail Modal */}
      {selectedTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-gray-900 leading-tight">{selectedTrack.name}</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{new Date(selectedTrack.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
              </div>
              <button 
                onClick={() => setSelectedTrack(null)} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="h-64 bg-gray-100 relative">
                <div ref={trackMapRef} className="absolute inset-0 z-0" />
                
                {/* 🆕 Info Button (Left Side) for consistency */}
                <button 
                  onClick={() => alert(`Track Info:\nName: ${selectedTrack.name}\nDist: ${selectedTrack.distance}\nTime: ${selectedTrack.duration}`)}
                  className="absolute top-4 left-4 z-10 p-2 bg-white/90 rounded-full shadow-lg text-hike-green border border-white/40 backdrop-blur-sm"
                >
                  <Info size={18} />
                </button>

                <div className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-hike-green shadow-lg border border-white/20">
                  RECORDED TRAJECTORY
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Distance</div>
                    <div className="text-2xl font-black text-gray-900 flex items-baseline gap-1">
                      {selectedTrack.distance.replace(/[^0-9.]/g, '')}
                      <span className="text-sm font-medium text-gray-500">km</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Time</div>
                    <div className="text-2xl font-black text-gray-900">
                      {selectedTrack.duration}
                    </div>
                  </div>
                </div>

                {selectedTrack.waypoints && selectedTrack.waypoints.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-400 font-black uppercase tracking-widest mb-3">Waypoints Captured</h4>
                    <div className="space-y-3">
                      {selectedTrack.waypoints.map((wp: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${wp.type === 'photo' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                            {wp.type === 'photo' ? '📷' : '📍'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-gray-800 truncate">{wp.note || (wp.type === 'photo' ? 'Photo Spot' : 'Waypoint')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  {onReviewTrack && (
                    <button 
                      onClick={() => {
                        onReviewTrack(selectedTrack);
                        setSelectedTrack(null);
                      }}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <History size={20} /> Review Hike on Map
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      onPublishTrack(selectedTrack);
                      alert('Track shared to community!');
                    }}
                    className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={20} /> Share to Community
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
