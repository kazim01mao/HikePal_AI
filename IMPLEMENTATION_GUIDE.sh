#!/usr/bin/env bash
# ============================================================================
# HikePal AI - Segment-Based Route System 实现指南
# ============================================================================

cat << 'EOF'

🏔️ HikePal AI - Segment-Based Route Recommendation System
==================================================================

## 📋 项目概述

你现在有一个完整的 segment-based routing 系统设计，用以替代当前的硬编码路由。

### 核心架构：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  用户输入: mood, difficulty, condition                     │
│           ↓                                                 │
│  AI 分析引擎 (segmentRoutingService.ts)                    │
│           ↓                                                 │
│  将用户输入转换为 search tags                              │
│  (Energetic → workout, slopes, adventure)                  │
│  (Peaceful → quiet, forest, shaded)                        │
│           ↓                                                 │
│  从数据库获取所有 segments 和 routes                       │
│           ↓                                                 │
│  对每条 route 的 tags 进行 Jaccard 相似度计算              │
│  (考虑难度、时间、距离等因素)                              │
│           ↓                                                 │
│  返回排序后的匹配列表 (按匹配分数 0-100)                   │
│           ↓                                                 │
│  用户选择 route → segments 组合成完整路线                  │
│           ↓                                                 │
│  保存这次搜索记录到 ai_route_matches 表                    │
│  (供 AI 模型学习用户偏好)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘


## 📦 创建的新文件

1️⃣ /database_schema.sql
   ├─ 8 个新数据库表
   ├─ GIS 索引和 GIN 索引
   ├─ RLS 政策
   ├─ 触发器用于自动更新聚合数据
   └─ 示例 segments 数据

2️⃣ /services/segmentRoutingService.ts
   ├─ userPreferencesToTags() - 用户偏好 → 搜索标签
   ├─ calculateTagSimilarity() - 标签相似度计算
   ├─ scoreRoute() - 路由评分算法
   ├─ findMatchingRoutes() - 主搜索函数
   ├─ createComposedRoute() - 创建新路由
   ├─ checkSegmentConnection() - 验证 segment 连接
   └─ mergeSegmentCoordinates() - 合并路线坐标

3️⃣ /SEGMENT_ROUTING_INTEGRATION.md
   └─ 详细的集成步骤和代码示例


## 🗄️ 数据库表结构（简化版）

segments (每条登山步道的片段)
├─ id, name, description, region
├─ difficulty (1-5), distance, duration_minutes
├─ elevation_gain, elevation_loss
├─ coordinates (完整的 [lat, lng] 数组)
├─ tags (["scenic", "forest", "beginner_friendly", ...])
├─ best_seasons, highlights
├─ is_published (发行状态)
└─ popularity_score

routes (完整的登山路线 - 可以由多个 segments 组成)
├─ id, name, description
├─ is_segment_based (TRUE 表示这个 route 由 segments 组成)
├─ total_distance, total_duration_minutes (聚合数据)
├─ total_elevation_gain, difficulty_level
├─ tags (所有 segments 的 tags 并集)
├─ is_published, is_template
└─ visibility (public/private/friends)

route_segments (关联表：定义 route 由哪些 segment 组成，什么顺序)
├─ route_id, segment_id
├─ segment_order (0, 1, 2, ...)
├─ is_connected (相邻 segments 是否连接)
└─ connection_distance (如果不连接，距离)

ai_route_matches (记录用户搜索历史，用于 AI 学习)
├─ user_id
├─ user_mood, user_difficulty, user_condition
├─ matched_routes (JSON: [{route_id, score, reason}, ...])
├─ top_route_id (用户最终选择的)
└─ created_at, used_at


## 🚀 实现步骤（按顺序）

### 第 1 步：数据库设置 (15 分钟)
────────────────────────────────
1. 打开 Supabase 控制台
2. 进入 SQL Editor
3. 复制 database_schema.sql 的内容
4. 执行 SQL
   ✓ 创建 8 个新表
   ✓ 创建索引和触发器
   ✓ 创建视图 (routes_with_segments)
   ✓ 创建 RLS 政策
   ✓ 插入示例 segment_tags

4.5. 验证表创建成功
   - 检查 Table list 中是否有新表
   - 运行简单的 SELECT 查询验证数据


### 第 2 步：导入 Segment 数据 (30 分钟)
──────────────────────────────────
Option A: 使用 database_schema.sql 中的示例数据
   - 已包含 4 个 Dragon's Back Trail segments
   - 运行 INSERT 语句

Option B: 自己创建 segments
   - 每条现有的 trail 分割成 3-5 个 segments
   - 每个 segment 需要：
     * 清晰的坐标数组
     * 5-10 个相关的 tags
     * difficulty 等级
     * 距离、时间、海拔等信息
   
   例子：
   ```sql
   INSERT INTO segments (name, description, region, difficulty, distance, ...) VALUES (
     'Stanley Peak South Ridge',
     'Scenic southern ridge with harbor views',
     'Hong Kong Island',
     2,
     3.5,
     ...
   );
   ```

