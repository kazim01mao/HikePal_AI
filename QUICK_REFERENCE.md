# HikePal AI Segment-Based Routing - 快速参考 🚀

## 核心概念速理解

```
Segment   = 一条登山步道的一个小片段 (例: "龙脊南段")
           包含: 坐标、难度、距离、tags
           
Route     = 一条完整的登山路线 (例: "龙脊经典路线")
           由多个 Segments 按顺序组成
           系统可自动聚合所有 segments 的数据
           
AI Match  = 用户说 "我想要安静的森林路线" 
           → 系统转换为 tags ["quiet", "forest", "shaded"]
           → 搜索所有 routes，看哪条的 tags 最匹配
           → 返回排序后的推荐列表
```

---

## 🗂️ 文件导航

| 文件 | 用途 | 修改权限 |
|------|------|---------|
| `/database_schema.sql` | 创建所有数据库表 | ✅ 一次性执行 |
| `/services/segmentRoutingService.ts` | AI 匹配引擎 | ⚠️ 只改参数 |
| `/components/PlanningView.tsx` | 前端集成 | ✅ 需要重写 |
| `/SEGMENT_ROUTING_INTEGRATION.md` | 集成指南 | 📖 参考文档 |
| `/IMPLEMENTATION_CHECKLIST.md` | 进度追踪 | ✅ 逐步完成 |

---

## 🆘 我需要快速做什么？

### 我想立即测试这个系统

```bash
# 1. 打开 Supabase 控制台
#    go to SQL Editor

# 2. 复制粘贴 database_schema.sql 的内容，执行
#    (创建表需要 1 分钟)

# 3. 验证表创建成功
#    SELECT * FROM segment_tags LIMIT 5;
#    (应该看到 20 个预设 tags)

# 4. 查看示例数据
#    SELECT name, difficulty, distance FROM segments;
#    (应该看到 4 个 Dragon's Back segments)
```

**耗时**: 5 分钟 ⏱️

---

### 我想修改 PlanningView.tsx

```typescript
// 步骤 1: 添加导入
import {
  findMatchingRoutes,
  UserHikingPreferences,
} from '../services/segmentRoutingService';

// 步骤 2: 修改状态（旧）
const [aiMatched, setAiMatched] = useState(false);

// 改成（新）
interface AISearchState {
  isSearching: boolean;
  matchedRoutes: any[]; // RouteMatchScore[]
  selectedRouteId: string | null;
}
const [aiState, setAiState] = useState<AISearchState>({
  isSearching: false,
  matchedRoutes: [],
  selectedRouteId: null,
});

// 步骤 3: 替换搜索函数
const handleAIRouteSearch = async () => {
  setAiState(s => ({ ...s, isSearching: true }));
  
  try {
    const results = await findMatchingRoutes({
      mood: selectedMood,
      difficulty: selectedDifficulty,
      condition: conditionInput,
      availableTime: 300,
      maxDistance: 20,
    });
    
    setAiState(s => ({
      ...s,
      matchedRoutes: results,
      isSearching: false,
    }));
  } catch (e) {
    console.error(e);
    setAiState(s => ({ ...s, isSearching: false }));
  }
};

// 步骤 4: 在 UI 中显示结果
{aiState.isSearching && <Spinner />}
{!aiState.isSearching && aiState.matchedRoutes.map(route => (
  <div key={route.id} className="border rounded-lg p-4">
    <h3>{route.name}</h3>
    <p>匹配度: {route.score}%</p>
    <button onClick={() => handleSelectRoute(route.id)}>选择</button>
  </div>
))}
```

**耗时**: 30 分钟 ⏱️

---

### 我想调整 AI 匹配的权重

```typescript
// 文件: services/segmentRoutingService.ts
// 函数: scoreRoute()

// 找到这一段（大约在第 150 行）：
const weights = {
  tagSimilarity: 0.40,      // ← 40%, 可改
  difficultyMatch: 0.20,    // ← 20%, 可改
  timeAvailable: 0.10,      // ← 10%, 可改
  distanceMatch: 0.10,      // ← 10%, 可改
  popularityBonus: 0.05,    // ← 5%, 可改
  baseScore: 50,            // ← 基础分数
};

// 例如，如果用户说"标签匹配不准"，就改这个：
// const weights = {
//   tagSimilarity: 0.50,    // 从 40% 提升到 50%
//   difficultyMatch: 0.15,  // 从 20% 降低到 15%
//   ...
// };
```

