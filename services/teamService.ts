// ============================================================================
// services/teamService.ts
// 团队管理相关的服务函数
// ============================================================================

import { supabase } from '../utils/supabaseClient';

// ============================================================================
// 类型定义
// ============================================================================

export interface Team {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  is_public: boolean;
  invite_code: string;
  invite_link: string;
  team_size: number;
  current_members?: number;
  completed_preferences?: number;
  status: 'planning' | 'hiking' | 'completed';
  negotiation_completed: boolean;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'leader' | 'member';
  preferences_completed: boolean;
  joined_at: string;
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
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  completionPercentage: number;
}

// ============================================================================
// Team 管理函数
// ============================================================================

/**
 * 创建一个新的团队
 * @param name - 团队名称
 * @param description - 团队描述
 * @param isPublic - 是否公开
 * @param teamSize - 预期队伍人数
 * @returns 创建的团队及其邀请链接
 */
export async function createTeam(
  name: string,
  description: string,
  isPublic: boolean = true,
  teamSize: number = 1
): Promise<Team> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name,
      description,
      is_public: isPublic,
      created_by: user.user.id,
      team_size: teamSize,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating team:', error);
    throw error;
  }

  // 自动将创建者添加为队长
  await addTeamMember(data.id, user.user.id, 'leader');

  return data as Team;
}

/**
 * 获取团队的完整信息（包含成员列表）
 * @param teamId - 团队 ID
 * @returns 团队信息及其所有成员
 */
export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers> {
  const { data: teamData, error: teamError } = await supabase
    .from('teams_with_members')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamError) {
    console.error('Error fetching team:', teamError);
    throw teamError;
  }

  const { data: membersData, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (membersError) {
    console.error('Error fetching team members:', membersError);
    throw membersError;
  }

  const completionPercentage =
    membersData.length > 0
      ? Math.round(
          (membersData.filter((m) => m.preferences_completed).length /
            membersData.length) *
            100
        )
      : 0;

  return {
    ...(teamData as Team),
    members: membersData as TeamMember[],
    completionPercentage,
  };
}

/**
 * 通过邀请码加入团队
 * @param inviteCode - 邀请码（6位字符）
 * @returns 加入的团队信息
 */
export async function joinTeamByCode(inviteCode: string): Promise<Team> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }

  // 查找具有该邀请码的团队
  const { data: teamData, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (teamError || !teamData) {
    console.error('Team not found with this code:', teamError);
    throw new Error('Invalid invitation code');
  }

  const team = teamData as Team;

  // 检查用户是否已经是团队成员
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.user.id)
    .single();

  if (existingMember) {
    console.warn('User is already a member of this team');
    return team;
  }

  // 添加用户为团队成员
  await addTeamMember(team.id, user.user.id, 'member');

  return team;
}

/**
 * 搜索公开团队（按名称或邀请码）
 * @param query - 搜索关键词（团队名称或邀请码）
 * @returns 匹配的团队列表
 */
export async function searchPublicTeams(query: string): Promise<Team[]> {
  const upperQuery = query.toUpperCase();

  // 首先尝试按邀请码精确匹配
  const { data: exactMatch } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', upperQuery)
    .eq('is_public', true);

  if (exactMatch && exactMatch.length > 0) {
    return exactMatch as Team[];
  }

  // 然后按名称模糊搜索
  const { data: nameMatch, error } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', `%${query}%`)
    .eq('is_public', true)
    .limit(10);

  if (error) {
    console.error('Error searching teams:', error);
    throw error;
  }

  return (nameMatch || []) as Team[];
}

/**
 * 获取所有公开团队（Discover 功能）
 * @param limit - 返回的团队数量
 * @returns 公开团队列表
 */
export async function discoverPublicTeams(limit: number = 20): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams_with_members')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error discovering teams:', error);
    throw error;
  }

  return (data || []) as Team[];
}

/**
 * 获取当前用户加入的所有团队
 * @returns 用户加入的团队列表
 */
export async function getUserTeams(): Promise<TeamWithMembers[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }

  const { data: userTeams, error } = await supabase
    .from('teams')
    .select(
      `
      *,
      team_members (
        id,
        user_id,
        role,
        preferences_completed,
        joined_at,
        user_mood,
        user_difficulty,
        user_condition
      )
    `
    )
    .in(
      'id',
      (
        await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.user.id)
      ).data?.map((m) => m.team_id) || []
    );

  if (error) {
    console.error('Error fetching user teams:', error);
    throw error;
  }

  return (
    userTeams?.map((team) => ({
      ...(team as Team),
      members: team.team_members as TeamMember[],
      completionPercentage:
        team.team_members.length > 0
          ? Math.round(
              (team.team_members.filter((m: any) => m.preferences_completed)
                .length /
                team.team_members.length) *
                100
            )
          : 0,
    })) || []
  );
}

// ============================================================================
// Team Member 管理函数
// ============================================================================

/**
 * 向团队添加成员
 * @param teamId - 团队 ID
 * @param userId - 用户 ID
 * @param role - 角色 ('leader' 或 'member')
 */
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'leader' | 'member' = 'member'
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: userId,
      role,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding team member:', error);
    throw error;
  }

  return data as TeamMember;
}

/**
 * 更新团队成员的偏好设置
 * @param teamId - 团队 ID
 * @param userId - 用户 ID
 * @param mood - 心情
 * @param difficulty - 难度
 * @param condition - 条件描述
 * @param availableTime - 可用时间（分钟）
 * @param maxDistance - 最大距离（公里）
 */
