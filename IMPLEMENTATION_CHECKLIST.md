# HikePal AI - Segment-Based Routing System 实现清单

## 📋 总体进度

```
整体完成度: ████████░░ 80%
├─ 后端设计: ✅ 100%
├─ 数据库架构: ✅ 100%
├─ 算法实现: ✅ 100%
├─ 前端集成: ⏳ 0%
└─ 数据迁移: ⏳ 0%
```

---

## 🗄️ 阶段 1: 数据库设置

> **预计耗时**: 15 分钟  
> **难度**: ⭐ 简单  
> **关键性**: 🔴 必须

- [ ] **1.1 获取 database_schema.sql**
  - 文件位置: `/Users/junyumao/Documents/GitHub/HikePal_AI/database_schema.sql`
  - 状态: ✅ 已创建

- [ ] **1.2 在 Supabase 中执行 SQL 脚本**
  1. 打开 Supabase 控制台 → 你的项目
  2. 点击左侧菜单 "SQL Editor"
  3. 点击 "New Query"
  4. 复制 `database_schema.sql` 全部内容
  5. 粘贴到编辑器
  6. 点击 "Run" 执行
  
- [ ] **1.3 验证表创建成功**
  - [ ] 打开 "Table list" 确认存在以下 8 个表:
    - `segments` ✓
    - `routes` ✓
    - `route_segments` ✓
    - `ai_route_matches` ✓
    - `segment_tags` ✓
    - `hike_sessions` ✓ (可选)
    - `segment_ratings` ✓ (可选)
    - `route_feedback` ✓ (可选)
  
  - [ ] 验证视图存在:
    - `routes_with_segments` ✓
  
  - [ ] 验证 20 个 segment_tags 已插入:
    ```sql
    SELECT COUNT(*) FROM segment_tags;  -- 应返回 20
    ```

- [ ] **1.4 检查索引和 RLS 政策**
  - 打开任意表的 "Indexes" 标签
  - 确认存在 GIN 和 GiST 索引
  - 打开 "Auth" 标签，确认 RLS 政策已启用

**状态**: ⏳ 等待执行  
**下一步**: → 阶段 2

---

## 📦 阶段 2: 导入 Segment 数据

> **预计耗时**: 30-45 分钟  
> **难度**: ⭐⭐ 中等  
> **关键性**: 🟡 重要

### 选项 A: 使用示例数据（推荐快速开始）

- [ ] **2A.1 运行 SQL 插入示例 segments**
  ```sql
  -- 这些 INSERT 语句已在 database_schema.sql 中
  -- 需要单独执行或重新运行
  ```
  - [ ] 验证 4 个 Dragon's Back segments 已创建
  - [ ] 查询验证:
    ```sql
    SELECT COUNT(*) FROM segments WHERE region = 'Hong Kong Island';
    ```

### 选项 B: 导入现有数据

- [ ] **2B.1 准备数据迁移脚本**
  - 从 `trailData.ts` 中读取现有 mock routes
  - 创建迁移脚本 `scripts/migrate_trails_to_segments.ts`
  
- [ ] **2B.2 为每个 trail 创建 segments**
  - [ ] 将大型 trail 分割成 3-5 个小的 segments
  - [ ] 每个 segment 需要:
    - 名称、描述
    - 坐标数组 (GeoJSON LineString)
    - difficulty: 1-5
    - distance (km)
    - duration_minutes
    - elevation_gain, elevation_loss
    - tags: 5-10 个相关标签
  
- [ ] **2B.3 批量插入 segments**
  - [ ] 使用 Supabase 管理界面或脚本
  - [ ] 验证总数 > 10 条

### 验证数据完整性

- [ ] **2C.1 检查 segments 数据质量**
  ```sql
  -- 检查所有 segments 都有必需字段
  SELECT id, name, is_published FROM segments WHERE 
    distance IS NULL 
    OR duration_minutes IS NULL 
    OR tags IS NULL;
  -- 应该返回空结果
  ```

- [ ] **2C.2 验证坐标格式**
  ```sql
  SELECT 
    id, 
    name, 
    JSON_ARRAY_LENGTH(coordinates) as coord_count 
  FROM segments 
  ORDER BY coord_count DESC 
  LIMIT 5;
  -- 每个 segment 应有 20+ 个坐标点
  ```

- [ ] **2C.3 验证 tags 相关性**
  - 打开任意 segment，检查 tags 是否合理
  - 例子: `["scenic", "forest", "beginner_friendly", "photo_spot"]`

**状态**: ⏳ 等待数据  
**下一步**: → 阶段 3