Option C: 从现有 trailData.ts 迁移
   - 可以创建一个脚本，将现有 mock route data 转换为 segments
   - 使用 supabase.js client 批量插入


### 第 3 步：修改 PlanningView.tsx (1-2 小时)
────────────────────────────────────
1. 添加导入
   ```tsx
   import {
     findMatchingRoutes,
     UserHikingPreferences,
     RouteMatchScore,
     mergeSegmentCoordinates,
   } from '../services/segmentRoutingService';
   ```

2. 修改 state 结构
   - 用 aiSearchState 替换 aiMatched
   - 保存搜索结果、用户偏好等

3. 重写 handleAIRouteSearch()
   - 创建 UserHikingPreferences 对象
   - 调用 findMatchingRoutes()
   - 保存结果到 state

4. 替换 UI - 推荐路线列表
   - 用新的匹配卡片设计（显示匹配分数、原因等）
   - 显示 segment 预览

5. 添加 handleSelectRoute()
   - 从 routes_with_segments 视图获取完整数据
   - 合并 segments 坐标
   - 创建 hike_session 记录
   - 调用 onSelectRoute 回调

6. 测试
   - 选择不同的 mood/difficulty 组合
   - 验证推荐列表的变化


### 第 4 步：创建初始 Template Routes (30 分钟)
────────────────────────────────────────
使用 segmentRoutingService.createComposedRoute() 创建几条模板路线：

```typescript
await createComposedRoute({
  name: "Dragon's Back Classic",
  description: "The whole Dragon's Back Trail",
  segmentIds: ['seg1', 'seg2', 'seg3', 'seg4'], // 按顺序
  userId: ADMIN_USER_ID,
});
```

创建 3-5 条模板路线，覆盖不同的难度和风格：
- Dragon's Back Classic (moderate, scenic)
- Harbor View Easy Walk (easy, photo-friendly)
- Peak Challenge Route (hard, adventurous)
- Forest & Wildlife Trail (easy, peaceful)
- Sunrise Summit Route (hard, scenic)


### 第 5 步：测试和优化 (1-2 小时)
──────────────────────────────
1. 单元测试
   ```typescript
   // 测试 userPreferencesToTags
   const tags = userPreferencesToTags({
     mood: 'Peaceful',
     difficulty: 'easy',
     condition: 'want quiet forest'
   });
   // 应该包含 ["quiet", "forest", "shaded", "beginner_friendly", ...]
   
   // 测试 scoreRoute
   const score = scoreRoute(route, userPrefs, tags);
   // 返回 0-100 的分数
   ```

2. 集成测试
   - 在 PlanningView 中输入不同的用户偏好
   - 验证返回的路由排序和匹配分数
   - 确保坐标合并正确

3. 性能优化
   - 添加加载状态动画
   - 考虑缓存常见搜索
   - 可选：添加搜索去重


### 第 6 步：AI 学习（可选但推荐）
────────────────────────────────
1. 每次用户执行搜索时，保存到 ai_route_matches 表
2. 记录：
   - 用户输入 (mood, difficulty, condition)
   - 匹配结果列表
   - 用户最终选择的路线
3. 这些数据可以用来：
   - 改进标签匹配算法
   - 调整权重参数
   - 识别用户模式


## 🔧 关键配置和参数

路由评分算法权重（可调整）：
├─ 标签匹配度: 40 分
├─ 难度匹配度: 20 分
├─ 可用时间: 10 分
├─ 距离限制: 10 分
├─ 热门度: 10 分
└─ 基础分: 50 分 (最多 100 分)

用户偏好参数（可改改）：
├─ availableTime: 300 分钟 (5 小时)
├─ maxDistance: 20 km
└─ season: 当前季节（可选）


## 📊 示例：AI 匹配过程

用户输入：
├─ mood: "Peaceful"
├─ difficulty: "easy"
└─ condition: "Well-rested, want quiet forest and photography spots"

转换为搜索标签：
└─ ["quiet", "shaded", "forest", "beginner_friendly", "photo_spot", "scenic"]

数据库查询：
└─ 获取所有已发布的 routes 及其 segments

评分结果示例：
┌─────────────────────────────────────────────────────────┐
│ Route: Forest & Wildlife Trail         87% match ⭐⭐⭐⭐ │
│ Segments: [Forest Lower, Wildlife Loop, Old Stone Road] │
│ Match reasons:                                          │
│  ✓ 高标签匹配度 (83%)                                   │
│  ✓ 难度匹配                                             │
│  ✓ 时间充足                                             │
│ Total: 6.2 km | 2h | 200m elevation                     │
├─────────────────────────────────────────────────────────┤
│ Route: Harbor View Easy Walk             79% match ⭐⭐⭐  │
│ Segments: [Stanley Beach, Harbor Ridge, Repulse Bay]   │
│ Match reasons:                                          │
│  ✓ 标签匹配度 (75%)                                     │
│  ✓ 难度匹配                                             │
│ Total: 5.8 km | 2.5h | 180m elevation                   │
└─────────────────────────────────────────────────────────┘

