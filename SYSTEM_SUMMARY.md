# HikePal AI - Segment-Based Route System 📋 完整总结

## 你现在拥有的

### ✅ 已完成（后端设计和实现）

1. **数据库架构** (`database_schema.sql`)
   - 8 个精心设计的数据库表
   - 复杂的关系模型（segments → route_segments → routes）
   - PostGIS 地理索引和 JSONB 标签索引
   - 触发器自动更新聚合数据（路线总距离、总时间等）
   - RLS 政策确保数据安全
   - 20 个预设标签用于分类路线

2. **AI 匹配引擎** (`services/segmentRoutingService.ts`)
   - 完整的 TypeScript 实现（400+ 行代码）
   - 7 个导出函数和 6 个辅助函数
   - 用户偏好 → 搜索标签的自然语言处理
   - Jaccard 相似度算法计算标签匹配
   - 多因子评分系统 (40% 标签 + 20% 难度 + 20% 其他约束)
   - 地理坐标合并和 segment 连接验证

3. **集成文档** (`SEGMENT_ROUTING_INTEGRATION.md`)
   - 详细的集成步骤
   - 完整的代码模板（state 结构、函数实现、UI 组件）
   - 数据库迁移清单
   - 性能优化建议

### ⏳ 待完成（前端和数据）

| 任务 | 预计时间 | 难度 | 必要性 |
|------|----------|------|--------|
| 执行 SQL 创建表 | 5 分钟 | ⭐ | 🔴 必须 |
| 导入 Segment 数据 | 30 分钟 | ⭐⭐ | 🟡 重要 |
| 创建 Template Routes | 20 分钟 | ⭐⭐ | 🟡 重要 |
| 修改 PlanningView.tsx | 1-2 小时 | ⭐⭐⭐ | 🔴 必须 |
| 集成测试和优化 | 1-2 小时 | ⭐⭐⭐ | 🟡 重要 |

---

## 🏗️ 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户界面层                                  │
│                    (PlanningView.tsx)                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 输入表单: [Mood] [Difficulty] [Condition Input]             │   │
│  │ 按钮: [AI 推荐路线]                                          │   │
│  │ 结果显示: 匹配路由列表 (最多 5 条)                           │   │
│  │         - 路由名称 + 匹配分数                                │   │
│  │         - Segment 预览                                       │   │
│  │         - [选择] 按钮                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↑ ↓
                          (RPC JSON)
┌─────────────────────────────────────────────────────────────────────┐
│                       AI 匹配引擎层                                   │
│                (segmentRoutingService.ts)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. userPreferencesToTags()                                   │   │
│  │    输入: {mood, difficulty, condition}                       │   │
│  │    输出: ["tag1", "tag2", ...]                              │   │
│  │                                                              │   │
│  │ 2. findMatchingRoutes()                                      │   │
│  │    - 获取所有已发布的 routes (from DB)                       │   │
│  │    - 对每条 route 评分 (scoreRoute 函数)                     │   │
│  │    - 排序 + 返回前 5 条                                     │   │
│  │    输入: UserHikingPreferences                              │   │
│  │    输出: RouteMatchScore[] (排序)                           │   │
│  │                                                              │   │
│  │ 3. scoreRoute() - 多因子评分                                │   │
│  │    40% - 标签相似度 (Jaccard)                              │   │
│  │    20% - 难度匹配度                                         │   │
│  │    10% - 时间可用性                                         │   │
│  │    10% - 距离约束                                           │   │
│  │    5%  - 人气加成                                           │   │
│  │    基础: 50 分                                              │   │
│  │    最多: 100 分                                             │   │
│  │                                                              │   │
│  │ 4. mergeSegmentCoordinates()                               │   │
│  │    输入: segment coords 数组                                │   │
│  │    输出: 合并后的单一坐标数组                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↑ ↓
                              SQL
