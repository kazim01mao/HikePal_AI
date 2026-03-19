# 🏔️ Group Hiking System - 系统设计文档

## 📐 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户界面层                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │HomeView  │  │GroupHiking│  │Preference │  │CompanionView │   │
│  │(Start   │  │View       │  │Filling    │  │(Group Mode)│   │
│  │Hiking)  │  │(Teams)    │  │(Input)    │  │(Tracking)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                          ↓ ↑
                    React State & Props
                          ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                       Service 层                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐   │
│  │ teamService.ts     │  │ groupNegotiationService.ts       │   │
│  │                    │  │                                  │   │
│  │ • createTeam()     │  │ • performGroupNegotiation()   │   │
│  │ • joinTeamByCode() │  │ • synthesizePreferencesWithAI()│   │
│  │ • searchTeams()    │  │ • selectGroupRoute()           │   │
│  │ • discoverTeams()  │  │ • rerunNegotiation()           │   │
│  │ • updatePref()     │  │ • parseAIResponse()            │   │
│  │ • isTeamLeader()   │  │                                  │   │
│  │ • isTeamMember()   │  │                                  │   │
│  │ • getAllTeamps()   │  │                                  │   │
│  │                    │  │                                  │   │
│  └────────────────────┘  └──────────────────────────────────┘   │
│                                                                   │
│  ┌────────────────────┐  ┌──────────────────────────────────┐   │
│  │segmentRoutingService│  │  geminiService.ts              │   │
│  │                    │  │                                  │   │
│  │ • findMatching()   │  │ • callGeminiAPI()              │   │
│  │ • scoreRoute()     │  │                                  │   │
│  │ • userPrefsToTags()│  │ (用于 AI 综合分析)             │   │
│  │                    │  │                                  │   │
│  └────────────────────┘  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          ↓ ↑
                      Supabase RPC
                          ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                    数据库层 (PostgreSQL)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ teams          team_members      team_negotiation_       │   │
│  │ ┌────────────┐ ┌──────────────┐  history               │   │
│  │ │ id         │ │ id           │ ┌──────────────────┐    │   │
│  │ │ name       │ │ team_id      │ │ id               │    │   │
│  │ │ invite_code│ │ user_id      │ │ team_id          │    │   │
│  │ │ created_by │ │ role         │ │ initiated_by      │    │   │
│  │ │ is_public  │ │ preferences_*│ │ member_prefs     │    │   │
│  │ │ status     │ │ user_*       │ │ ai_analysis      │    │   │
│  │ │ created_at │ │ joined_at    │ │ synthesized_*    │    │   │
│  │ └────────────┘ └──────────────┘ │ recommended_*    │    │   │
│  │                                 │ created_at       │    │   │
│  │ team_generated_routes table      └──────────────────┘    │   │
│  │ ┌────────────────────────────────────────────────┐      │   │
│  │ │ id, team_id, synthetic_query, routes,         │      │   │
│  │ │ auto_generated_title, selected_route_id       │      │   │
│  │ └────────────────────────────────────────────────┘      │   │
│  │                                                          │   │
│  │ segments, routes, route_segments (existing)            │   │
│  │ (用于路由推荐)                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

                External APIs
                ├─ Google Gemini API (AI 分析)
                ├─ Supabase Auth (用户认证)
                └─ PostGIS (地理数据)
```

---

## 🔄 完整数据流

### 流程 1: 创建团队和邀请

```
用户点击 [Create Team]
        ↓
[填写表单] 
        ↓
API: teamService.createTeam()
        ↓
INSERT into teams:
  ✓ 生成 invite_code (6位随机码)
  ✓ 生成 invite_link (完整URL)
  ✓ 设置 created_by = current_user
  ✓ 设置 is_public = true/false
        ↓
INSERT into team_members:
  ✓ 将创建者加入为 leader
        ↓
返回 Team + invite_link
        ↓
[显示邀请链接] → 用户分享给朋友
```

### 流程 2: 用户加入团队

```
方式 A: 点击邀请链接
   https://hikepal.com/join?code=ABC123
        ↓
   解析 code 参数
        ↓
   API: teamService.joinTeamByCode('ABC123')
        ↓
   SELECT * FROM teams WHERE invite_code = 'ABC123'
        ↓
   INSERT into team_members:
     ✓ team_id, user_id, role = 'member'
        ↓
   检查是否已是成员 → 如果是则返回现有成员

方式 B: 搜索团队名
   用户在搜索框输入 "Dragon Peak Club"
        ↓
   API: teamService.searchPublicTeams('Dragon Peak Club')
        ↓
   SELECT * FROM teams WHERE 
     is_public = true AND 
     (invite_code LIKE 'DRAGON%' OR name ILIKE '%dragon%')
        ↓
   显示搜索结果
        ↓
   用户点击 [Join]
        ↓
   同方式 A 的 INSERT into team_members

