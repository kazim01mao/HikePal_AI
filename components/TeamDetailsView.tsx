import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { ArrowLeft, Users, RefreshCw, Check, AlertCircle, Compass } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_mood?: string;
  user_difficulty?: string;
  user_condition?: string;
  user_preferences?: {
    mood: string;
    difficulty: string;
    condition: string;
    availableTime: number;
    maxDistance: number;
  };
  preferences_completed: boolean;
  preferences_completed_at?: string;
}

interface TeamDetailsViewProps {
  teamId: string;
  teamName?: string;
  teamDescription?: string;
  maxMembers?: number;
  onBack?: () => void;
  onStartHike?: () => void;
  isTeamLeader?: boolean;
}

const TeamDetailsView: React.FC<TeamDetailsViewProps> = ({
  teamId,
  teamName = 'Team',
  teamDescription,
  maxMembers = 5,
  onBack,
  onStartHike,
  isTeamLeader = false,
}) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState(0);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [confirmedRouteName, setConfirmedRouteName] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamDetails(true);
    // 设置自动刷新（每5秒）
    const interval = setInterval(() => fetchTeamDetails(false), 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  const fetchTeamDetails = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      
      // 获取团队成员
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      setMembers(membersData || []);

      // 获取团队基本信息（用于显示当前人数和路线状态）
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('team_size, status, target_route_id, target_route_name')
        .eq('id', teamId)
        .single();

      if (teamError && teamError.code !== 'PGRST116') throw teamError;
      
      // 同步人数
      const actualMemberCount = membersData?.length || 0;
      
      // 只要获取到成员数据，就以实际成员数为准
      setTeamSize(actualMemberCount);

      if (teamData) {
        if (teamData.status === 'confirmed' || teamData.target_route_id) {
          setRouteConfirmed(true);
          setConfirmedRouteName(teamData.target_route_name || 'Confirmed Route');
          
          // 如果路线已确认且是队员，且我们在等待状态，可以考虑自动触发 onStartHike
          // 但为了稳妥，我们至少保证 routeConfirmed 状态正确
        }
        
        // 如果数据库记录的人数不一致，尝试静默修正
        if (teamData.team_size !== actualMemberCount) {
          await supabase.from('teams').update({ team_size: actualMemberCount }).eq('id', teamId);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching team details:', err);
      setError('Failed to load team details');
    } finally {
      setIsLoading(false);
    }
  };

  const completedCount = members.filter(m => m.preferences_completed).length;
  // Use maxMembers for percentage if provided, otherwise fallback to current members
  const totalTarget = maxMembers || members.length || 1;
  const completionPercentage = Math.min(100, Math.round((completedCount / totalTarget) * 100));

  const moodEmoji: Record<string, string> = {
    'peaceful': '🌿',
    'scenic': '📷',
    'social': '👥',
    'challenging': '⛰️',
    'adventurous': '🗻',
  };

  const difficultyEmoji: Record<string, string> = {
    'easy': '🟢',
    'medium': '🟡',
    'hard': '🔴',
  };

  const difficultyColor: Record<string, string> = {
    'easy': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'hard': 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200 flex items-center gap-3 shadow-sm sticky top-0">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{teamName}</h1>
          <p className="text-sm text-gray-500">Team Details</p>
        </div>
        <button
          onClick={fetchTeamDetails}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw size={20} className="text-gray-700" />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4 text-red-800 flex gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Team Info Card */}
        <div className="bg-gradient-to-r from-hike-green/10 to-emerald-100 rounded-2xl p-5 border border-hike-green/20">
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-bold text-lg text-gray-900">Team Info</h2>
            <span className="text-xs font-bold bg-hike-green/20 text-hike-green px-2 py-1 rounded-full">
              {teamSize}/{maxMembers} Members
            </span>
          </div>
          {teamDescription && (
            <p className="text-sm text-gray-700 mb-2">{teamDescription}</p>
          )}
        </div>

        {/* Start Hike Button / Waiting Status */}
        <div className={`border-2 rounded-2xl p-4 shadow-sm animate-fade-in text-center ${routeConfirmed ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          {routeConfirmed ? (
            <>
              <h3 className="font-bold text-orange-900 mb-1">🎉 Route Confirmed!</h3>
              <p className="text-[10px] text-orange-700 font-bold uppercase mb-2">"{confirmedRouteName}"</p>
              <p className="text-xs text-orange-800 mb-3">{isTeamLeader ? 'You have finalized the route. Ready to lead the team?' : 'The team leader has finalized the route. Ready to go?'}</p>
              <button 
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    alert('Note: You are not logged in. Your track will not be saved.');
                  }
                  
                  if (onStartHike) {
                    onStartHike();
                  } else if (onBack) {
                    // Fallback for backward compatibility
                    onBack();
                  }
                }} 
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Compass size={18} /> {isTeamLeader ? 'Start Hike' : 'View Route & Start'}
              </button>
            </>
          ) : (
            <>
              <h3 className="font-bold text-gray-900 mb-1">{isTeamLeader ? '⏳ Setting up Route' : '⏳ Waiting for Captain'}</h3>
              <p className="text-xs text-gray-600 mb-3">{isTeamLeader ? 'Invite members and analyze preferences to confirm a route.' : 'Please wait for the captain to analyze preferences and confirm a route.'}</p>
              <button 
                onClick={() => fetchTeamDetails(true)} 
                className="w-full bg-white text-gray-700 font-bold py-3 rounded-xl border border-gray-300 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Refresh Status
              </button>
            </>
          )}
        </div>

        {/* Progress Section - Only show if there are members */}
        {members.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-lg text-gray-900">📋 Preference Forms Completed</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-hike-green transition-all"
                    style={{ width: `${completionPercentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="font-bold text-hike-green text-sm whitespace-nowrap">
                {completedCount}/{maxMembers}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {completedCount >= maxMembers 
                ? '✅ All target members ready!' 
                : `Waiting for ${maxMembers - completedCount} more members to complete...`}
            </p>
          </div>
        )}

        {/* Members Section */}
        <div className="space-y-3">
          {members.length > 0 && (
            <h3 className="font-bold text-lg text-gray-900">👥 Member Preferences</h3>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hike-green"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <Users size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No team members joined yet</p>
              <p className="text-xs text-gray-400 mt-1 px-8">When others join using the team link, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900">{member.user_name}</h4>
                        {member.preferences_completed && (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            <Check size={12} />
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{member.user_email}</p>
                    </div>
                  </div>

                  {/* Preferences */}
                  {member.preferences_completed && member.user_preferences ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Mood:</span>
                        <p className="font-bold text-gray-900">
                          {moodEmoji[member.user_mood || 'peaceful'] || '🏔️'} {member.user_mood}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Difficulty:</span>
                        <p>
                          <span className={`inline-block px-2 py-1 rounded-full font-bold ${difficultyColor[member.user_difficulty || 'medium'] || 'bg-gray-100'}`}>
                            {difficultyEmoji[member.user_difficulty || 'medium']} {member.user_difficulty}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Time Available:</span>
                        <p className="font-bold text-gray-900">
                          {Math.floor((member.user_preferences.availableTime || 0) / 60)}h
                          {(member.user_preferences.availableTime || 0) % 60 > 0 ? ` ${(member.user_preferences.availableTime || 0) % 60}m` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Distance:</span>
                        <p className="font-bold text-gray-900">{member.user_preferences.maxDistance} km</p>
                      </div>
                      {member.user_condition && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Notes:</span>
                          <p className="font-medium text-gray-700 text-xs mt-1">{member.user_condition}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">
                      ⏳ Waiting for preferences...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDetailsView;