┌─────────────────────────────────────────────────────────────────────┐
│                         数据库层                                      │
│                    (Supabase PostgreSQL)                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ segments 表                 route_segments 表                │   │
│  │ ├─ id                        ├─ route_id                     │   │
│  │ ├─ name                      ├─ segment_id                   │   │
│  │ ├─ difficulty               ├─ segment_order                │   │
│  │ ├─ distance                 ├─ is_connected                │   │
│  │ ├─ duration_minutes         └─ connection_distance          │   │
│  │ ├─ elevation_gain/loss                                       │   │
│  │ ├─ coordinates (GeoJSON)    routes 表                        │   │
│  │ ├─ tags (JSON array)        ├─ id                          │   │
│  │ └─ is_published             ├─ name                        │   │
│  │                              ├─ is_segment_based            │   │
│  │ segment_tags 表             ├─ tags (聚合)                │   │
│  │ ├─ tag_id                   ├─ total_distance              │   │
│  │ ├─ name                     ├─ total_duration              │   │
│  │ ├─ category                 ├─ is_published                │   │
│  │ └─ emoji                    └─ is_template                 │   │
│  │                                                              │   │
│  │ ai_route_matches 表                                         │   │
│  │ ├─ user_id                                                 │   │
│  │ ├─ user_mood, user_difficulty, user_condition             │   │
│  │ ├─ matched_routes (JSON)                                   │   │
│  │ ├─ top_route_id (用户最终选择)                            │   │
│  │ └─ created_at, used_at (时间戳)                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 数据流示例

### 用户搜索流程

```
用户操作:
├─ 在 PlanningView 选择:
│  ├─ Mood: "Peaceful"
│  ├─ Difficulty: "Easy"
│  └─ Condition: "quiet forest with photos"
│
└─ 点击 [AI 推荐路线]

↓

系统处理:
├─ handleAIRouteSearch() 被调用
├─ 创建 UserHikingPreferences {
│    mood: "Peaceful",
│    difficulty: "easy",
│    condition: "quiet forest with photos",
│    availableTime: 300,
│    maxDistance: 20
│  }
├─ 调用 findMatchingRoutes(prefs)
│
├─ (在 segmentRoutingService 中)
│  ├─ userPreferencesToTags(prefs)
│  │  └─ 返回: ["quiet", "shaded", "forest", "photo_spot", "peaceful", "scenic"]
│  │
│  ├─ 查询 DB: SELECT * FROM routes WHERE is_published = true
│  │  └─ 返回: 15 条 routes
│  │
│  ├─ 对每条 route 执行 scoreRoute():
│  │  ├─ 计算标签相似度 (Jaccard)
│  │  ├─ 检查难度匹配
│  │  ├─ 检查时间约束
│  │  ├─ 检查距离约束
│  │  └─ 返回综合分数 (0-100)
│  │
│  └─ 排序所有 routes，返回前 5 条

↓

结果返回:
[
  {
    id: "route_123",
    name: "Forest & Wildlife Trail",
    score: 87,
    segments: [
      { name: "Forest Lower", distance: 2.1 },
      { name: "Wildlife Loop", distance: 1.5 }
    ]
  },
  {
    id: "route_456",
    name: "Shaded Mountain Walk",
    score: 82,
    segments: [...]
  },
  ...
]

↓

用户界面显示:
┌───────────────────────────────────────┐
│ 森林野生动物路线            87% ⭐⭐⭐⭐  │
│ 包含段落: Forest Lower, Wildlife Loop  │
│ 距离: 3.6 km | 时间: 1.5 h | 难度: 2/5 │
│              [选择此路线]               │
├───────────────────────────────────────┤
│ 遮荫山路                   82% ⭐⭐⭐⭐  │
│ 包含段落: ...                          │
│              [选择此路线]               │
└───────────────────────────────────────┘

↓

用户选择一条:
├─ handleSelectRoute("route_123")
├─ 从 routes_with_segments 视图获取完整数据
├─ mergeSegmentCoordinates([coordSet1, coordSet2])
├─ 返回合并后的坐标: [[114.2, 22.3], [114.21, 22.31], ...]
└─ 跳转到 CompanionView 显示地图 + 路线
```

