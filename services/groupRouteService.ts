import { findMatchingRoutes, UserHikingPreferences, RouteMatchScore } from './segmentRoutingService';
import { callGeminiAPI } from './geminiService';

export interface MemberPreference {
  userId: string;
  userName: string;
  mood: string;
  difficulty: string;
  condition: string;
  timestamp?: string;
}

export interface GroupRouteResult {
  teamId: string;
  memberCount: number;
  synthesisAnalysis: string;
  recommendedRoutes: RouteMatchScore[];
  synthesizedPreferences: UserHikingPreferences;
  weatherContext?: { temp?: number; humidity?: number; condition?: string; rainfallMm?: number; sunrise?: string; sunset?: string };
}

/**
 * 使用 Gemini 分析团队所有成员的偏好，综合出统一的团队偏好
 */
export const synthesizeGroupPreferences = async (
  teamId: string,
  members: (MemberPreference & { user_preferences?: UserHikingPreferences })[]
): Promise<{ synthesis: string; preferences: UserHikingPreferences }> => {
  if (members.length === 0) {
    throw new Error('No members in team');
  }

  try {
    const membersList = members
      .map((m, i) => `Member ${i + 1} (${m.userName}): Mood=${m.mood}, Difficulty=${m.difficulty}, Looking for="${m.condition}"`)
      .join('\n');

    const prompt = `You are an expert hiking guide negotiator. Your task is to synthesize the preferences of multiple team members into a single set of group hiking preferences.

Team Members' Preferences:
${membersList}

Task:
1. Analyze the preferences of all members
2. Find the CONSENSUS on mood/difficulty/conditions that would satisfy the MOST people
3. Explain the compromises and considerations in 2-3 sentences
4. Return a synthesized group profile

Return ONLY valid JSON (no markdown code blocks):
{
  "analysis": "Brief explanation of how you synthesized these preferences",
  "group_mood": "peaceful|scenic|social|challenging|adventurous (one that best fits the group consensus)",
  "group_difficulty": "easy|medium|hard (the level that most members can enjoy)",
  "group_condition": "A short summary of what the group is looking for (e.g., 'scenic views, good for photos, not too steep')"
}`;

    const responseText = await callGeminiAPI(prompt);
    
    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const synthesis = result.analysis || 'Group preferences synthesized';
    // Calculate averages for time and distance from members who have them
    const validTimePrefs = members.filter(m => m.user_preferences?.availableTime).map(m => m.user_preferences!.availableTime);
    const validDistPrefs = members.filter(m => m.user_preferences?.maxDistance).map(m => m.user_preferences!.maxDistance);
    
    const avgTime = validTimePrefs.length > 0 
      ? validTimePrefs.reduce((a, b) => a + b, 0) / validTimePrefs.length 
      : 300;
      
    const avgDist = validDistPrefs.length > 0 
      ? validDistPrefs.reduce((a, b) => a + b, 0) / validDistPrefs.length 
      : 25;

    const preferences: UserHikingPreferences = {
      mood: result.group_mood || 'peaceful',
      difficulty: result.group_difficulty || 'medium',
      condition: result.group_condition || 'good hiking experience',
      availableTime: Math.round(avgTime),
      maxDistance: Number(avgDist.toFixed(1)),
      isSegmentBased: true // Force segment-based routing for groups
    };

    return { synthesis, preferences };
  } catch (error) {
    console.error('Error synthesizing group preferences:', error);
    throw error;
  }
};

/**
 * 核心：根据团队偏好推荐最佳路线
 */
export const recommendRoutesForGroup = async (
  teamId: string,
  members: MemberPreference[],
  weatherContext?: { temp?: number; humidity?: number; condition?: string; rainfallMm?: number; sunrise?: string; sunset?: string }
): Promise<GroupRouteResult> => {
  try {
    // 1. 第一步：综合所有成员的偏好
    const { synthesis, preferences } = await synthesizeGroupPreferences(teamId, members);
    
    // 2. 第二步：使用综合偏好搜索最佳路线
    const recommendedRoutes = await findMatchingRoutes(preferences, 5, weatherContext);

    // 3. 返回完整结果给队长界面
    return {
      teamId,
      memberCount: members.length,
      synthesisAnalysis: synthesis,
      recommendedRoutes: recommendedRoutes.slice(0, 3), // Top 3 routes for group
      synthesizedPreferences: preferences,
      weatherContext: weatherContext,
    };
  } catch (error) {
    console.error("Error recommending routes for group:", error);
    throw error;
  }
};

/**
 * 辅助函数：将团队成员列表序列化成易读的格式（用于UI显示）
 */
export const formatGroupMemberList = (members: MemberPreference[]): string => {
  return members.map(m => `${m.userName} (${m.mood})`).join(', ');
};

/**
 * 🆕 获取成员偏好的详细格式化文本
 */
export const getMemberPreferenceDetails = (members: MemberPreference[]): string => {
  if (members.length === 0) return "No preferences submitted yet.";
  
  return members.map(m => {
    let detail = `${m.userName}: ${m.mood.toUpperCase()}, ${m.difficulty.toUpperCase()}`;
    if (m.condition) detail += ` ("${m.condition}")`;
    return detail;
  }).join('\n');
};