用户选择 "Forest & Wildlife Trail"
→ 保存到 ai_route_matches
→ 开始出行
→ CompanionView 显示完整的路线（segments 合并的坐标）


## ✅ 检查清单

数据库操作：
☐ 执行 SQL 脚本创建表
☐ 验证表创建成功
☐ 导入 segment 数据
☐ 创建 template routes
☐ 验证 routes_with_segments 视图可查询

代码修改：
☐ 创建/更新 segmentRoutingService.ts
☐ 修改 PlanningView.tsx
☐ 更新 types.ts
☐ 修改 geminiService.ts（可选，用于增强 AI）

测试：
☐ 单元测试 AI 匹配函数
☐ 集成测试 PlanningView
☐ 验证坐标合并
☐ 测试不同用户偏好组合

优化：
☐ 添加加载状态
☐ 性能测试
☐ 缓存策略
☐ 错误处理


## 🆘 常见问题

Q: Segment 的 end_point 和下一个 segment 的 start_point 不相接怎么办？
A: 已有 checkSegmentConnection() 函数处理这个。如果距离 > 500m，记录 is_connected=false
   并保存 connection_distance，可以显示警告或在地图上绘制连接线。

Q: 如何处理用户自定义的 segment 组合？
A: createComposedRoute() 函数支持任意 segment 顺序。
   只需验证连接性，然后创建 route_segments 关联。

Q: 如何更新 AI 匹配算法的权重？
A: 在 scoreRoute() 函数中修改权重参数。
   根据用户搜索历史，可以通过机器学习调整最优权重。

Q: Segment tags 应该如何定义？
A: 使用 segment_tags 表中的标准化 tags。
   可以定义 4 个类别：
   - environment: scenic, forest, water_view, urban, coastal
   - terrain: rocky, steep, smooth
   - difficulty: beginner_friendly, adventurous
   - activity: photo_spot, workout, historic
   - atmosphere: quiet, scenic, crowded

Q: 如何处理季节性路线（如樱花、赏枫）？
A: 在 segments 表中使用 best_seasons 和 highlights 字段。
   在 userPreferencesToTags() 中根据当前季节添加相关 tags。


## 🚀 下一步优化方向

1. 机器学习集成
   - 使用用户搜索历史调整标签权重
   - 识别用户偏好模式

2. 社交功能
   - 用户可以创建和分享自己的 segment 组合
   - 评分系统

3. 高级功能
   - 天气感知推荐（根据当日天气调整）
   - 拥挤度预测（根据时间和季节）
   - 朋友排行（显示朋友完成过的路线）

4. 数据富化
   - 从用户轨迹学习 segment 特点
   - 动态更新 difficulty 评分
   - 实时天气和路况反馈


## 📞 需要帮助？

详细的代码示例见 SEGMENT_ROUTING_INTEGRATION.md

EOF

# ============================================================================
# 数据库 SQL 命令速查
# ============================================================================

echo "
═══════════════════════════════════════════════════════════════════
                        SQL 命令速查
═══════════════════════════════════════════════════════════════════

1️⃣ 查看所有 segments：
   SELECT id, name, region, difficulty, distance, tags FROM segments;

2️⃣ 查看所有 routes（包含 segments 数据）：
   SELECT * FROM routes_with_segments;

3️⃣ 查看具体 route 的 segments（按顺序）：
   SELECT s.name, rs.segment_order, s.difficulty, s.distance, s.tags
   FROM route_segments rs
   JOIN segments s ON rs.segment_id = s.id
   WHERE rs.route_id = 'YOUR_ROUTE_ID'
   ORDER BY rs.segment_order;

4️⃣ 查看用户搜索历史：
   SELECT * FROM ai_route_matches WHERE user_id = 'USER_ID' ORDER BY created_at DESC;

5️⃣ 添加新 segment：
   INSERT INTO segments (name, description, region, difficulty, distance, duration_minutes, elevation_gain, coordinate_geojson, tags, is_published)
   VALUES (
     'Segment Name',
     'Description',
     'Region',
     2,
     3.5,
     60,
     200,
     '{\"type\": \"LineString\", \"coordinates\": [[114.22, 22.22], ...]}',
     '[\"tag1\", \"tag2\"]',
     true
   );

6️⃣ 创建新 route：
   INSERT INTO routes (name, description, region, is_segment_based, created_by, is_published, is_template)
   VALUES ('Route Name', 'Description', 'Region', true, 'USER_ID', true, true);

7️⃣ 关联 segments 到 route：
   INSERT INTO route_segments (route_id, segment_id, segment_order, is_connected)
   VALUES
     ('ROUTE_ID', 'SEG_1', 0, true),
     ('ROUTE_ID', 'SEG_2', 1, true),
     ('ROUTE_ID', 'SEG_3', 2, true);

═══════════════════════════════════════════════════════════════════
"