---

## 🗂️ 文件清单

### 核心功能文件

```
HikePal_AI/
├── 📄 database_schema.sql
│   └─ 所有 SQL DDL 语句
│   ├─ CREATE TABLE (8 个)
│   ├─ CREATE INDEX (GIN, GiST)
│   ├─ CREATE VIEW (routes_with_segments)
│   ├─ CREATE TRIGGER (update_route_metadata)
│   ├─ INSERT segment_tags (20 条)
│   └─ INSERT example segments (4 条 Dragon's Back)
│
├── 📄 services/segmentRoutingService.ts
│   ├─ Type Definitions
│   │  ├─ Segment interface
│   │  ├─ ComposedRoute interface
│   │  ├─ UserHikingPreferences interface
│   │  └─ RouteMatchScore interface
│   │
│   └─ Functions
│      ├─ userPreferencesToTags()
│      ├─ calculateTagSimilarity()
│      ├─ scoreRoute()
│      ├─ findMatchingRoutes()
│      ├─ createComposedRoute()
│      ├─ checkSegmentConnection()
│      ├─ mergeSegmentCoordinates()
│      └─ haversineDistance()
│
├── 📄 components/PlanningView.tsx (需要修改)
│   ├─ handleAIRouteSearch() - 新实现
│   ├─ handleSelectRoute() - 新增
│   └─ UI - 替换推荐卡片
│
└── 📚 文档文件
    ├─ SEGMENT_ROUTING_INTEGRATION.md (集成指南)
    ├─ IMPLEMENTATION_CHECKLIST.md (进度追踪)
    ├─ QUICK_REFERENCE.md (快速查询)
    ├─ IMPLEMENTATION_GUIDE.sh (实现步骤)
    └─ SYSTEM_SUMMARY.md (本文件)
```

---

## 🎯 三个核心算法

### 1️⃣ 转换算法: userPreferencesToTags()

**目的**: 将用户的自然语言偏好转换为标准化的搜索标签

**输入**:
```typescript
{
  mood: "Peaceful",          // 心情
  difficulty: "easy",        // 难度
  condition: "quiet forest", // 具体条件文本
  availableTime: 300,        // 分钟
  maxDistance: 20            // 公里
}
```

**内部处理**:
```
Step 1: 心情 → 标签
  "Peaceful" → lookup_table["Peaceful"] 
            → ["quiet", "peaceful", "shaded", "scenic"]

Step 2: 难度 → 标签
  "easy" → lookup_table["easy"]
        → ["beginner_friendly", "family_friendly", "smooth"]

Step 3: 条件文本 → 关键词 → 标签
  "quiet forest" 
  → 正则表达式匹配关键词 ["quiet", "forest"]
  → 查表: ["quiet" → [quiet, peaceful, shaded]]
         ["forest" → [forest, nature, trees]]
  → 合并: [quiet, peaceful, shaded, forest, nature, trees]

Step 4: 去重并排序
  ["quiet", "shaded", "forest", "peaceful", "scenic", ...]
```

**输出**:
```typescript
["quiet", "shaded", "forest", "peaceful", "scenic", "beginner_friendly"]
```

---

### 2️⃣ 相似度算法: calculateTagSimilarity()

**目的**: 计算用户标签和路线标签的匹配度（0-1）

**公式** - Jaccard 相似度系数:
```
J(A, B) = |A ∩ B| / |A ∪ B|
        = (交集大小) / (并集大小)
```

**例子**:
```
用户标签:    ["quiet", "shaded", "forest", "scenic"]
路线标签:    ["forest", "scenic", "beginner_friendly", "photo_spot"]

交集:        ["forest", "scenic"]              (2 个)
并集:        ["quiet", "shaded", "forest", "scenic", 
              "beginner_friendly", "photo_spot"]  (6 个)

相似度 = 2/6 = 0.333 = 33.3%
```

