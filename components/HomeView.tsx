import React, { useState } from 'react';
import { UserStats, Track, GroupHike } from '../types';
import { Settings, QrCode, Heart, Map, Clock, Zap, Activity, Share2, MoreHorizontal, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface HomeViewProps {
    myTracks: Track[];
    myGroupHikes: GroupHike[];
    onPublishTrack: (track: Track) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ myTracks, myGroupHikes, onPublishTrack }) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState('Alex Hiker');
  const [profileRole, setProfileRole] = useState<'hiker' | 'guardian' | 'ngo_admin'>('hiker');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('https://picsum.photos/100/100');

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const stats: UserStats = {
    totalDistanceKm: 124.5 + (myTracks.reduce((acc, t) => acc + parseFloat(t.distance), 0)),
    hikesCompleted: 14 + myTracks.length,
    elevationGainedM: 3400 + (myTracks.length * 150),
    status: 'Ready to Hike'
  };

  const data = [
    { name: 'Completed', value: 70 },
    { name: 'Remaining', value: 30 },
  ];
  const COLORS = ['#2E7D32', '#E8F5E9'];

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-24 overflow-y-auto">
      {/* Header Profile */}
      <div className="bg-white px-6 pt-6 pb-8 rounded-b-3xl shadow-sm relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
            <Map size={200} />
         </div>

         <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-full border-2 border-hike-green p-1">
                  <img src={profileAvatarUrl} className="w-full h-full rounded-full object-cover" alt="Profile" />
               </div>
               <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profileUsername}</h1>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="bg-green-100 text-hike-dark px-2 py-0.5 rounded text-xs font-bold">LV. 12</span>
                     <span className="text-sm text-gray-500">
                       {profileRole === 'hiker' && 'Hiker'}
                       {profileRole === 'guardian' && 'Guardian'}
                       {profileRole === 'ngo_admin' && 'NGO Admin'}
                     </span>
                  </div>
               </div>
            </div>
            <div className="flex gap-3">
               <button className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"><QrCode size={20}/></button>
               <button
                 onClick={() => setShowEditProfile(true)}
                 className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"
               >
                 <Settings size={20}/>
               </button>
            </div>
         </div>

         {/* Total Distance Big Number */}
         <div className="text-center relative z-10 mt-2">
            <div className="text-sm text-gray-500 uppercase tracking-wide mb-1">Total Distance</div>
            <div className="text-5xl font-black text-hike-dark font-mono tracking-tighter">
               {stats.totalDistanceKm.toFixed(1)}<span className="text-lg text-gray-400 ml-1 font-sans font-normal">km</span>
            </div>
         </div>
      </div>

      {/* Body sections */}
      <div className="flex-1 px-4 pt-4 pb-8 space-y-5 mt-2">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
         <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange-50 rounded-full z-0"></div>
           <div className="relative z-10 flex flex-col items-center">
               <Zap className="text-orange-500 mb-1" size={20}/>
               <span className="text-xl font-bold text-gray-800">{stats.hikesCompleted}</span>
               <span className="text-xs text-gray-500">Hikes Done</span>
            </div>
         </div>
         <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-blue-50 rounded-full z-0"></div>
             <div className="relative z-10 flex flex-col items-center">
               <Activity className="text-blue-500 mb-1" size={20}/>
               <span className="text-xl font-bold text-gray-800">{stats.elevationGainedM}m</span>
               <span className="text-xs text-gray-500">Elevation</span>
            </div>
         </div>
        </div>

        {/* Track Library */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-4 pb-5">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-800">Track Library</h3>
            <span className="text-xs text-hike-green font-bold">View All</span>
         </div>

         <div className="space-y-3">
             {myTracks.length === 0 && (
                 <div className="text-center text-gray-400 py-4 text-sm bg-white rounded-xl border border-dashed">No recorded tracks yet.</div>
             )}

             {myTracks.map(track => (
                <div key={track.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 animate-fade-in">
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-hike-green">
                       <Map size={24} />
                    </div>
                    <div className="flex-1">
                       <div className="font-bold text-gray-800 text-sm truncate">{track.name}</div>
                       <div className="text-xs text-gray-500 flex gap-2 mt-1">
                          <span className="flex items-center gap-1"><Clock size={10}/> {track.duration}</span>
                          <span className="flex items-center gap-1"><Activity size={10}/> {track.distance}</span>
                       </div>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => onPublishTrack(track)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" 
                            title="Publish to Community"
                        >
                           <Share2 size={18} />
                        </button>
                        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                           <MoreHorizontal size={18} />
                        </button>
                    </div>
                </div>
             ))}

             {/* Static Legacy Item */}
             <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 opacity-70">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                   <Map size={24} />
                </div>
                <div className="flex-1">
                   <div className="font-bold text-gray-800 text-sm">Peak Circle Walk</div>
                   <div className="text-xs text-gray-500 flex gap-2 mt-1">
                      <span className="flex items-center gap-1"><Clock size={10}/> 1h 30m</span>
                      <span className="flex items-center gap-1">Legacy</span>
                   </div>
                </div>
             </div>
         </div>
        </div>

        {/* My Organized/Joined Hikes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-4 pb-5">
         <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg text-gray-800">My Activities</h3>
         </div>
         
         <div className="space-y-3">
             {myGroupHikes.length === 0 ? (
                 <div className="text-center text-gray-400 py-4 text-sm bg-white rounded-xl border border-dashed">
                     No upcoming group hikes. Organize one in "Find Partner"!
                 </div>
             ) : (
                 myGroupHikes.map(hike => (
                     <div key={hike.id} className="bg-orange-50 p-3 rounded-xl shadow-sm border border-orange-100 flex items-center gap-3 animate-fade-in">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-500">
                            <Users size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-gray-800 text-sm truncate">{hike.title}</div>
                            <div className="text-xs text-gray-600 flex gap-2 mt-1">
                                <span className="flex items-center gap-1"><Clock size={10}/> {hike.date}</span>
                                <span className="flex items-center gap-1">Member: {hike.currentMembers}/{hike.maxMembers}</span>
                            </div>
                        </div>
                        <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-1 rounded font-bold">
                            OWNER
                        </span>
                     </div>
                 ))
             )}
         </div>
        </div>

        {/* My Teams & Join by Code */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 pt-4 pb-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-lg text-gray-800">My Teams</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateTeam(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-hike-green text-white font-bold"
            >
              Create
            </button>
            <button
              onClick={() => setShowJoinTeam(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 font-bold"
            >
              Join
            </button>
          </div>
        </div>
        <div className="mt-2 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-400 text-center">
          Team features coming soon. Use Create / Join to connect your hikes with friends.
        </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Username</label>
                <input
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-hike-green"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Role</label>
                <select
                  value={profileRole}
                  onChange={e => setProfileRole(e.target.value as any)}
                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-hike-green bg-transparent"
                >
                  <option value="hiker">Hiker</option>
                  <option value="guardian">Guardian</option>
                  <option value="ngo_admin">NGO Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Avatar URL</label>
                <input
                  value={profileAvatarUrl}
                  onChange={e => setProfileAvatarUrl(e.target.value)}
                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-hike-green"
                />
              </div>
            </div>
            <button
              onClick={() => setShowEditProfile(false)}
              className="w-full mt-5 bg-hike-green text-white py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Team</h3>
              <button
                onClick={() => setShowCreateTeam(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Team Name</label>
                <input
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. Dragon Back Crew"
                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-hike-green"
                />
              </div>
              <p className="text-xs text-gray-400">
                After creating, a short join code will be generated so your friends can join.
              </p>
            </div>
            <button
              onClick={() => {
                // TODO: call Supabase to insert into teams & team_members
                setShowCreateTeam(false);
                setTeamName('');
              }}
              className="w-full mt-5 bg-hike-green text-white py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
            >
              Create Team
            </button>
          </div>
        </div>
      )}

      {/* Join Team Modal */}
      {showJoinTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Join Team</h3>
              <button
                onClick={() => setShowJoinTeam(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Join Code</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full border-b border-gray-200 py-2 focus:outline-none focus:border-hike-green tracking-widest"
                />
              </div>
            </div>
            <button
              onClick={() => {
                // TODO: call Supabase to look up team by join_code and insert into team_members
                setShowJoinTeam(false);
                setJoinCode('');
              }}
              className="w-full mt-5 bg-hike-green text-white py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
            >
              Join Team
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;