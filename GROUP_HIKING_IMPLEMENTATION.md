# 🏔️ Group Hiking System - 完整实现指南

## 📋 系统概述

这个 Group Hiking 系统允许用户组织团队登山，其中：
1. **队长创建团队** → 生成邀请链接
2. **队友加入** → 通过链接或搜索
3. **填写偏好** → 每个队友输入自己的需求
4. **AI 综合分析** → "Social Negotiation" 按钮调用 AI
5. **推荐路由** → 显示符合团队需求的路线

---

## 🗄️ 数据库表结构

执行 `group_hiking_database.sql` 创建以下表：

```
teams
├─ id, name, description
├─ created_by, created_at
├─ invite_code (6位唯一码)
├─ invite_link (完整分享链接)
├─ team_size, current_members
├─ hiking_mood, hiking_difficulty (AI 综合的)
└─ status: planning | hiking | completed

team_members
├─ team_id, user_id
├─ role: leader | member
├─ preferences_completed (boolean)
├─ user_mood, user_difficulty, user_condition
└─ user_preferences (JSONB)

team_negotiation_history
├─ team_id, initiated_by (队长)
├─ member_preferences (所有人的偏好)
├─ ai_analysis (AI 的分析文本)
├─ synthesized_mood, synthesized_difficulty, synthesized_condition
└─ recommended_routes (推荐的路线列表)

team_generated_routes
├─ team_id, negotiation_id
├─ synthetic_query
├─ routes (JSONB: [{ id, name, score, ... }])
├─ auto_generated_title
└─ selected_route_id
```

---

## 🔧 Service 层接口

### teamService.ts

```typescript
// 创建团队
createTeam(name, description, isPublic, teamSize): Team

// 获取团队信息
getTeamWithMembers(teamId): TeamWithMembers

// 加入团队
joinTeamByCode(inviteCode): Team

// 搜索公开团队  
searchPublicTeams(query): Team[]

// 发现团队
discoverPublicTeams(limit): Team[]

// 更新队员偏好
updateMemberPreferences(teamId, userId, mood, difficulty, condition, availableTime, maxDistance)

// 检查是否都完成了
areAllPreferencesCompleted(teamId): boolean

// 检查是否是队长
isTeamLeader(teamId, userId): boolean
```

### groupNegotiationService.ts

```typescript
// 执行 Social Negotiation
performGroupNegotiation(teamId, initiatorId): GroupNegotiationResult

// 选择路线
selectGroupRoute(teamId, routeId, negotiationId)

// 重新运行协商
rerunNegotiation(teamId, initiatorId): GroupNegotiationResult
```

---

## 🎨 前端 UI 流程

### 1️⃣ Start Hiking → Group 选项卡

```
┌─────────────────────────────────┐
│  Start Hiking                    │
├─────────────────────────────────┤
│ [Solo]  [Group]                 │
│         ↑                        │
│    已选择 Group                 │
├─────────────────────────────────┤
│                                 │
│ 我的团队:                       │
│ ┌─────────────────────────────┐ │
│ │ Team 1: Dragon Peak Club    │ │
│ │ 👥 3/5 成员  ⏳ 1 未完成   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [+ 创建新团队]  [加入团队]     │
│                                 │
└─────────────────────────────────┘
```

### 2️⃣ 创建团队模态框

```
┌──────────────────────────────────┐
│  Create New Team                 │
├──────────────────────────────────┤
│                                  │
│ Team Name:                       │
│ [______________________]         │
│                                  │
│ Description:                     │
│ [_____________________________]  │
│ [_____________________________]  │
│                                  │
│ Expected Team Size:              │
│ [2] 👥                           │
│                                  │
│ Visibility: [Public ▼]           │
│                                  │
│              [Cancel]  [Create]  │
└──────────────────────────────────┘

创建后显示:
┌──────────────────────────────────┐
│  ✅ Team Created!                │
│                                  │
│ Invitation Link:                 │
│ https://hikepal.com/join?code=  │
│ ABC123                           │
│                                  │
│ Share Code: ABC123               │
│                                  │
│ [Copy Link]  [Share]  [Close]   │
└──────────────────────────────────┘
```

### 3️⃣ 加入团队界面

```
┌────────────────────────────────────┐
│  Join a Team                       │
├────────────────────────────────────┤
│                                    │
│ Search or Enter Code:              │
│ [________________________]          │
│  (输入团队名或邀请码)              │
│                                    │
│ ─── Discover Teams ───             │
│ ┌──────────────────────┐           │
│ │ Team A: Mountain     │           │
│ │ 👥 4/6 🏆 Popular    │  [Join]  │
│ ├──────────────────────┤           │
│ │ Team B: Forest Trek  │           │
│ │ 👥 2/4               │  [Join]  │
│ ├──────────────────────┤           │
│ │ Team C: Peak Quest   │           │
│ │ 👥 3/3 Full          │           │
│ └──────────────────────┘           │
│                                    │
└────────────────────────────────────┘
```