---

## 🎯 阶段 3: 创建初始 Template Routes

> **预计耗时**: 30 分钟  
> **难度**: ⭐⭐ 中等  
> **关键性**: 🟡 重要

- [ ] **3.1 创建第一条 template route: Dragon's Back Classic**
  ```sql
  -- 1. 创建 route 记录
  INSERT INTO routes (
    name, 
    description, 
    region, 
    is_segment_based, 
    created_by, 
    is_published, 
    is_template
  ) VALUES (
    'Dragon\'s Back Classic',
    'The complete Dragon\'s Back Trail - scenic with harbor views',
    'Hong Kong Island',
    true,
    'template_creator',
    true,
    true
  ) RETURNING id;
  -- 保存返回的 route_id
  
  -- 2. 关联 segments (假设你有 seg_id_1, seg_id_2, seg_id_3)
  INSERT INTO route_segments (route_id, segment_id, segment_order, is_connected)
  VALUES
    ('YOUR_ROUTE_ID', 'seg_id_1', 0, true),
    ('YOUR_ROUTE_ID', 'seg_id_2', 1, true),
    ('YOUR_ROUTE_ID', 'seg_id_3', 2, true);
  ```
  - [ ] 验证路由已创建: 
    ```sql
    SELECT * FROM routes_with_segments WHERE name = 'Dragon\'s Back Classic';
    ```

- [ ] **3.2 创建更多 template routes (至少 3 条)**

  **Route 2: Harbor View Easy Walk**
  - [ ] 选择 2-3 个简单、风景美的 segments
  - [ ] tags 应包含: `scenic`, `water_view`, `photo_spot`, `beginner_friendly`
  - [ ] difficulty 应为 1 或 2

  **Route 3: Forest Immersion Hike**
  - [ ] 选择 2-3 个林区的 segments
  - [ ] tags 应包含: `forest`, `quiet`, `shaded`, `peaceful`
  - [ ] difficulty 应为 2 或 3

  **Route 4: Challenge Peak Route**
  - [ ] 选择有爬升的 segments
  - [ ] tags 应包含: `steep`, `mountain_peak`, `adventure`, `challenging`
  - [ ] difficulty 应为 4 或 5

- [ ] **3.3 验证所有 template routes**
  ```sql
  SELECT 
    name, 
    total_distance, 
    total_duration_minutes, 
    difficulty_level,
    is_template
  FROM routes_with_segments 
  WHERE is_template = true;
  -- 应该看到 3 - 4 行
  ```

**状态**: ⏳ 等待执行  
**下一步**: → 阶段 4

---

## 💻 阶段 4: 修改前端 - PlanningView.tsx 集成

> **预计耗时**: 1-2 小时  
> **难度**: ⭐⭐⭐ 困难  
> **关键性**: 🔴 必须

### 4.1 准备工作

- [ ] **4.1.1 获取所需文件**
  - `services/segmentRoutingService.ts` ✅ (已创建)
  - `SEGMENT_ROUTING_INTEGRATION.md` ✅ (已创建)
  - `PlanningView.tsx` 当前版本

- [ ] **4.1.2 备份原文件**
  ```bash
  cp components/PlanningView.tsx components/PlanningView.tsx.backup
  ```

### 4.2 代码修改

- [ ] **4.2.1 添加导入语句**
  ```typescript
  // 在文件顶部添加
  import {
    findMatchingRoutes,
    userPreferencesToTags,
    mergeSegmentCoordinates,
    UserHikingPreferences,
    RouteMatchScore,
  } from '../services/segmentRoutingService';
  ```
  - [ ] 验证没有 TypeScript 错误

- [ ] **4.2.2 修改 state 结构**
  - [ ] 定义新的 AISearchState interface
    ```typescript
    interface AISearchState {
      isSearching: boolean;
      matchedRoutes: RouteMatchScore[];
      userPrefs: UserHikingPreferences | null;
      selectedRouteId: string | null;
      error?: string;
    }
    ```
  
  - [ ] 替换原来的状态声明:
    ```typescript
    // 旧: const [aiMatched, setAiMatched] = useState(false);
    // 新:
    const [aiSearchState, setAiSearchState] = useState<AISearchState>({
      isSearching: false,
      matchedRoutes: [],
      userPrefs: null,
      selectedRouteId: null,
    });
    ```
  
  - [ ] 删除无用的状态:
    - `aiMatched` (被 aiSearchState.isSearching 替代)

