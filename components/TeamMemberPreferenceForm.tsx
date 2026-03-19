import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserHikingPreferences } from '../services/segmentRoutingService';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import TeamDetailsView from './TeamDetailsView';

interface TeamMemberPreferenceFormProps {
  teamId: string;
  onSubmitSuccess?: () => void;
  onBack?: () => void;
  onStartHike?: () => void;
}

/**
 * 队员通过 Group Link 访问时看到的表单
 * 用于填写个人的登山偏好
 * 支持已登录和未登录用户
 */
const TeamMemberPreferenceForm: React.FC<TeamMemberPreferenceFormProps> = ({
  teamId,
  onSubmitSuccess,
  onBack,
  onStartHike,
}) => {
  // 表单状态
  const [memberEmail, setMemberEmail] = useState('');  // 🆕 邮箱（用于识别队员）
  const [userName, setUserName] = useState('');
  const [mood, setMood] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [condition, setCondition] = useState('');
  const [availableTime, setAvailableTime] = useState<number | ''>(''); // 🆕 无默认选项
  const [maxDistance, setMaxDistance] = useState<number | ''>(''); // 🆕 无默认选项

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showTeamDetails, setShowTeamDetails] = useState(false); // 🆕 显示队伍详情

  // 获取当前用户信息
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);

  useEffect(() => {
    // 获取当前认证用户（可能为 null）
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user?.email) {
        setMemberEmail(user.email);  // 自动填充登录用户的邮箱
      }
      console.log('Current user:', user);
    };

    // 获取团队信息
    const getTeamInfo = async () => {
      setIsLoadingTeam(true);
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name, description, max_team_size, team_size')
          .eq('id', teamId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
             // Team not found
             setTeamInfo(null);
          } else {
             throw error;
          }
        } else {
          setTeamInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch team info:', error);
        setSubmitError('Failed to load team info. Please check the link.');
      } finally {
        setIsLoadingTeam(false);
      }
    };

    getUser();
    getTeamInfo();
  }, [teamId]);

  /**
   * 处理提交偏好
   */
  const handleSubmitPreferences = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      setSubmitError('Please enter your name');
      return;
    }

    if (!memberEmail.trim()) {
      setSubmitError('Please enter your email address');
      return;
    }

    // 🆕 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(memberEmail.trim())) {
      setSubmitError('Please enter a valid email address (e.g., name@example.com)');
      return;
    }

    if (!mood) {
      setSubmitError('Please select your hiking mood');
      return;
    }

    if (!difficulty) {
      setSubmitError('Please select a difficulty level');
      return;
    }

    if (availableTime === '' || availableTime <= 0) {
      setSubmitError('Please specify how much time you have');
      return;
    }

    if (maxDistance === '' || maxDistance <= 0) {
      setSubmitError('Please specify the maximum distance');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 检查团队是否存在
      if (!teamInfo) {
        setSubmitError('Team does not exist or has been deleted, please check the link');
        return;
      }

      // 构建偏好对象
      const userPreferences: UserHikingPreferences = {
        mood: mood as any,
        difficulty: difficulty as any,
        condition,
        availableTime: Number(availableTime),
        maxDistance: Number(maxDistance),
      };

      // 如果用户已登录，使用其 ID；否则使用邮箱作为标识
      let userId = currentUser?.id;
      let memberRecord = null;

      if (!userId) {
        // 未登录：在 team_members 中按邮箱查找或插入
        // （使用邮箱的 MD5 哈希作为临时 user_id，避免特殊字符问题）
        const emailHash = memberEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
        userId = `user_${emailHash}`;
      }

      // 1. 检查队员是否已在团队中
      const { data: existingMember, error: fetchError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_id', userId);

      // 检查错误（排除 "无结果" 的错误）
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Query error:', fetchError);
          throw new Error(`Database query failed: ${fetchError.message}`);
        }

        if (existingMember && existingMember.length > 0) {
          // 更新现有队员的偏好
          const { error: updateError } = await supabase
            .from('team_members')
            .update({
              user_name: userName,
              user_email: memberEmail,  // 🆕 保存邮箱
              user_mood: mood,
              user_difficulty: difficulty,
              user_condition: condition,
              user_preferences: userPreferences,
              preferences_completed: true,
              preferences_completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMember[0].id);

          if (updateError) {
            console.error('❌ Update error:', updateError);
            throw new Error(`Update failed: ${updateError.message}`);
          }
          memberRecord = existingMember[0];
        } else {
          // 新增队员并保存偏好
          const { error: insertError, data: insertData } = await supabase
            .from('team_members')
            .insert([
              {
                team_id: teamId,
                user_id: userId,
                user_name: userName,
                user_email: memberEmail,  // 🆕 保存邮箱
                user_mood: mood,
                user_difficulty: difficulty,
                user_condition: condition,
                user_preferences: userPreferences,
                role: 'member',
                preferences_completed: true,
                preferences_completed_at: new Date().toISOString(),
              },
            ])
            .select('*')
            .single();

          if (insertError) {
            console.error('❌ Insert error details:', insertError);
            if (insertError.code === '23505') {
              // 违反 UNIQUE 约束
              throw new Error('This email has already joined the team. Please use a different email or update preferences directly.');
            } else if (insertError.code === 'PGRST001') {
              // RLS 政策受限
              throw new Error('Insufficient permissions. Please check if the invite link is valid.');
            }
            throw new Error(`Insert failed: ${insertError.message || 'Unknown error'}`);
          }
          memberRecord = insertData;

          // 🆕 更新团队的成员计数
          if (teamInfo) {
            const newTeamSize = (teamInfo.team_size || 0) + 1;
            await supabase
              .from('teams')
              .update({ team_size: newTeamSize })
              .eq('id', teamId);
          }
        }

      setSubmitSuccess(true);
      console.log('✅ Preferences submitted!', memberRecord);

      // 立即显示队伍详情，避免闪烁和重复提交
      // 🆕 通过状态改变而不是重新挂载来减少闪烁感
      setShowTeamDetails(true);
    } catch (error) {
      console.error('❌ Error submitting preferences:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to submit preferences, please try again.';
      setSubmitError(errorMsg);
      
      // 记录详细日志用于调试
      if (error instanceof Error) {
        console.error('📋 Error details:', {
          message: error.message,
          stack: error.stack,
          teamId,
          email: memberEmail
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showTeamDetails) {
    return (
      <TeamDetailsView
        teamId={teamId}
        teamName={teamInfo?.name || 'Team'}
        teamDescription={teamInfo?.description}
        maxMembers={teamInfo?.max_team_size || 5}
        onBack={() => {
          if (onBack) onBack();
        }}
        onStartHike={() => {
          if (onStartHike) onStartHike();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-gray-200 flex items-center gap-3 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Join Team</h1>
          <p className="text-sm text-gray-500">
            {teamInfo?.name ? `Team: ${teamInfo.name}` : 'Please fill in your hiking preferences'}
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {submitError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4 text-red-800 flex gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p>{submitError}</p>
        </div>
      )}

      {/* Loading State or Not Found State */}
      {isLoadingTeam ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hike-green"></div>
        </div>
      ) : !teamInfo ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Team Not Found</h2>
          <p className="text-gray-600">The team does not exist or has been deleted. Please check if your invite link is correct.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
          <form onSubmit={handleSubmitPreferences} className="max-w-2xl mx-auto space-y-6">
          {/* 邮箱输入 */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              📧 Your Email *
            </label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hike-green"
              required
            />
            <p className="text-xs text-gray-500">
              Used to identify you and receive updates
            </p>
          </div>

          {/* 名字输入 */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              👤 Your Name *
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., John"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hike-green"
              required
            />
          </div>

          {/* 心情选择 */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-900">
              🎯 Your Hiking Mood *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'peaceful', label: '🌿 Peaceful', desc: 'Relax and enjoy nature' },
                { value: 'scenic', label: '📷 Scenic', desc: 'Beautiful views & photos' },
                { value: 'social', label: '👥 Social', desc: 'Team interaction' },
                { value: 'challenging', label: '⛰️ Challenging', desc: 'Challenge yourself' },
                { value: 'adventurous', label: '🗻 Adventurous', desc: 'Seek thrills' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    mood === option.value
                      ? 'border-hike-green bg-hike-light'
                      : 'border-gray-200 bg-gray-50 hover:border-hike-green'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 难度选择 */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-900">
              📊 Physical Difficulty *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'easy', label: '🟢 Easy', desc: 'Suitable for all' },
                { value: 'medium', label: '🟡 Medium', desc: 'Moderate' },
                { value: 'hard', label: '🔴 Hard', desc: 'High demand' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDifficulty(option.value)}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    difficulty === option.value
                      ? 'border-hike-green bg-hike-light'
                      : 'border-gray-200 bg-gray-50 hover:border-hike-green'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 具体需求 */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              💭 What are you looking for? (Optional)
            </label>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g., Sunrise views, good for photos, near water, family-friendly"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hike-green h-20 resize-none"
            />
          </div>

          {/* 可用时间 */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              ⏱️ How much time do you have? (Hours) *
            </label>
            <div className="flex items-center gap-4">
              <input
                type="text"
                inputMode="decimal"
                value={availableTime === '' ? '' : availableTime / 60}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setAvailableTime('');
                    return;
                  }
                  const parsed = parseFloat(val);
                  if (!isNaN(parsed)) setAvailableTime(parsed * 60);
                }}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hike-green"
                placeholder="e.g., 5"
              />
              <span className="text-lg font-bold text-hike-green whitespace-nowrap w-20 text-right">
                {availableTime !== '' ? `${Math.floor(availableTime as number / 60)}h ${(availableTime as number) % 60 > 0 ? `${Math.round((availableTime as number) % 60)}m` : ''}` : ''}
              </span>
            </div>
          </div>

          {/* 最大距离 */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              📏 Max Distance *
            </label>
            <div className="flex items-center gap-4">
              <input
                type="text"
                inputMode="numeric"
                value={maxDistance === '' ? '' : maxDistance}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setMaxDistance('');
                    return;
                  }
                  const parsed = Number(val);
                  if (!isNaN(parsed)) setMaxDistance(parsed);
                }}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hike-green"
                placeholder="e.g., 20"
              />
              <span className="text-lg font-bold text-hike-green whitespace-nowrap w-20 text-right">
                {maxDistance !== '' ? `${maxDistance} km` : ''}
              </span>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 font-bold text-white rounded-xl transition-all ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-hike-green hover:bg-green-600 active:scale-95'
            }`}
          >
            {isSubmitting ? 'Submitting...' : '✅ Submit My Preferences'}
          </button>
        </form>
      </div>
      )}
    </div>
  );
};

export default TeamMemberPreferenceForm;