### 4️⃣ 加入后 - PreferenceFilling 界面

```
┌──────────────────────────────────────┐
│  Team: Dragon Peak Club              │
│  👥 3/4 members  ⏳ 1 waiting        │
├──────────────────────────────────────┤
│                                      │
│ Team Members Status:                 │
│ ┌──────────────────────────────────┐ │
│ │ Leader: John          ✅ Completed│ │
│ │ Member: Sarah         ⏳ Pending  │ │
│ │ Member: Mike          ✅ Completed│ │
│ │ You (Alice)           ⏳ Pending  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ─── Your Preferences ───             │
│                                      │
│ Mood:      [Easy   ▼]               │
│ Difficulty: [Medium ▼]              │
│ Condition:                          │
│ [_____________________________]      │
│ [Quiet forest, good for photos]     │
│                                      │
│ Time: 300 min (5h)  [  ][  ]       │
│ Distance: 15 km     [  ][  ]       │
│                                      │
│ [Cancel]  [Save & Mark Complete]   │
│                                      │
│ ─── Social Negotiation ───           │
│ (仅队长可见)                         │
│ ⓘ 当所有成员完成后，队长可以点击:  │
│                                      │
│ [🤝 Social Negotiation] (启用中)    │
│                                      │
└──────────────────────────────────────┘
```

### 5️⃣ AI 综合分析结果

```
┌────────────────────────────────────┐
│  Social Negotiation Results        │
│  🔄 Analyzing group preferences... │ (加载中)
├────────────────────────────────────┤

完成后:

│ AI Analysis:                       │
│                                    │
│ 🎯 Synthesized Plan:              │
│ Mood: Peaceful + Scenic           │
│ Level: Medium                      │
│ Focus: Serene forest hike with    │
│        natural beauty, 3-4 hours  │
│                                    │
│ Considerations:                    │
│ • Accessible for all levels       │
│ • Scenic viewpoints for photos    │
│ • Suitable for group bonding      │
│ • Manageable time for everyone    │
│                                    │
├────────────────────────────────────┤
│ 📍 Recommended Routes:             │
│ (自动生成标题)                    │
│ "Serenity Seekers Hike (4 members)"│
│                                    │
│ ┌──────────────────────────────┐  │
│ │ Forest & Wildlife Trail 87%✨ │  │
│ │ 6.2 km | 2h | Difficulty 2/5 │  │
│ │ Segments: Forest, Wildlife...  │  │
│ │                    [Select]   │  │
│ ├──────────────────────────────┤  │
│ │ Shaded Mountain Walk     82% │  │
│ │ 5.8 km | 2.5h | Difficulty 2 │  │
│ │ Segments: Mountain, Ridge...  │  │
│ │                    [Select]   │  │
│ └──────────────────────────────┘  │
│                                    │
│ [Back]  [Re-analyze]              │
└────────────────────────────────────┘
```

### 6️⃣ 选择路线后 - 进入 CompanionView

```
用户点击 [Select] 后:

┌────────────────────────────────────┐
│  Dragon Peak Club - Hiking         │
│  🗺️  Serenity Seekers Hike        │
│      (4 members)                   │
├────────────────────────────────────┤
│                                    │
│ [完整地图显示合并的 segments]      │
│                                    │
│ 队伍信息:                         │
│ 👥 John, Sarah, Mike, Alice      │
│ Route: Forest & Wildlife Trail   │
│ Distance: 6.2 km | Time: 2h      │
│ Difficulty: 2/5                  │
│                                    │
│ [Start Recording]  [Chat]  [SOS] │
│                                    │
└────────────────────────────────────┘
```

---

## 🔄 完整工作流详解

### 场景：4 个朋友要一起爬山

**步骤 1: John（队长）创建团队**
```
John 点击 [+ Create New Team]
输入: Name: "Dragon Peak Club"
输入: Description: "Weekend mountain hiking adventure"
选择: Public, 4 人
点击: Create

系统返回:
- Team ID: team_123abc
- Invite Code: ABC123
- Invite Link: https://hikepal.com/join?code=ABC123
- John 自动成为 leader
```

**步骤 2: 分享链接给朋友**
```
John 复制链接发给：Sarah, Mike, Alice

Sarah 打开链接 → 自动重定向到 join 界面
Mike 搜索 "Dragon Peak Club" → 出现在 discover 中
Alice 输入邀请码 "ABC123" → 搜索找到
```