- [ ] **4.2.3 重写 handleAIRouteSearch() 函数**
  参考 SEGMENT_ROUTING_INTEGRATION.md 的代码模板
  
  - [ ] 添加输入验证器
  - [ ] 创建 UserHikingPreferences 对象
  - [ ] 设置 isSearching 状态
  - [ ] 调用 findMatchingRoutes()
  - [ ] 处理错误情况
  - [ ] 更新 aiSearchState.matchedRoutes
  - [ ] 保存搜索记录到 ai_route_matches (可选)
  
  ```typescript
  const handleAIRouteSearch = async () => {
    if (!selectedMood || !selectedDifficulty) return;
    
    setAiSearchState(prev => ({ ...prev, isSearching: true }));
    
    try {
      const userPrefs: UserHikingPreferences = {
        mood: selectedMood,
        difficulty: selectedDifficulty,
        condition: conditionInput,
        availableTime: 300,
        maxDistance: 20,
      };
      
      const results = await findMatchingRoutes(userPrefs);
      
      setAiSearchState(prev => ({
        ...prev,
        matchedRoutes: results,
        userPrefs,
        isSearching: false,
      }));
    } catch (error) {
      console.error('AI Search Error:', error);
      setAiSearchState(prev => ({
        ...prev,
        error: error.message,
        isSearching: false,
      }));
    }
  };
  ```

- [ ] **4.2.4 替换推荐路由 UI**
  - [ ] 删除原来的硬编码路由卡片
  - [ ] 使用参考模板渲染 matchedRoutes
  - [ ] 每张卡片显示:
    - ✓ 路由名称
    - ✓ 匹配分数 (0-100%)
    - ✓ 匹配原因 (tags, difficulty 等)
    - ✓ 路由统计 (距离, 时间, 难度)
    - ✓ Segment 预览 (前 3 个 + 数量)
    - ✓ 选择按钮
  
  - [ ] 添加加载状态 (spinner)
  - [ ] 添加空状态提示

- [ ] **4.2.5 添加 handleSelectRoute() 回调**
  - [ ] 获取完整的 route + segments 数据
  - [ ] 合并 segments 坐标为单一 LineString
  - [ ] 创建 hike_session 记录
  - [ ] 记录选择到 ai_route_matches.used_at
  - [ ] 调用 onSelectRoute() 传递完整数据
  
  ```typescript
  const handleSelectRoute = async (routeId: string) => {
    try {
      // 从 routes_with_segments 视图获取完整数据
      const route = await supabase
        .from('routes_with_segments')
        .select('*')
        .eq('id', routeId)
        .single();
      
      // 合并 segments
      const mergedCoordinates = mergeSegmentCoordinates(...);
      
      // 创建 hike_session
      const session = await supabase
        .from('hike_sessions')
        .insert({ ... });
      
      // 记录 AI 选择
      await supabase
        .from('ai_route_matches')
        .update({ used_at: new Date() })
        .eq('id', ...);
      
      // 传递给父组件
      onSelectRoute({
        ...route,
        coordinates: mergedCoordinates,
      });
    } catch (error) {
      console.error('Error selecting route:', error);
    }
  };
  ```

### 4.3 测试和验证

- [ ] **4.3.1 TypeScript 编译检查**
  ```bash
  # 在项目根目录运行
  npx tsc --noEmit
  # 应该显示 0 errors
  ```

- [ ] **4.3.2 本地开发服务器**
  ```bash
  npm run dev
  # 打开浏览器，导航到 Planning 页面
  ```

- [ ] **4.3.3 测试用例 1: 基础搜索**
  - [ ] 在 "Solo" 选项下，选择:
    - Mood: "Peaceful"
    - Difficulty: "Easy"
    - Condition: "quiet forest"
  - [ ] 期望结果:
    - 显示加载状态 (1-2 秒)
    - 出现 3-5 条匹配路由
    - 分数都 > 60%
    - 第一条包含 "quiet", "forest", "peaceful" 等 tags

  **验证**: ☐ 通过

- [ ] **4.3.4 测试用例 2: 困难路线**
  - [ ] 选择:
    - Mood: "Adventurous"
    - Difficulty: "Hard"
    - Condition: "challenging peak, good for photos"
  - [ ] 期望结果:
    - 出现难度为 3-5 的路线
    - 包含 "steep", "mountain_peak", "photo_spot" 的路线排名靠前

  **验证**: ☐ 通过

- [ ] **4.3.5 测试用例 3: 路由选择**
  - [ ] 在匹配列表中点击一条路由的选择按钮
  - [ ] 期望结果:
    - 路由完整数据加载成功
    - 坐标正确合并
    - CompanionView 显示完整的地图/路线

  **验证**: ☐ 通过

