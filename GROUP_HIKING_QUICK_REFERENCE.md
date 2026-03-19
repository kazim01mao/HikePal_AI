# 🏔️ Group Hiking - 快速参考 & 常用代码

## 📚 目录

1. [数据库操作](#数据库操作)
2. [TeamService 常用函数](#teamservice-常用函数)
3. [GroupNegotiation 常用函数](#groupnegotiation-常用函数)
4. [前端组件片段](#前端组件片段)
5. [错误处理](#错误处理)
6. [调试技巧](#调试技巧)

---

## 🗄️ 数据库操作

### 查看所有团队

```sql
-- 所有公开团队 (按最新度排序)
SELECT id, name, created_at, current_members, team_size
FROM teams_with_members
WHERE is_public = true
ORDER BY created_at DESC
LIMIT 20;

-- 特定用户创建的团队
SELECT * FROM teams
WHERE created_by = 'user_uuid'
ORDER BY created_at DESC;

-- 特定用户加入的所有团队
SELECT DISTINCT t.*
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
WHERE tm.user_id = 'user_uuid'
ORDER BY tm.joined_at DESC;
```

### 查看团队成员和完成状态

```sql
-- 查看某个团队的所有成员和完成状态
SELECT 
  tm.user_id,
  tm.role,
  tm.preferences_completed,
  tm.user_mood,
  tm.user_difficulty,
  tm.user_condition,
  'Member ' || ROW_NUMBER() OVER (ORDER BY tm.joined_at) as member_num
FROM team_members tm
WHERE tm.team_id = 'team_uuid'
ORDER BY tm.role DESC, tm.joined_at ASC;

-- 统计完成情况
SELECT 
  COUNT(*) as total_members,
  SUM(CASE WHEN preferences_completed THEN 1 ELSE 0 END) as completed,
  ROUND(SUM(CASE WHEN preferences_completed THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100) as completion_percentage
FROM team_members
WHERE team_id = 'team_uuid';
```

### 查看协商历史

```sql
-- 某个团队的所有协商历史
SELECT 
  id,
  initiated_by,
  created_at,
  synthesized_mood,
  synthesized_difficulty,
  selected_route_id
FROM team_negotiation_history
WHERE team_id = 'team_uuid'
ORDER BY created_at DESC;

-- 查看最新的协商和推荐的路由
SELECT 
  h.id,
  h.synthesized_mood,
  h.synthesized_condition,
  h.ai_analysis,
  h.recommended_routes
FROM team_negotiation_history h
WHERE h.team_id = 'team_uuid'
ORDER BY h.created_at DESC
LIMIT 1;
```

### 查看生成的路由

```sql
-- 某个团队生成过的所有路由结果
SELECT 
  id,
  synthetic_query,
  auto_generated_title,
  selected_route_id,
  generated_at
FROM team_generated_routes
WHERE team_id = 'team_uuid'
ORDER BY generated_at DESC;
```

### 清理和维护

```sql
-- 删除已完成的团队及其所有关联数据
DELETE FROM teams WHERE id = 'team_uuid';
-- (级联删除会自动删除关联的 team_members, negotiation_history 等)

-- 获取最近 30 天没有活动的团队
SELECT * FROM teams
WHERE updated_at < NOW() - INTERVAL '30 days'
AND status = 'planning'
ORDER BY updated_at ASC;

-- 重置某个团队的协商状态
UPDATE teams SET 
  negotiation_completed = false,
  hiking_mood = NULL,
  hiking_difficulty = NULL
WHERE id = 'team_uuid';
```

---

## 👥 TeamService 常用函数

### 创建团队

```typescript
import * as teamService from '../services/teamService';

// 基础创建
const newTeam = await teamService.createTeam(
  name: 'Dragon Peak Club',
  description: 'Weekend mountain adventure',
  isPublic: true,
  teamSize: 4
);

console.log(newTeam.invite_code);    // 'ABC123'
console.log(newTeam.invite_link);    // 'https://hikepal.com/join?code=ABC123'
```

### 加入团队

```typescript
// 通过邀请码
const joinedTeam = await teamService.joinTeamByCode('ABC123');

// 搜索团队
const results = await teamService.searchPublicTeams('Dragon Peak Club');
results.forEach(team => {
  console.log(team.name, team.current_members, team.team_size);
});

// 发现团队
const publicTeams = await teamService.discoverPublicTeams(limit: 20);
```

### 获取团队信息

```typescript
// 获取完整的团队信息（包含成员）
const teamWithMembers = await teamService.getTeamWithMembers('team_uuid');

console.log(teamWithMembers.name);
console.log(teamWithMembers.members);          // TeamMember[]
console.log(teamWithMembers.completionPercentage);  // 0-100

// 获取当前用户的所有团队
const myTeams = await teamService.getUserTeams();
myTeams.forEach(team => {
  console.log(`${team.name}: ${team.completionPercentage}% complete`);
});
```

### 更新偏好

```typescript
// 更新某个成员的偏好
await teamService.updateMemberPreferences(
  teamId: 'team_uuid',
  userId: 'user_uuid',
  mood: 'Peaceful',
  difficulty: 'easy',
  condition: 'Quiet forest with nice views and photo spots',
  availableTime: 300,      // 5 小时
  maxDistance: 20          // 20 公里
);
```

### 检查状态

```typescript
// 所有成员是否都完成了偏好
const done = await teamService.areAllPreferencesCompleted('team_uuid');
if (done) {
  console.log('Ready for Social Negotiation!');
}

// 验证身份
const isLeader = await teamService.isTeamLeader('team_uuid', 'user_uuid');
const isMember = await teamService.isTeamMember('team_uuid', 'user_uuid');

// 获取成员状态
const statuses = await teamService.getTeamMemberStatus('team_uuid');
statuses.forEach(member => {
  console.log(`${member.userId}: ${member.isCompleted ? '✅' : '⏳'}`);
});

// 获取所有成员偏好（用于 AI 分析）
const allPrefs = await teamService.getAllMemberPreferences('team_uuid');
allPrefs.forEach(pref => {
  console.log(`${pref.userId}: ${pref.mood}, ${pref.difficulty}`);
  console.log(`  Request: ${pref.condition}`);
});
```

### 删除和离开

```typescript
// 队长删除团队
await teamService.deleteTeam('team_uuid');

// 成员离开团队
await teamService.leaveTeam('team_uuid', 'user_uuid');
```

---

## 🤝 GroupNegotiation 常用函数

### 执行社交协商 (主函数)

```typescript
import * as groupService from '../services/groupNegotiationService';

// 这是核心函数，队长点击按钮时调用
const result = await groupService.performGroupNegotiation(
  teamId: 'team_uuid',
  initiatorId: 'leader_user_id'
);

// 结果结构
console.log(result.teamId);                    // team id
console.log(result.memberCount);               // 4
console.log(result.synthesizedPreferences);    // { mood, difficulty, condition, ... }
console.log(result.recommendedRoutes);        // RouteMatchScore[]
console.log(result.autoGeneratedTitle);        // "Serenity Seekers Hike (4 members)"
console.log(result.negotiationId);             // 用于保存选择

// 推荐的路由结构
result.recommendedRoutes.forEach(route => {
  console.log(`${route.name} (${route.score}%)`);
  console.log(`  Segments: ${route.segments?.map(s => s.name).join(', ')}`);
  console.log(`  Reasons: ${route.matchReasons?.join(', ')}`);
});
```

### 处理 AI 响应

```typescript
// 这是内部处理，但可以用来调试
import { parseAIResponse } from '../services/groupNegotiationService';

const rawResponse = `{
  "synthesizedMood": "Peaceful + Scenic",
  "synthesizedDifficulty": "medium",
  "synthesizedCondition": "Forest hike with scenic views",
  "analysis": "Perfect compromise...",
  "considerations": ["Allow photo time", "Shaded paths"]
}`;

const parsed = parseAIResponse(rawResponse);
console.log(parsed.synthesizedMood);   // "Peaceful + Scenic"
```

### 选择推荐的路由

```typescript
// 用户选择某条路由后调用
await groupService.selectGroupRoute(
  teamId: 'team_uuid',
  routeId: 'route_uuid',
  negotiationId: 'negotiation_id'
);

// 之后,获取协商历史
const history = await groupService.getTeamNegotiationHistory('team_uuid');
history.forEach(record => {
  console.log(`Negotiation: ${record.synthesized_mood}`);
  console.log(`Selected Route: ${record.selected_route_id}`);
});
```

### 重新运行协商

```typescript
// 如果有成员修改了偏好，重新分析
const newResult = await groupService.rerunNegotiation(
  teamId: 'team_uuid',
  initiatorId: 'leader_user_id'
);

// 返回新的推荐列表
```

### 辅助函数

```typescript
// 格式化偏好用于显示
const pref = { mood: 'Peaceful', difficulty: 'easy', condition: 'quiet' };
console.log(groupService.formatMemberPreferences(pref));
// → "Peaceful • Easy • "quiet""

// 获取难度描述
console.log(groupService.getDifficultyDescription('medium'));
// → "Moderate fitness required, some elevation and technical sections"

// 获取心情描述
console.log(groupService.getMoodDescription('adventurous'));
// → "Seeking challenges and new experiences"
```

---

## 🎨 前端组件片段

### 创建团队表单

```tsx
import { useState } from 'react';
import * as teamService from '../services/teamService';

export function CreateTeamModal({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState(2);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Please enter team name');
      return;
    }

    setLoading(true);
    try {
      const team = await teamService.createTeam(
        name,
        description,
        isPublic,
        teamSize
      );

      setInviteLink(team.invite_link);
      alert(`Team created! Share this link: ${team.invite_link}`);
      onCreated();
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <input
        placeholder="Team Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="number"
        min={1}
        max={50}
        value={teamSize}
        onChange={(e) => setTeamSize(parseInt(e.target.value))}
      />
      <label>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Make Public
      </label>
      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Create Team'}
      </button>
      {inviteLink && (
        <div>
          <p>Share this link: {inviteLink}</p>
          <button onClick={() => navigator.clipboard.writeText(inviteLink)}>
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}
```

### 偏好填写表单

```tsx
import { useEffect, useState } from 'react';
import * as teamService from '../services/teamService';
import * as groupService from '../services/groupNegotiationService';

export function PreferenceFilling({ teamId }: { teamId: string }) {
  const [team, setTeam] = useState<any>(null);
  const [mood, setMood] = useState('Peaceful');
  const [difficulty, setDifficulty] = useState('medium');
  const [condition, setCondition] = useState('');
  const [loading, setLoading] = useState(false);
  const [negotiating, setNegotiating] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  async function loadTeam() {
    try {
      const teamData = await teamService.getTeamWithMembers(teamId);
      setTeam(teamData);
    } catch (error) {
      console.error('Error loading team:', error);
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      await teamService.updateMemberPreferences(
        teamId,
        user.user!.id,
        mood,
        difficulty,
        condition,
        300,
        20
      );

      await loadTeam();
      alert('Preferences saved!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  }

  async function handleNegotiate() {
    setNegotiating(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      const result = await groupService.performGroupNegotiation(
        teamId,
        user.user!.id
      );

      console.log('Negotiation result:', result);
      // 显示结果给用户
      // 这里应该导航到结果界面
    } catch (error) {
      console.error('Negotiation error:', error);
      alert('Negotiation failed: ' + error.message);
    } finally {
      setNegotiating(false);
    }
  }

  if (!team) return <div>Loading...</div>;

  const allCompleted = team.completionPercentage === 100;
  const isLeader = team.members.some(
    (m: any) => m.role === 'leader' && m.user_id === user?.user?.id
  );

  return (
    <div className="preference-form">
      <h2>{team.name}</h2>

      <div className="members-status">
        <h3>Team Members ({team.completionPercentage}% complete)</h3>
        {team.members.map((member: any) => (
          <div key={member.id} className="member-row">
            <span>{member.user_id}</span>
            <span>{member.preferences_completed ? '✅' : '⏳'}</span>
          </div>
        ))}
      </div>

      <div className="your-preferences">
        <h3>Your Preferences</h3>

        <label>
          Mood:
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option>Peaceful</option>
            <option>Adventurous</option>
            <option>Scenic</option>
            <option>Social</option>
            <option>Challenging</option>
          </select>
        </label>

        <label>
          Difficulty:
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label>
          What are you looking for?
          <textarea
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g., quiet forest, good for photos, family-friendly..."
          />
        </label>

        <button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save & Mark Complete'}
        </button>
      </div>

      {isLeader && allCompleted && (
        <div className="negotiation-section">
          <button
            onClick={handleNegotiate}
            disabled={negotiating}
            className="primary-btn"
          >
            {negotiating ? '🔄 Analyzing...' : '🤝 Social Negotiation'}
          </button>
        </div>
      )}
    </div>
  );
}
```

### 协商结果显示

```tsx
export function NegotiationResults({ result, onSelectRoute }: any) {
  return (
    <div className="negotiation-results">
      <h2>AI Analysis Results</h2>

      <div className="synthesis">
        <h3>Combined Group Preferences</h3>
        <p>Mood: {result.synthesizedPreferences.synthesizedMood}</p>
        <p>Difficulty: {result.synthesizedPreferences.synthesizedDifficulty}</p>
        <p>Description: {result.synthesizedPreferences.synthesizedCondition}</p>
        <p className="analysis">{result.synthesizedPreferences.analysis}</p>
        
        <div className="considerations">
          <strong>Considerations:</strong>
          <ul>
            {result.synthesizedPreferences.considerations?.map((c: string) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="routes">
        <h3>{result.autoGeneratedTitle}</h3>
        {result.recommendedRoutes.map((route: any) => (
          <div key={route.id} className="route-card">
            <div className="route-header">
              <h4>{route.name}</h4>
              <span className="score">{route.score}%</span>
            </div>
            
            <p className="route-stats">
              {route.distance} km | {route.duration} h | 
              Difficulty {route.difficulty}/5
            </p>

            {route.matchReasons && (
              <p className="reasons">
                Why: {route.matchReasons.join(', ')}
              </p>
            )}

            {route.segments && (
              <div className="segments">
                <p className="segments-label">Includes:</p>
                <div className="segment-badges">
                  {route.segments.slice(0, 3).map((s: any) => (
                    <span key={s.id} className="badge">{s.name}</span>
                  ))}
                  {route.segments.length > 3 && (
                    <span className="badge">+{route.segments.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            <button 
              onClick={() => onSelectRoute(route.id)}
              className="select-btn"
            >
              Select This Route
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🐛 错误处理

### 常见错误和解决方案

```typescript
// 1. 邀请码无效
try {
  await teamService.joinTeamByCode('INVALID');
} catch (error) {
  if (error.message.includes('Invalid invitation code')) {
    // 提示用户输入正确的码
    console.log('Please check the invitation code');
  }
}

// 2. 不是队长，无法启动协商
try {
  await groupService.performGroupNegotiation(teamId, userId);
} catch (error) {
  if (error.message.includes('Only team leader')) {
    console.log('Only the team leader can initiate negotiation');
  }
}

// 3. 不是所有人都完成了偏好
try {
  await groupService.performGroupNegotiation(teamId, leaderId);
} catch (error) {
  if (error.message.includes('Not all team members')) {
    console.log('Waiting for members to complete their preferences');
  }
}

// 4. AI 响应解析失败
try {
  const result = await groupService.performGroupNegotiation(...);
} catch (error) {
  if (error.message.includes('JSON')) {
    console.log('AI API error or invalid response format');
    // 重试或显示友好的错误信息
  }
}
```

---

## 🔍 调试技巧

### 在浏览器控制台调试

```typescript
// 1. 查看当前用户的所有团队
const user = await supabase.auth.getUser();
const teams = await teamService.getUserTeams();
console.table(teams);

// 2. 查看特定团队的详情
const team = await teamService.getTeamWithMembers('team_uuid');
console.log('Team:', team.name);
console.table(team.members);
console.log('Completion:', team.completionPercentage + '%');

// 3. 获取所有偏好（AI 分析前看）
const prefs = await teamService.getAllMemberPreferences('team_uuid');
console.table(prefs);

// 4. 模拟 AI 响应解析
import { parseAIResponse } from '../services/groupNegotiationService';
const mockResponse = `{...json...}`;
console.log(parseAIResponse(mockResponse));
```

### 数据库查询调试

```sql
-- 1. 查看某个用户的所有团队
SELECT t.*, COUNT(tm.id) as members
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
WHERE t.created_by = 'testing_user_uuid'
GROUP BY t.id;

-- 2. 查看完成进度最慢的团队
SELECT 
  t.id, t.name,
  COUNT(tm.id) as total,
  SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END) as done
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id
HAVING SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END) < COUNT(tm.id)
ORDER BY (COUNT(tm.id) - SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END)) DESC;

-- 3. 查看最近的协商记录
SELECT * FROM team_negotiation_history
ORDER BY created_at DESC
LIMIT 5;
```

### 性能测试

```typescript
// 测试协商的响应时间
console.time('negotiation');
const result = await groupService.performGroupNegotiation(teamId, leaderId);
console.timeEnd('negotiation');
// → 预期: 2-5 秒 (取决于 Gemini API)

// 测试路由匹配
console.time('route_matching');
const routes = await findMatchingRoutes(prefs);
console.timeEnd('route_matching');
// → 预期: < 1 秒
```

---

**祝你实现顺利！🎉**