方式 C: Discover 公开团队
   API: teamService.discoverPublicTeams(20)
        ↓
   SELECT * FROM teams_with_members 
   WHERE is_public = true
   ORDER BY created_at DESC
   LIMIT 20
        ↓
   显示最新的 20 个公开团队
        ↓
   用户选择点击 [Join]
        ↓
   同方式 A 的插入
```

### 流程 3: 填写个人偏好

```
用户进入 PreferenceFilling 界面
        ↓
显示:
  ✓ 队伍名称和成员列表
  ✓ 每个成员的完成状态 (✅/⏳)
  ✓ 当前用户的输入表单 (mood, difficulty, condition)
        ↓
用户填写偏好:
  • mood: 选择心情 (Peaceful, Adventurous, Scenic, Social)
  • difficulty: 选择难度 (Easy, Medium, Hard)
  • condition: 输入具体需求 (文本)
  • availableTime: 设置可用时间 (默认 300 分钟)
  • maxDistance: 设置最大距离 (默认 20 km)
        ↓
点击 [Save & Mark Complete]
        ↓
API: teamService.updateMemberPreferences(...)
        ↓
UPDATE team_members SET:
  ✓ user_mood = 'Peaceful'
  ✓ user_difficulty = 'easy'
  ✓ user_condition = '...'
  ✓ user_preferences = JSON: {mood, difficulty, ...}
  ✓ preferences_completed = true
  ✓ preferences_completed_at = NOW()
        ↓
界面刷新:
  ✓ 当前用户状态变为 ✅
  ✓ UI 显示「已完成」
  ✓ 如果是队长且所有人都完成，启用 [Social Negotiation] 按钮
```

### 流程 4: Social Negotiation (核心逻辑)

```
队长点击 [🤝 Social Negotiation]
        ↓
API: groupNegotiationService.performGroupNegotiation(teamId, leaderId)
        ↓
[验证] 检查:
  ✓ leaderId 是否是团队的 leader
  ✓ 所有成员是否都完成了偏好
        ↓
[数据收集]
API: teamService.getAllMemberPreferences(teamId)
        ↓
SELECT * FROM team_members WHERE team_id = teamId
        ↓
返回数组: [
  { userId, mood, difficulty, condition, availableTime, maxDistance },
  { userId, mood, difficulty, condition, availableTime, maxDistance },
  ...
]
        ↓
[AI 分析]
构建 Gemini Prompt:

"You are a hiking tour guide. Synthesize these group preferences:
 Member 1: Peaceful, Easy, 'quiet forest'
 Member 2: Adventurous, Medium, 'challenging'
 Member 3: Scenic, Medium, 'photos'
 Member 4: Social, Medium, 'group bonding'
 
 Return JSON: {
   synthesizedMood, synthesizedDifficulty, synthesizedCondition,
   analysis, considerations
 }"
        ↓
API: callGeminiAPI(prompt)
        ↓
Gemini 返回:
{
  "synthesizedMood": "Peaceful + Scenic",
  "synthesizedDifficulty": "medium",
  "synthesizedCondition": "Forest hike with scenic views, manageable for all",
  "analysis": "Combines peaceful and scenic preferences...",
  "considerations": ["Allow time for photos", "Choose shaded paths"]
}
        ↓
[解析响应]
parseAIResponse() → 提取 JSON，验证必需字段
        ↓
[计算约束值]
  ✓ availableTime = MIN(所有人的时间) or AVG(最保守)
  ✓ maxDistance = MIN(所有人的距离) (最严格)
        ↓
[路由匹配]
API: findMatchingRoutes({
  mood: "Peaceful + Scenic",
  difficulty: "medium",
  condition: "Forest hike...",
  availableTime: 180,
  maxDistance: 15
})
        ↓
内部处理:
  1. userPreferencesToTags() 
     → ["quiet", "forest", "scenic", "peaceful", ...]
  
  2. SELECT * FROM routes WHERE is_published = true
  
  3. 对每条 route 评分:
     - 标签相似度 (40%)
     - 难度匹配 (20%)
     - 时间约束 (10%)
     - 距离约束 (10%)
     - 热度 (5%)
  
  4. 排序并返回前 5 条:
     [
       { id, name, score: 87, matchReasons: [...] },
       { id, name, score: 82, matchReasons: [...] },
       ...
     ]
        ↓
[生成标题]
generateGroupTitle(mood, memberCount)
  → "Serenity Seekers Hike (4 members)"
        ↓