- [ ] **4.3.6 错误处理**
  - [ ] 检查 console 没有 undefined 错误
  - [ ] 网络请求失败时显示友好的错误提示

**状态**: ⏳ 等待开发  
**下一步**: → 阶段 5

---

## 🧪 阶段 5: 测试和优化

> **预计耗时**: 1-2 小时  
> **难度**: ⭐⭐⭐ 困难  
> **关键性**: 🟡 重要

### 5.1 单元测试

- [ ] **5.1.1 测试 userPreferencesToTags()**
  ```typescript
  import { userPreferencesToTags } from '../services/segmentRoutingService';
  
  const prefs = {
    mood: 'Peaceful',
    difficulty: 'easy',
    condition: 'quiet forest with good views',
    availableTime: 300,
    maxDistance: 20,
  };
  
  const tags = userPreferencesToTags(prefs);
  console.log(tags);
  // 期望: ["quiet", "forest", "shaded", "scenic", "beginner_friendly", ...]
  ```
  - [ ] 验证输出包含预期的 tags
  - [ ] 验证没有无关的 tags

- [ ] **5.1.2 测试 scoreRoute()**
  - [ ] 验证完全匹配的路由得分 > 80
  - [ ] 验证完全不匹配的路由得分 < 30
  - [ ] 验证难度不匹配时得分明显降低

- [ ] **5.1.3 测试 findMatchingRoutes()**
  ```typescript
  import { findMatchingRoutes } from '../services/segmentRoutingService';
  
  const prefs = { mood: 'Peaceful', difficulty: 'easy', ... };
  const matches = await findMatchingRoutes(prefs);
  
  // 验证返回结果
  matchess.forEach(match => {
    console.assert(match.score >= 0 && match.score <= 100);
    console.assert(match.route.is_published === true);
  });
  ```
  - [ ] 验证返回的都是已发布的路由
  - [ ] 验证按分数降序排列
  - [ ] 验证返回 ≤ 5 条结果

### 5.2 集成测试

- [ ] **5.2.1 完整工作流测试**
  1. [ ] 清空之前的搜索状态
  2. [ ] 输入不同的 mood/difficulty 组合
  3. [ ] 验证每个组合都返回相关的路由
  4. [ ] 选择其中一条路由
  5. [ ] 验证跳转到 CompanionView 并显示正确的地图

- [ ] **5.2.2 坐标合并测试**
  - [ ] 选择至少有 2 个 segments 的路由
  - [ ] 验证地图上显示的是连贯的路线（不是跳跃的点）
  - [ ] 验证起点和终点与描述匹配

- [ ] **5.2.3 性能测试**
  - [ ] 搜索时间应 < 1 秒
  - [ ] 处理 50+ 条路由时不卡顿
  
  ```bash
  # 使用 Chrome DevTools Performance 标签
  # 记录搜索操作，查看主线程时间
  # 期望: 主线程阻塞时间 < 200ms
  ```

### 5.3 用户体验测试

- [ ] **5.3.1 清晰的反馈**
  - [ ] 搜索正在进行时，显示清楚的加载状态
  - [ ] 如果没有结果，显示有用的提示信息
  - [ ] 错误时显示可采取的行动

- [ ] **5.3.2 视觉一致性**
  - [ ] matching scores 使用正确的颜色编码
  - [ ] segment 预览卡片布局对齐
  - [ ] 响应式设计（移动/桌面）都好看

- [ ] **5.3.3 辅助功能**
  - [ ] 键盘能完全操作（Tab 键导航）
  - [ ] 屏幕阅读器能读出选项
  - [ ] 对比度满足 WCAG AA 标准

### 5.4 数据一致性

- [ ] **5.4.1 验证 ai_route_matches 表记录**
  ```sql
  SELECT COUNT(*) FROM ai_route_matches WHERE created_at > NOW() - INTERVAL '1 hour';
  -- 应该看到测试期间的搜索记录
  ```

- [ ] **5.4.2 验证 tags 正确性**
  ```sql
  -- 确保所有路由的 tags 是其 segments 的并集
  SELECT 
    r.name,
    r.tags,
    ARRAY_AGG(s.tags) as segment_tags
  FROM routes r
  JOIN route_segments rs ON r.id = rs.route_id
  JOIN segments s ON rs.segment_id = s.id
  GROUP BY r.id
  LIMIT 5;
  ```

**状态**: ⏳ 等待执行  
**下一步**: → 完成 ✅

---