**代码实现**:
```typescript
const userSet = new Set(userTags);
const routeSet = new Set(routeTags);

const intersection = [...userSet].filter(t => routeSet.has(t));
const union = new Set([...userSet, ...routeSet]);

const similarity = intersection.length / union.size;  // 0-1
```

---

### 3️⃣ 评分算法: scoreRoute()

**目的**: 综合多个因素计算路线的匹配度（0-100）

**计算步骤**:

```
Step 1: 计算标签相似度
  similarity = calculateTagSimilarity(userTags, routeTags)  // 0-1
  tagScore = similarity * 100  // 0-100 分

Step 2: 计算难度匹配度
  userDiff = 2 (用户选择 easy)
  routeDiff = 2 (路线难度)
  diffMatchBonus = (routeDiff == userDiff) ? 20 : 
                   (abs(routeDiff - userDiff) == 1) ? 10 : 0

Step 3: 检查时间约束
  routeDuration = 120 分钟
  availableTime = 300 分钟
  timeBonus = (routeDuration <= availableTime) ? 10 : 0

Step 4: 检查距离约束
  routeDistance = 5.2 km
  maxDistance = 20 km
  distanceBonus = (routeDistance <= maxDistance) ? 10 : 0

Step 5: 人气加成
  popularityScore = min(route.popularity, 100)  // 0-100
  popularityBonus = popularityScore * 0.05  // 最多 5 分

Step 6: 综合计算
  baseScore = 50  // 基础分
  weights = {
    tagSimilarity: 0.40,
    difficultyMatch: 0.20,
    timeAvailable: 0.10,
    distanceMatch: 0.10,
    popularityBonus: 0.05,
  }
  
  finalScore = (baseScore 
                + tagScore * weights.tagSimilarity
                + diffMatchBonus
                + timeBonus
                + distanceBonus
                + popularityBonus)
  
  finalScore = max(0, min(100, finalScore))  // 限制在 0-100
```

**输出**: 0-100 的分数

---

## 📈 系统性能指标

| 指标 | 目标 | 备注 |
|------|------|------|
| 搜索响应时间 | < 1 秒 | SQL 查询 + 循环评分 |
| 支持路由数量 | 100+ | GIN 索引优化标签搜索 |
| 标签匹配准确度 | > 80% | Jaccard 系数可靠 |
| 用户体验评分 | > 4.0/5 | 推荐列表清晰 |
| 服务器占用 | 低 | 所有计算在客户端 + DB |

---

## 🔐 数据安全

### RLS (Row Level Security) 政策

```
┌─ segments 表
│  ├─ SELECT: 公开（所有用户可读）
│  ├─ INSERT: 仅所有者或管理员
│  └─ UPDATE: 仅所有者
│
├─ routes 表
│  ├─ SELECT: 根据 visibility 字段
│  │         - public: 所有用户
│  │         - friends: 仅朋友
│  │         - private: 仅所有者
│  ├─ INSERT: 认证用户
│  └─ UPDATE: 仅所有者
│
└─ ai_route_matches 表
   ├─ SELECT: 仅本用户的搜索历史
   ├─ INSERT: 仅本用户
   └─ UPDATE: 仅本用户
```

---

## 🚀 生产部署清单

- [ ] 数据库备份策略
- [ ] 定期导出 ai_route_matches 数据用于 ML 训练
- [ ] 监控搜索性能（添加日志）
- [ ] 设置告警（无匹配结果的查询）
- [ ] 定期审计 RLS 政策
- [ ] 版本控制所有 SQL 迁移脚本
- [ ] 用户反馈循环（特别是推荐准确度）

---

## 🎓 学习资源链接

- PostGIS 索引: https://postgis.net/docs/using_postgis_dbmanagement.html#GiST-Indexes
- JSONB 查询: https://www.postgresql.org/docs/current/datatype-json.html
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Jaccard 相似度: https://en.wikipedia.org/wiki/Jaccard_index
- TypeScript 最佳实践: https://www.typescriptlang.org/docs/handbook/