**步骤 3: 每个人填写偏好**
```
Sarah:
- Mood: Peaceful
- Difficulty: Easy
- Condition: "Want quiet forest, good photos"
- 点击 Save & Mark Complete

Mike:
- Mood: Adventurous  
- Difficulty: Medium
- Condition: "Like challenging terrain"
- 点击 Save & Mark Complete

Alice:
- Mood: Scenic
- Difficulty: Medium  
- Condition: "looking for good views"
- 点击 Save & Mark Complete

界面显示: ✅ 3/4 completed, ⏳ John waiting
```

**步骤 4: John 看到所有人都完成了，点击 "Social Negotiation"**
```
John 看到按钮已启用 [🤝 Social Negotiation]
点击按钮

系统:
1. 收集 4 个人的偏好:
   {
     Sarah: { mood: Peaceful, difficulty: Easy, ... },
     Mike: { mood: Adventurous, difficulty: Medium, ... },
     Alice: { mood: Scenic, difficulty: Medium, ... },
     John: { mood: Social, difficulty: Medium, ... }
   }

2. 发送给 Gemini AI:
   "Please synthesize: 4 members want to hike together.
    Member 1: Peaceful, easy, quiet forest...
    Member 2: Adventurous, medium, challenging...
    Member 3: Scenic, medium, good views...
    Member 4: Social, medium, group bonding...
    What is the best compromise?"

3. AI 返回:
   {
     "synthesizedMood": "Peaceful + Scenic",
     "synthesizedDifficulty": "medium",
     "synthesizedCondition": "A scenic, peaceful hike in forest with 
                              good photo spots, manageable for all levels",
     "analysis": "The group benefits from combining peaceful and scenic 
                 preferences while staying at medium difficulty that works 
                 for everyone...",
     "considerations": [
       "Allow time for photos",
       "Choose shaded forest paths",
       "Avoid overly crowded trails"
     ]
   }

4. 使用综合偏好去匹配 segments:
   findMatchingRoutes({
     mood: "Peaceful + Scenic",
     difficulty: "medium",
     condition: "scenic, peaceful hike in forest...",
     availableTime: 180 (平均值),
     maxDistance: 15 (最小值)
   })

5. 返回推荐的 routes:
   [
     { id: r1, name: "Forest & Wildlife Trail", score: 87, ... },
     { id: r2, name: "Shaded Mountain Walk", score: 82, ... },
     { id: r3, name: "Scenic Forest Loop", score: 79, ... },
     { id: r4, name: "Nature Trail", score: 75, ... },
     { id: r5, name: "Mountain Garden Path", score: 72, ... }
   ]

6. 生成标题:
   "Serenity Seekers Hike (4 members)"
```

**步骤 5: 所有队员看到推荐，选择一条路线**
```
UI 显示:
┌─────────────────────────────────┐
│ AI Analysis Results             │
│                                 │
│ Combined Preference:            │
│ Peaceful + Scenic               │
│ Difficulty: Medium              │
│ Time: ~3 hours                  │
│                                 │
│ Recommended Routes:             │
│ 1. Forest & Wildlife Trail 87%✨│
│   [Select]                      │
│ 2. Shaded Mountain Walk 82%    │
│   [Select]                      │
│ ...                             │
│                                 │
└─────────────────────────────────┘

任何人点击 [Select] → 选择路线

系统:
1. 保存选择到 team_negotiation_history
2. 合并 segments 坐标
3. 创建 hike_session
4. 跳转到 CompanionView
```

**步骤 6: 开始登山**
```
显示地图，所有队友可以看到：
- 完整的路线（所有 segments 合并）
- 4 个队友的实时位置
- 共享的 chat
- 紧急联系方式
```

---

## 💻 前端实现要点

### HomeView.tsx 修改

在 "Start Hiking" 选项卡中添加 Group 选项：

```tsx
const [selectedOption, setSelectedOption] = useState<'solo' | 'group'>('solo');

return (
  <div>
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setSelectedOption('solo')}
        className={selectedOption === 'solo' ? 'active' : ''}
      >
        Solo
      </button>
      <button
        onClick={() => setSelectedOption('group')}
        className={selectedOption === 'group' ? 'active' : ''}
      >
        Group
      </button>
    </div>

    {selectedOption === 'solo' && <SoloHikingView />}
    {selectedOption === 'group' && <GroupHikingView />}
  </div>
);
```

### 新组件：GroupHikingView.tsx

```tsx
import { useState, useEffect } from 'react';
import * as teamService from '../services/teamService';
import * as groupNegotiationService from '../services/groupNegotiationService';

export function GroupHikingView() {
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    loadMyTeams();
  }, []);

  async function loadMyTeams() {
    const teams = await teamService.getUserTeams();
    setMyTeams(teams);
  }

  return (
    <div>
      <h2>My Teams</h2>
      {myTeams.map((team) => (
        <TeamCard key={team.id} team={team} />
      ))}
      
      <button onClick={() => setShowCreateModal(true)}>
        + Create New Team  
      </button>
      
      <button onClick={() => setShowJoinModal(true)}>
        Join Team
      </button>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadMyTeams();
          }}
        />
      )}

      {showJoinModal && (
        <JoinTeamModal
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false);
            loadMyTeams();
          }}
        />
      )}
    </div>
  );
}
```