**耗时**: 2 分钟 ⏱️

---

### 我想添加新的 segment

```sql
-- 在 Supabase SQL Editor 中执行
INSERT INTO segments (
  name, 
  description, 
  region, 
  difficulty, 
  distance, 
  duration_minutes, 
  elevation_gain, 
  elevation_loss,
  coordinates,
  tags, 
  is_published
) VALUES (
  'My New Trail',
  'Description here',
  'Region Name',
  2,                    -- 难度 1-5
  5.2,                  -- 距离 km
  120,                  -- 时间分钟
  300,                  -- 海拔增加
  200,                  -- 海拔减少
  '[
    [114.2, 22.3],
    [114.21, 22.31],
    [114.22, 22.32]
  ]'::jsonb,           -- 坐标，必须是 GeoJSON 格式
  '["scenic", "forest", "photo_spot"]'::jsonb,  -- tags
  true                 -- 发布状态
);
```

**耗时**: 5 分钟 ⏱️

---

### 我想看 AI 搜索的记录

```sql
-- 查看用户搜索历史
SELECT 
  user_id,
  user_mood,
  user_difficulty,
  user_condition,
  top_route_id,
  created_at
FROM ai_route_matches
ORDER BY created_at DESC
LIMIT 20;

-- 查看哪个 route 被选择最多
SELECT 
  top_route_id,
  COUNT(*) as selection_count
FROM ai_route_matches
WHERE top_route_id IS NOT NULL
GROUP BY top_route_id
ORDER BY selection_count DESC;
```

**耗时**: 3 分钟 ⏱️

---

## 📊 关键函数速查

### userPreferencesToTags()

**输入**: 用户偏好对象
```typescript
{
  mood: "Peaceful",           // 心情
  difficulty: "easy",         // 难度
  condition: "quiet forest",  // 具体条件
  availableTime: 300,         // 分钟
  maxDistance: 20,            // 公里
}
```

**输出**: 搜索标签数组
```typescript
["quiet", "shaded", "forest", "peaceful", "beginner_friendly", "scenic"]
```

**作用**: 将自然语言转换为标准化的搜索标签

---

### scoreRoute()

**输入**: 
- route 对象（包含 tags, difficulty, distance, duration_minutes）
- userPrefs 对象
- userTags 数组

**输出**: 0-100 的分数
```typescript
route.score = 75  // 表示 75% 匹配度
```

**作用**: 计算一条路线与用户偏好的匹配度

---

### findMatchingRoutes()

**输入**: UserHikingPreferences 对象

**输出**: RouteMatchScore[] 数组
```typescript
[
  {
    id: "route_123",
    name: "Forest & Wildlife Trail",
    score: 87,
    matchReasons: ["High tag match", "Difficulty matches"],
    // ... 更多数据
  },
  {
    id: "route_456",
    name: "Harbor View Easy Walk",
    score: 79,
    matchReasons: ["Tag match", "Perfect difficulty"],
    // ... 更多数据
  },
]
```

**作用**: 主搜索函数，返回排序好的推荐列表

---

### mergeSegmentCoordinates()

**输入**: 多个 segment 的坐标数组

**输出**: 合并后的单一坐标数组
```typescript
// 输入
[[114.2, 22.3], [114.21, 22.31]], // segment 1
[[114.22, 22.32], [114.23, 22.33]]; // segment 2

// 输出
[114.2, 22.3], [114.21, 22.31], [114.22, 22.32], [114.23, 22.33]
```

**作用**: 将多条 segments 的坐标合并为一条连贯的路线

---

## 🧪 快速测试命令

```bash
# 测试数据库连接
psql -U postgres -h your-db-host -d postgres -c "SELECT 1"

# 查看所有表
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

# 查看索引
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

# 备份数据
pg_dump -U postgres -h host database_name > backup.sql

# 恢复数据
psql -U postgres -h host database_name < backup.sql
```

---

## 🐛 常见错误及修复

| 错误 | 原因 | 修复 |
|------|------|------|
| "No routes found" | 没有发布的 routes | `UPDATE routes SET is_published = true;` |
| "Invalid tags format" | JSONB 格式错误 | 使用 `'["tag1", "tag2"]'::jsonb` |
| "Cannot find segment" | segment_id 错误 | 验证 id: `SELECT id FROM segments;` |
| "TypeScript error" | import 路径错误 | 检查相对路径 `../services/...` |
| "Score always 0" | 权重都是 0 | 确保权重和等于 1.0 |