[保存结果]
INSERT into team_negotiation_history:
  ✓ team_id, initiated_by
  ✓ member_preferences (完整的输入数据)
  ✓ ai_analysis (AI 的分析)
  ✓ synthesized_mood, synthesized_difficulty, synthesized_condition
  ✓ recommended_routes (前 5 条的完整数据)
        ↓
INSERT into team_generated_routes:
  ✓ synthetic_query, routes, auto_generated_title
        ↓
UPDATE teams SET:
  ✓ hiking_mood = synthesized_mood
  ✓ hiking_difficulty = synthesized_difficulty
  ✓ hiking_preferences = {condition, considerations}
  ✓ negotiation_completed = true
        ↓
返回 GroupNegotiationResult:
{
  teamId, memberCount,
  synthesizedPreferences: {mood, difficulty, condition, ...},
  recommendedRoutes: [...],
  autoGeneratedTitle: "...",
  negotiationId: "..."
}
        ↓
[前端显示结果]
✓ 显示 AI 分析内容
✓ 显示推荐的 5 条路线（按分数排序）
✓ 每条路线显示卡片: name, score, segments, [Select]
```

### 流程 5: 选择路由

```
用户在推荐列表中点击 [Select]
        ↓
用户选择 "Forest & Wildlife Trail"
        ↓
API: groupNegotiationService.selectGroupRoute(
  teamId, 
  routeId, 
  negotiationId
)
        ↓
[保存选择]
UPDATE team_negotiation_history SET:
  ✓ selected_route_id = routeId
        ↓
UPDATE teams SET:
  ✓ status = 'hiking'
        ↓
[准备数据]
获取完整的路线数据:
  SELECT * FROM routes_with_segments 
  WHERE id = routeId
        ↓
获取所有 segments 的坐标:
  合并成单一的 LineString
  [114.2, 22.3], [114.21, 22.31], ...
        ↓
[创建 Hike Session]
INSERT into hike_sessions (可选):
  ✓ team_id, route_id, team_members: [...]
  ✓ status = 'started'
        ↓
[跳转到 CompanionView]
传递数据:
  ✓ 合并后的坐标
  ✓ 路线信息
  ✓ 队伍信息（所有成员）
  ✓ 自动生成的标题
        ↓
CompanionView 显示:
  ✓ 地图（显示完整的合并路线）
  ✓ 队伍成员列表（实时位置）
  ✓ 聊天功能
  ✓ 紧急按钮
  ✓ 进度条
```

---

## 🎯 关键设计决策

### 1. 邀请码设计

**选择**: 6 位随机大写字母 + 数字 (e.g., ABC123)

**原因**:
- 足够短以便记忆和手动输入
- 足够长以避免碰撞 (36^6 ≈ 2.1B 种组合)
- 易于搜索
- URL 友好

**替代方案考虑**:
- UUID: 太长，难以分享
- 短数字码 (0000-9999): 容易冲突
- 人类可读的短语 (e.g., "horse-apple-tree"): 太长

### 2. 成员偏好综合策略

**AI 驱动** vs **算法驱动**

选择 **AI 驱动** 原因:
- AI 能理解背景和妥协
- 可以产生自然语言的解释
- 对复杂的多人偏好冲突更灵活
- 提供了"社交协商"的感觉 ✨

**缺点**: 需要 API 调用（成本、延迟）
**优化**: 可以缓存相同的偏好组合

### 3. 时间和距离的计算

**保守策略**: 使用最小值

```typescript
availableTime = MIN(所有人的时间)  // 最严格
maxDistance = MIN(所有人的距离)
```

**原因**: 确保所有人都能完成，无人掉队

**替代**:
- 平均值: 有人可能跟不上
- 中位数: 折中方案
- 宽松: 可能太困难

### 4. 路由推荐数量

**选择**: 前 5 条

**原因**:
- 足够多: 给用户选择
- 足够少: 避免信息过载
- 与 Solo 模式一致

### 5. 队长权限

**队长可以**:
- 创建团队
- 启动 Social Negotiation
- 查看所有成员的偏好
- 删除团队

**队长不能**:
- 离开团队（必须删除）
- 强制编辑成员偏好
- 跳过协商直接选择路线

### 6. 修改偏好后是否重新协商?

**当前设计**: 支持手动重新运行

```
API: groupNegotiationService.rerunNegotiation(teamId, leaderId)
```

事件:
- 某成员修改偏好后 → optional: 自动提醒队长
- 队长可选择是否重新分析

---

## 📊 数据一致性和验证

### 数据验证规则

```typescript
// Teams 验证
✓ name 长度 1-255
✓ team_size >= 1, <= 50
✓ status 必须是: planning | hiking | completed
✓ created_by 必须有效的 user_id

// Team Members 验证  
✓ role 必须是: leader | member
✓ 每个 team 只能有 1 个 leader (通过应用逻辑)
✓ user_preferences 必须是有效的 JSON
✓ preferences_completed_at >= joined_at