---

## 📝 版本历史

```
v1.0 - Segment-Based Routing System
├─ 数据库架构完成 ✅
├─ AI 匹配引擎完成 ✅
├─ 文档完成 ✅
└─ 前端集成 ⏳ (待开发)

v1.1 - 已规划功能
├─ 机器学习模型微调权重
├─ 社交功能（分享路线）
├─ 历史记录和书签
└─ 天气感知推荐

v2.0 - 远期功能
├─ 用户生成的 segments
├─ 协作路线规划
├─ AR 导航支持
└─ 离线地图同步
```

---

## 💡 关键设计决策

### 为什么选择 Segments？

| 方案 | 优点 | 缺点 | 决定 |
|------|------|------|------|
| **Segment 模型** ✅ | 灵活组合、易维护、易扩展 | 初始设置复杂 | ✅ 采用 |
| 单体 Routes | 简单快速 | 不灵活、冗余数据 | ✗ |
| GraphQL + 网络 | 强大查询 | 过度设计 | ✗ |

### 为什么用 Jaccard 相似度？

- **简洁**: 公式简单，易解释
- **快速**: O(n) 时间复杂度
- **可靠**: 对标签集合匹配效果好
- **扩展**: 可与其他相似度算法组合

### 为什么在客户端评分而不是数据库？

- **灵活**: 可快速调节权重无需迁移
- **性能**: 减少网络往返
- **隐私**: 权重算法在浏览器中，不暴露用户数据
- **A/B 测试**: 容易同时测试不同权重

---

## 🆘 故障排除快速指南

### 场景 1: "找不到任何匹配的路由"

**检查清单**:
```sql
-- 1. 检查是否有发布的路由
SELECT COUNT(*) FROM routes WHERE is_published = true;

-- 2. 检查路由是否有 segments
SELECT r.name, COUNT(s.id) as segment_count
FROM routes r
LEFT JOIN route_segments rs ON r.id = rs.route_id
LEFT JOIN segments s ON rs.segment_id = s.id
WHERE r.is_published = true
GROUP BY r.id
HAVING COUNT(s.id) = 0;  -- 找出没有 segments 的路由

-- 3. 检查 segments 是否有 tags
SELECT COUNT(*) FROM segments WHERE tags IS NULL OR tags = '[]'::jsonb;
```

### 场景 2: "推荐分数都很低 (< 50%)"

**调试步骤**:
```typescript
// 1. 检查用户标签转换是否正确
const userTags = userPreferencesToTags({
  mood: "Peaceful",
  difficulty: "easy",
  condition: "quiet forest"
});
console.log('生成的用户标签:', userTags);

// 2. 检查数据库中路由的标签
// 在 Supabase 中查询:
SELECT name, tags FROM routes LIMIT 5;

// 3. 手动计算一个相似度
// 看是否匹配良好

// 4. 如果相似度正确但总分数低，
// 检查其他因素 (难度、时间、距离)
```

### 场景 3: 性能缓慢

**性能优化**:
```typescript
// 1. 添加缓存
const resultCache = new Map();

// 2. 使用 memoization
const memoizedScoreRoute = memoize(scoreRoute);

// 3. 数据库查询优化
// 添加索引:
CREATE INDEX idx_routes_published ON routes(is_published);

// 4. 减少返回的路由数
// 只评分前 100 条，而不是所有
```

---

## 📊 成功指标

项目算成功的标志:

1. ✅ PlanningView 能正确调用 AI 搜索
2. ✅ 返回的路由与用户输入相关（> 70% 匹配度）
3. ✅ 搜索响应时间 < 1 秒
4. ✅ 用户能选择路由并跳转到 CompanionView
5. ✅ 坐标合并正确，地图显示完整路线
6. ✅ 数据库记录搜索历史供 AI 学习

---

**下一步**: 按照 IMPLEMENTATION_CHECKLIST.md 中的顺序，逐步执行每个阶段。

祝你成功! 🎉