---

## 📱 UI 模板速查

### 匹配路由卡片
```tsx
<div className="border rounded-lg p-4 mb-3">
  <div className="flex justify-between items-start">
    <h3 className="font-bold">{route.name}</h3>
    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
      {route.score}%
    </span>
  </div>
  
  <p className="text-sm text-gray-600 mt-2">{route.description}</p>
  
  <div className="flex gap-2 mt-2 text-xs">
    <span>📏 {route.distance} km</span>
    <span>⏱️ {route.duration} h</span>
    <span>📈 难度 {route.difficulty}/5</span>
  </div>
  
  {/* Segment 预览 */}
  <div className="mt-3 pt-3 border-t">
    <p className="text-xs font-semibold text-gray-500 mb-2">包含段落:</p>
    <div className="flex flex-wrap gap-1">
      {route.segments.slice(0, 3).map(seg => (
        <span key={seg.id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
          {seg.name}
        </span>
      ))}
      {route.segments.length > 3 && (
        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
          +{route.segments.length - 3}
        </span>
      )}
    </div>
  </div>
  
  <button 
    onClick={() => handleSelectRoute(route.id)}
    className="w-full mt-3 bg-green-600 text-white py-2 rounded"
  >
    选择此路线
  </button>
</div>
```

---

## 🎯 性能优化建议

```typescript
// 1. 缓存搜索结果
const searchCache = new Map();

const findMatchingRoutesWithCache = async (prefs) => {
  const key = JSON.stringify(prefs);
  if (searchCache.has(key)) {
    return searchCache.get(key);  // 秒级返回
  }
  
  const results = await findMatchingRoutes(prefs);
  searchCache.set(key, results);
  return results;
};

// 2. 延迟加载 segments 详情
const route = {
  id: "123",
  name: "Trail Name",
  // segments 数据延迟加载，不是初始加载
};

// 3. 只显示前 5 条结果
const topMatches = results.slice(0, 5);
```

---

## 📞 调试技巧

```typescript
// 1. 记录搜索流程
console.log('输入的偏好:', userPrefs);
console.log('转换后的标签:', userTags);
console.log('匹配结果数量:', results.length);
console.log('第一条路由:', results[0]);

// 2. 在浏览器断点调试
// DevTools → Sources → 找到文件 → 点击断点 → F10 单步执行

// 3. 检查数据库查询
// 在 Supabase SQL Editor 中运行同样的查询，验证数据

// 4. 验证 tags 匹配
console.log('用户标签:', userTags);
console.log('路由标签:', route.tags);
const similarity = calculateTagSimilarity(userTags, route.tags);
console.log('相似度:', similarity);
```

---

## 🔄 完整工作流

```
1️⃣ 用户打开 PlanningView
   ↓
2️⃣ 选择 mood, difficulty, 输入 condition
   ↓
3️⃣ 点击"AI 推荐路线"按钮
   ↓
4️⃣ handleAIRouteSearch() 被调用
   ↓
5️⃣ userPreferencesToTags() 转换为搜索标签
   ↓
6️⃣ findMatchingRoutes() 查询数据库，对每条路由评分
   ↓
7️⃣ 结果按分数排序，显示前 5 条
   ↓
8️⃣ 用户点击其中一条
   ↓
9️⃣ handleSelectRoute() 获取完整数据
   ↓
🔟 mergeSegmentCoordinates() 合并 segment 坐标
   ↓
1️⃣1️⃣ 跳转到 CompanionView，显示地图和路线
```

---

## 🎓 概念对比

### 旧方式 vs 新方式

| 方面 | 旧方式 | 新方式 |
|------|--------|--------|
| 路由数据 | 硬编码 JSON 数组 | 数据库表 |
| 查询方式 | 手动过滤 | SQL 查询 + AI 评分 |
| 用户输入 | 简单的分类按钮 | 自然语言处理 |
| 推荐逻辑 | 随机或简单匹配 | 多因子 AI 评分 |
| 学习能力 | 无 | 有（ai_route_matches 表） |
 | 扩展性 | 困难（改代码） | 简单（加数据库行） |

---

## ⚡ 一句话总结

**系统通过将用户的自然语言偏好转换为标准化标签，然后与数据库中所有段落的标签进行 Jaccard 相似度比较，最后综合难度、时间等多个因素计算出每条路线的匹配分数，从而实现 AI 驱动的个性化路线推荐。**
