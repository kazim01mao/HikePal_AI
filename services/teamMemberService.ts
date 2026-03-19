/**
 * teamMemberService.ts
 * 
 * 缘故 Supabase 的团队成员管理服务
 * 负责：
 * - 获取团队成员列表
 * - 读取成员偏好
 * - 计算团队完成率/进度
 * - 监听成员更新
 */

import { supabase } from '../utils/supabaseClient';
import { UserHikingPreferences } from './segmentRoutingService';

/**
 * 团队成员数据结构
 */
export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  user_mood?: string;
  user_difficulty?: string;
  user_condition?: string;
  user_preferences?: UserHikingPreferences;
  role: 'leader' | 'member';
  preferences_completed: boolean;
  preferences_completed_at?: string;
  joined_at: string;
  updated_at: string;
}

/**
 * 团队进度数据
 */
export interface TeamProgress {
  total_members: number;
  completed_members: number;
  completion_percentage: number;
  pending_members: TeamMember[];
  completed_members_data: TeamMember[];
}

/**
 * 🔍 获取团队的所有成员
 */
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch team members:', error);
    throw error;
  }
}

/**
 * 📊 获取团队的完成进度
 */
export async function fetchTeamProgress(teamId: string): Promise<TeamProgress> {
  try {
    const members = await fetchTeamMembers(teamId);

    const completed_members_data = members.filter(m => m.preferences_completed);
    const pending_members = members.filter(m => !m.preferences_completed);

    const total = members.length || 1;  // 避免除以 0
    const completed = completed_members_data.length;

    return {
      total_members: total,
      completed_members: completed,
      completion_percentage: Math.round((completed / total) * 100),
      pending_members,
      completed_members_data,
    };
  } catch (error) {
    console.error('❌ Failed to fetch team progress:', error);
    throw error;
  }
}

/**
 * 👤 获取单个成员的偏好
 */
export async function fetchMemberPreference(
  teamId: string,
  userId: string
): Promise<TeamMember | null> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('❌ Failed to fetch member preference:', error);
    throw error;
  }
}

/**
 * ✏️ 更新成员偏好
 */
export async function updateMemberPreference(
  teamId: string,
  userId: string,
  updates: Partial<TeamMember>
): Promise<TeamMember> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Failed to update member preference:', error);
    throw error;
  }
}

/**
 * 🗑️ 移除团队成员
 */
export async function removeMemberFromTeam(
  teamId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    // 更新团队成员计数
    const members = await fetchTeamMembers(teamId);
    await supabase
      .from('teams')
      .update({ team_size: members.length })
      .eq('id', teamId);

    console.log('✅ Member removed from team');
  } catch (error) {
    console.error('❌ Failed to remove member:', error);
    throw error;
  }
}

/**
 * ✅ 切换成员的完成状态
 */
export async function toggleMemberCompletion(
  teamId: string,
  userId: string,
  completed: boolean
): Promise<TeamMember> {
  return updateMemberPreference(teamId, userId, {
    preferences_completed: completed,
    preferences_completed_at: completed
      ? new Date().toISOString()
      : null,
  } as any);
}

/**
 * 📡 【实时】订阅团队成员的更新
 * 用于领队仪表板实时显示进度
 */
export function subscribeToTeamMemberUpdates(
  teamId: string,
  onUpdate: (member: TeamMember) => void,
  onError?: (error: Error) => void
) {
  // 使用 Supabase 实时订阅
  const subscription = supabase
    .channel(`team_members_${teamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',  // 监听所有事件（INSERT, UPDATE, DELETE）
        schema: 'public',
        table: 'team_members',
        filter: `team_id=eq.${teamId}`,
      },
      (payload) => {
        console.log('🔄 Member update received:', payload);
        const member = payload.new as TeamMember;
        onUpdate(member);
      }
    )
    .on('error', (error) => {
      console.error('❌ Subscription error:', error);
      if (onError) onError(error);
    })
    .subscribe();

  return subscription;
}

/**
 * 🔔 订阅团队进度更新
 * 用于前端实时显示"3/5 完成"的进度条
 */
export async function subscribeToTeamProgress(
  teamId: string,
  onProgressUpdate: (progress: TeamProgress) => void,
  onError?: (error: Error) => void
) {
  try {
    // 初始获取一次进度
    const initialProgress = await fetchTeamProgress(teamId);
    onProgressUpdate(initialProgress);

    // 订阅成员更新，每次更新时重新计算进度
    const subscription = subscribeToTeamMemberUpdates(
      teamId,
      async (member) => {
        // 成员有更新时，重新获取进度
        try {
          const updatedProgress = await fetchTeamProgress(teamId);
          onProgressUpdate(updatedProgress);
        } catch (error) {
          console.error('Failed to update progress:', error);
          if (onError) onError(error as Error);
        }
      },
      onError
    );

    return subscription;
  } catch (error) {
    console.error('❌ Failed to subscribe to team progress:', error);
    if (onError) onError(error as Error);
  }
}

/**
 * 📋 获取团队所有成员的完整偏好数据（用于 AI 分析）
 */
export async function getTeamMemberPreferences(
  teamId: string
): Promise<{ member: TeamMember; preferences: UserHikingPreferences }[]> {
  try {
    const members = await fetchTeamMembers(teamId);

    return members
      .filter(m => m.preferences_completed && m.user_preferences)
      .map(m => ({
        member: m,
        preferences: m.user_preferences!,
      }));
  } catch (error) {
    console.error('❌ Failed to get team member preferences:', error);
    throw error;
  }
}