// Team Negotiation History 验证
✓ member_count > 0
✓ synthesized_difficulty in ['easy', 'medium', 'hard']
✓ recommended_routes 长度 > 0
```

### 数据库约束

```sql
-- 唯一性
UNIQUE(teams.invite_code)
UNIQUE(team_members.team_id, team_members.user_id)

-- 外键级联
team_members.team_id -> teams(id) ON DELETE CASCADE
(成员级联删除)

-- 检查约束
CHECK(team_size >= 1)
CHECK(LENGTH(invite_code) = 6)
CHECK(status IN ('planning', 'hiking', 'completed'))
```

---

## 🔒 安全性考虑

### RLS 政策

```sql
-- Teams: 公开的任意人可读，创建者可修改
CREATE POLICY teams_public_read 
  ON teams FOR SELECT 
  USING (is_public = true);

CREATE POLICY teams_creator_all 
  ON teams FOR ALL 
  USING (created_by = auth.uid());

-- Team Members: 仅团队成员可读自己的数据
CREATE POLICY team_members_view 
  ON team_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm2 
      WHERE tm2.team_id = team_members.team_id 
      AND tm2.user_id = auth.uid()
    )
  );

-- 用户只能编辑自己的偏好
CREATE POLICY team_members_update_own 
  ON team_members FOR UPDATE 
  USING (user_id = auth.uid());
```

### 隐私保护

1. **邀请码**: 短但具有足够熵，无法被暴力破解
2. **偏好数据**: 仅团队成员可见
3. **AI 分析**: 不存储原始回话，仅保存结果
4. **坐标数据**: 仅在 hiking 状态显示，防止泄露

---

## 🚀 可扩展性设计

### 大规模场景

**如果有 1000 个团队同时协商?**

1. **缓存 AI 响应**: 相同的偏好组合缓存
2. **队列系统**: 使用 job queue (Supabase Functions)
3. **异步处理**: AI 调用不阻塞 UI
4. **速率限制**: 避免 Gemini API 超额

### 团队规模限制

当前: max_team_size = 50 人

**考虑**:
- 超过 20 人: 可能需要分小组先协商
- 超过 50 人: 建议创建多个团队

---

## 📈 产品指标

### 核心指标

1. **采用率**: 多少用户尝试过 Group 模式?
2. **完成率**: 多少团队完成了完整的协商流程?
3. **满意度**: 用户对 AI 推荐的满意度是多少?
4. **重复率**: 多少用户再次使用 Group 功能?

### 数据收集

```sql
-- 团队创建趋势
SELECT DATE(created_at), COUNT(*) as count
FROM teams
GROUP BY DATE(created_at)
ORDER BY DATE ASC;

-- 协商完成情况
SELECT 
  COUNT(CASE WHEN negotiation_completed THEN 1 END) as completed,
  COUNT(*) as total
FROM teams;

-- 最受欢迎的综合需求
SELECT 
  synthesized_mood,
  synthesized_difficulty,
  COUNT(*) as count
FROM team_negotiation_history
GROUP BY synthesized_mood, synthesized_difficulty
ORDER BY count DESC;

-- 选择率 (推荐的路线中有多少被选择)
SELECT 
  selected_route_id,
  COUNT(*) as times_selected
FROM team_negotiation_history
GROUP BY selected_route_id
ORDER BY times_selected DESC;
```

---

## 🔄 迭代和改进方向

### Phase 1 (当前)
- ✅ 基础团队管理
- ✅ AI 综合分析
- ✅ 路由推荐

### Phase 2 (下一步)
- [ ] 队伍聊天 (在 PreferenceFilling 中)
- [ ] 便宜的预计算路由 (缓存常见偏好组合)
- [ ] 队伍历史和回顾

### Phase 3 (长期)
- [ ] 多轮协商 (回合制讨论)
- [ ] 子团队分组 (大型团队自动分组)
- [ ] 社交功能 (团队排行榜、成就)
- [ ] 离线协商 (无网络时的 AI 近似)

---

## 参考: 类似产品

| 产品 | 团队功能 | AI 用法 | 学习点 |
|------|--------|---------|-------|
| Meetup.com | ✅ 事件创建和加入 | ❌ 无 | 邀请码和发现 UX |
| Outdoorsy | ✅ 行程分享 | ❌ 无 | 社交验证 |
| AllTrails | ✅ 列表共享 | ✅ AI 推荐 | 评分和社交 |
| **HikePal** | ✅ 协商驱动 | ✅ AI 综合 | 独特的社交 + AI |

---

**这个设计提供了一个强大、灵活、可扩展的 Group Hiking 系统！**