export async function updateMemberPreferences(
  teamId: string,
  userId: string,
  mood: string,
  difficulty: string,
  condition: string,
  availableTime: number,
  maxDistance: number
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update({
      user_mood: mood,
      user_difficulty: difficulty,
      user_condition: condition,
      user_preferences: {
        mood,
        difficulty,
        condition,
        availableTime,
        maxDistance,
      },
      preferences_completed: true,
      preferences_completed_at: new Date().toISOString(),
    })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating member preferences:', error);
    throw error;
  }

  return data as TeamMember;
}

/**
 * 获取团队成员的状态（谁完成了，谁没完成）
 * @param teamId - 团队 ID
 * @returns 成员完成状态列表
 */
export async function getTeamMemberStatus(
  teamId: string
): Promise<
  Array<{
    userId: string;
    memberName: string;
    isCompleted: boolean;
    preferences?: {
      mood: string;
      difficulty: string;
      condition: string;
    };
  }>
> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `
      user_id,
      preferences_completed,
      user_mood,
      user_difficulty,
      user_condition
    `
    )
    .eq('team_id', teamId);

  if (error) {
    console.error('Error getting team member status:', error);
    throw error;
  }

  // 这里可以扩展获取用户名，需要 join users 表
  return (
    data?.map((member) => ({
      userId: member.user_id,
      memberName: '', // 需要从 profiles 表获取
      isCompleted: member.preferences_completed,
      preferences: member.preferences_completed
        ? {
            mood: member.user_mood || '',
            difficulty: member.user_difficulty || '',
            condition: member.user_condition || '',
          }
        : undefined,
    })) || []
  );
}

/**
 * 获取所有队员的偏好数据（用于 AI 综合分析）
 * @param teamId - 团队 ID
 * @returns 所有队员的偏好数组
 */
export async function getAllMemberPreferences(teamId: string): Promise<
  Array<{
    userId: string;
    mood: string;
    difficulty: string;
    condition: string;
    availableTime: number;
    maxDistance: number;
  }>
> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `
      user_id,
      user_mood,
      user_difficulty,
      user_condition,
      user_preferences
    `
    )
    .eq('team_id', teamId);

  if (error) {
    console.error('Error getting team preferences:', error);
    throw error;
  }

  return (
    data
      ?.filter((member) => member.user_preferences) // 只返回已完成的
      .map((member) => ({
        userId: member.user_id,
        mood: member.user_mood || '',
        difficulty: member.user_difficulty || '',
        condition: member.user_condition || '',
        availableTime: member.user_preferences?.availableTime || 300,
        maxDistance: member.user_preferences?.maxDistance || 20,
      })) || []
  );
}

/**
 * 验证用户是否是团队的队长
 * @param teamId - 团队 ID
 * @param userId - 用户 ID
 * @returns 是否是队长
 */
export async function isTeamLeader(teamId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('role', 'leader')
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error checking team leader:', error);
    throw error;
  }

  return !!data;
}

/**
 * 验证用户是否是团队的成员
 * @param teamId - 团队 ID
 * @param userId - 用户 ID
 * @returns 是否是成员
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking team membership:', error);
    throw error;
  }

  return !!data;
}

/**
 * 检查所有成员是否都完成了偏好设置
 * @param teamId - 团队 ID
 * @returns 是否全部完成
 */
export async function areAllPreferencesCompleted(teamId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('preferences_completed')
    .eq('team_id', teamId);

  if (error) {
    console.error('Error checking completion status:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return false;
  }

  return data.every((member) => member.preferences_completed);
}

/**
 * 删除团队（仅队长可删除）
 * @param teamId - 团队 ID
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }

  // 验证当前用户是队长
  const isLeader = await isTeamLeader(teamId, user.user.id);
  if (!isLeader) {
    throw new Error('Only team leader can delete the team');
  }

  const { error } = await supabase.from('teams').delete().eq('id', teamId);

  if (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
}

/**
 * 离开团队（非队长的成员可调用）
 * @param teamId - 团队 ID
 * @param userId - 用户 ID
 */
export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id || user.user.id !== userId) {
    throw new Error('Can only leave team as yourself');
  }

  // 检查用户是否是队长（队长不能离开，必须删除队伍）
  const isLeader = await isTeamLeader(teamId, userId);
  if (isLeader) {
    throw new Error('Team leader cannot leave. Delete the team instead.');
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error leaving team:', error);
    throw error;
  }
}

// ============================================================================
// Invite Link 管理（可选增强）
// ============================================================================

/**
 * 生成新的邀请链接（队长可命名链接以便管理）
 * @param teamId - 团队 ID
 * @param expiresIn - 过期时间（天数，0 表示不过期）
 * @param maxUses - 最大使用次数
 * @returns 新的邀请链接
 */
export async function generateInviteLink(
  teamId: string,
  expiresIn: number = 0,
  maxUses: number = 0
): Promise<{ code: string; link: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error('User not authenticated');
  }

  const inviteCode = generateRandomCode(6);
  const fullLink = `https://hikepal.com/join?code=${inviteCode}`;

  const expiresAt =
    expiresIn > 0 ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

  const { error } = await supabase.from('team_invite_links').insert({
    team_id: teamId,
    invite_code: inviteCode,
    full_link: fullLink,
    created_by: user.user.id,
    expires_at: expiresAt?.toISOString(),
    max_uses: maxUses || null,
  });

  if (error) {
    console.error('Error creating invite link:', error);
    throw error;
  }

  return { code: inviteCode, link: fullLink };
}

/**
 * 生成随机字符码
 */
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default {
  createTeam,
  getTeamWithMembers,
  joinTeamByCode,
  searchPublicTeams,
  discoverPublicTeams,
  getUserTeams,
  addTeamMember,
  updateMemberPreferences,
  getTeamMemberStatus,
  getAllMemberPreferences,
  isTeamLeader,
  isTeamMember,
  areAllPreferencesCompleted,
  deleteTeam,
  leaveTeam,
  generateInviteLink,
};