## 📊 性能基准

目标指标（应该在优化后达到）:

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| 搜索响应时间 | < 1 秒 | ？ | ⏳ |
| 支持路由数量 | 100+ | ? | ⏳ |
| 标签匹配准确度 | > 80% | ? | ⏳ |
| 用户体验评分 | > 4.0/5 | ? | ⏳ |

---

## 🚨 常见问题和解决方案

### 问题 1: "No matching routes found"

**原因**: 
- Segments 没有正确的 tags
- Template routes 没有创建
- 数据库查询失败

**解决**:
```sql
-- 验证有发布的路由
SELECT COUNT(*) FROM routes WHERE is_published = true;

-- 验证路由有 segments
SELECT r.name, COUNT(s.id) as segment_count
FROM routes r
LEFT JOIN route_segments rs ON r.id = rs.route_id
LEFT JOIN segments s ON rs.segment_id = s.id
WHERE r.is_published = true
GROUP BY r.id;
```

### 问题 2: "TypeScript errors in PlanningView"

**原因**: 
- 导入路径错误
- Interface 定义不匹配

**解决**:
```bash
# 运行 TypeScript 编译检查
npx tsc --noEmit

# 查看具体错误，通常指向的是哪一行和什么问题
# 常见修复:
# 1. 检查导入路径 (相对 ../ 不能少)
# 2. 确保 interface 字段名完全匹配
# 3. 检查 null/undefined 类型
```

### 问题 3: Segments 合并后坐标跳跃

**原因**:
- Segments 之间距离太远 (> 1km)
- 坐标格式不一致

**解决**:
```sql
-- 检查 segment 连接
SELECT 
  rs.route_id,
  s1.name as from_segment,
  s2.name as to_segment,
  rs.connection_distance
FROM route_segments rs
JOIN segments s1 ON rs.segment_id = s1.id
JOIN segments s2 ON s2.id = (
  SELECT segment_id FROM route_segments 
  WHERE route_id = rs.route_id AND segment_order = rs.segment_order + 1
)
WHERE rs.connection_distance > 1000;  -- > 1km
```

### 问题 4: AI 匹配分数都很低 (< 50%)

**原因**:
- 用户输入的关键词与定义的 tags 不匹配
- 权重配置不合理

**解决**:
1. 扩展 keyword 提取规则:
   ```typescript
   // 在 segmentRoutingService.ts 中修改
   const keywordMapping = {
     'photo|picture|photograph': { tags: ['photo_spot', 'scenic'] },
     'quiet|peaceful|calm': { tags: ['quiet', 'peaceful', 'shaded'] },
     // 添加更多...
   };
   ```

2. 调整权重:
   ```typescript
   // scoreRoute() 中修改
   const weights = {
     tagSimilarity: 0.50,    // 从 0.40 增加
     difficultyMatch: 0.15,  // 从 0.20 减少
     timeAvailability: 0.15, // 提高时间权重
   };
   ```

---

## ✅ 最终检查清单

完成所有修改后，运行这个检查：

```bash
# 1. TypeScript 编译
npx tsc --noEmit

# 2. 构建项目
npm run build

# 3. 查看是否有未跟踪的文件变化
git diff components/PlanningView.tsx

# 4. 验证数据库连接
npm run test:db

# 5. 本地运行
npm run dev

# 访问 http://localhost:5173/planning
# 验证所有功能都能正常工作
```

---

## 📞 获取帮助

- 如果遇到 TypeScript 错误，查看 **常见问题** 部分
- 如果 segments 数据问题，检查 **数据验证 SQL** 语句
- 如果性能问题，使用 Chrome DevTools 的 Performance 标签
- 如果概念不清楚，重新阅读 `SEGMENT_ROUTING_INTEGRATION.md`

---

## 📈 完成时依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✅ 阶段 1: 数据库设置                                     │
│        ↓                                                    │
│  ⏳ 阶段 2: 导入 Segment 数据                              │
│        ↓                                                    │
│  ⏳ 阶段 3: 创建 Template Routes                           │
│        ├────────────────┐                                  │
│        ↓                ↓                                   │
│  ⏳ 阶段 4a         ⏳ 阶段 4b                              │
│  修改 PlanningView  验证坐标                               │
│        ├────────────────┤                                  │
│        ↓                ↓                                   │
│  ⏳ 阶段 5: 测试和优化                                     │
│        ↓                                                    │
│  ✅ 完成！可以发布上线                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**当前状态**: 你正在第 1-2 阶段之间  
**建议的下一步**: 执行阶段 1 的 SQL