### PreferenceFilling 组件

```tsx
interface PreferenceFillingProps {
  teamId: string;
  onNavigate: (route: string) => void;
}

export function PreferenceFilling({ teamId, onNavigate }: PreferenceFillingProps) {
  const [team, setTeam] = useState<any>(null);
  const [mood, setMood] = useState('Easy');
  const [difficulty, setDifficulty] = useState('medium');
  const [condition, setCondition] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  async function loadTeam() {
    const teamData = await teamService.getTeamWithMembers(teamId);
    setTeam(teamData);
  }

  async function handleSavePreferences() {
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
  }

  async function handleSocialNegotiation() {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const result = await groupNegotiationService.performGroupNegotiation(
        teamId,
        user.user!.id
      );

      // 显示结果
      onNavigate('group-results', result);
    } catch (error) {
      console.error('Negotiation failed:', error);
    } finally {
      setLoading(false);
    }
  }

  const isLeader = team?.members?.some(
    (m: any) => m.role === 'leader' && m.user_id === user?.user?.id
  );

  const allCompleted = team?.completionPercentage === 100;

  return (
    <div>
      <h2>{team?.name}</h2>
      
      <h3>Team Members Status</h3>
      {team?.members?.map((member: any) => (
        <div key={member.id}>
          <span>{member.user_id}</span>
          {member.preferences_completed ? '✅' : '⏳'}
        </div>
      ))}
      
      <h3>Your Preferences</h3>
      <select value={mood} onChange={(e) => setMood(e.target.value)}>
        <option>Peaceful</option>
        <option>Adventurous</option>
        <option>Scenic</option>
        <option>Social</option>
      </select>
      
      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      
      <textarea
        value={condition}
        onChange={(e) => setCondition(e.target.value)}
        placeholder="Describe what you're looking for..."
      />
      
      <button onClick={handleSavePreferences}>
        Save & Mark Complete
      </button>

      {isLeader && allCompleted && (
        <button 
          onClick={handleSocialNegotiation}
          disabled={loading}
        >
          {loading ? '🔄 Analyzing...' : '🤝 Social Negotiation'}
        </button>
      )}
    </div>
  );
}
```

---

## ✅ 实现清单

- [ ] 执行 `group_hiking_database.sql` 创建表
- [ ] 集成 `teamService.ts` 和 `groupNegotiationService.ts`
- [ ] 创建 GroupHikingView 组件
- [ ] 创建 CreateTeamModal 组件
- [ ] 创建 JoinTeamModal 组件
- [ ] 创建 PreferenceFilling 组件
- [ ] 创建 GroupNegotiationResults 组件
- [ ] 修改 HomeView.tsx 添加 Group 选项
- [ ] 修改 PlanningView.tsx 支持 group mode
- [ ] 修改 CompanionView.tsx 显示团队信息
- [ ] 测试完整流程
- [ ] 优化 UI/UX

---

## 🧪 测试场景

### 场景 1: 3 人团队协商
```
Person A: Peaceful + Easy + "quiet"
Person B: Adventurous + Medium + "challenging"
Person C: Scenic + Medium + "photos"

期望结果: 综合为 "Peaceful + Scenic + Medium" 的路线
```

### 场景 2: 已有邀请码重复加入
```
User A 已加入 Team X
User A 再次使用邀请码加入 Team X

期望结果: 提示已是成员，跳回团队页
```

### 场景 3: 队长无法离开
```
Leader 尝试点击 "Leave Team"

期望结果: 提示需要先删除队伍
```

### 场景 4: 成员修改偏好后重新协商
```
协商完成后，Sarah 修改了偏好
队长点击 "Re-analyze"

期望结果: 使用新偏好重新执行 AI 分析
```

---

## 🎓 配置和自定义

### 修改 AI 提示词

在 `groupNegotiationService.ts` 中的 `constructNegotiationPrompt()` 函数修改 prompt 模板。

### 调整难度计算逻辑

在 `calculateAverageTime()` 和 `calculateAverageDistance()` 中修改如何计算平均值（当前是保守估计）。

### 自定义团队标题生成

在 `generateGroupTitle()` 中添加更多的 mood-title 映射。

---

## 📊 数据分析

保存的 `team_negotiation_history` 表可用于：

1. **用户偏好分析** - 了解什么类型的组合最受欢迎
2. **路线受欢迎度** - 哪些路线被团队最常选择
3. **AI 准确度** - 追踪用户是否满意 AI 的推荐
4. **团队协作** - 分析成员完成偏好的速度和倾向

---

**下一步**: 开始实现 UI 组件和前端集成！
