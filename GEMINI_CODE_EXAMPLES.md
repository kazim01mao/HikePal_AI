# 💻 代码示例和实现细节

## 文件位置和改动总结

### 修改的文件

```
项目结构：
HikePal_AI/
├── services/
│   ├── geminiService.ts          ← 新增 generateRoutesWithAI() 函数
│   └── segmentRoutingService.ts  ← 修改 findMatchingRoutes() 函数
├── components/
│   └── PlanningView.tsx          ← 更新调用逻辑
├── .env.local                    ← 新建，添加 VITE_API_KEY
├── GEMINI_AI_INTEGRATION_GUIDE.md ← 新建详细指南
└── GEMINI_QUICK_START.md         ← 新建快速开始
```

---

## 🎯 核心函数解析

### 1. 初始化客户端 (getClient)

**文件：** `services/geminiService.ts`

```typescript
const getClient = (): GoogleGenAI => {
  if (!aiClient) {
    // 从环境变量读取 API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key is missing. Please select one.");
      throw new Error("API Key missing");
    }
    // 创建全局客户端实例
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};
```

**关键点：**
- 单例模式（lazy initialization）
- 只在第一次调用时初始化
- 后续调用返回同一实例

---

### 2. 生成路由主函数 (generateRoutesWithAI)

**文件：** `services/geminiService.ts`

```typescript
export const generateRoutesWithAI = async (
  segments: any[],
  userMood: string,
  userDifficulty: string,
  userCondition: string
): Promise<any[]> => {
  try {
    const ai = getClient();  // 获取或创建客户端
    
    // Step 1: 预处理 segments 数据
    const segmentsInfo = segments
      .map(seg => ({
        id: seg.id,
        name: seg.name,
        region: seg.region,
        difficulty: seg.difficulty,
        distance: seg.distance,
        duration: seg.duration_minutes,
        elevation_gain: seg.elevation_gain,
        tags: seg.tags,
        start_point: seg.start_point,
        end_point: seg.end_point,
      }))
      .slice(0, 20);  // 限制为前20个避免 token 过多
    
    // Step 2: 构建提示词
    const prompt = `You are a hiking route designer...
      
      Available Trail Segments:
      ${JSON.stringify(segmentsInfo, null, 2)}
      
      Return ONLY valid JSON array...`;
    
    // Step 3: 调用 API
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        max_output_tokens: 2000,
      },
    });
    
    // Step 4: 解析响应
    const responseText = response.text || '[]';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const routesData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    return Array.isArray(routesData) ? routesData : [];
  } catch (error) {
    console.error('🚨 Error calling Gemini API:', error);
    return [];
  }
};
```

**调用示例：**
```typescript
const aiRoutes = await generateRoutesWithAI(
  segments,                    // 从 DB 获得的 segments 数组
  "Peaceful",                  // 用户 mood
  "easy",                       // 用户 difficulty
  "Well-rested, scenic lover"  // 用户 condition
);

// 返回 AI 生成的路由信息
// [{
//   name: "...",
//   description: "...",
//   segments: ["seg_id1", "seg_id2"],
//   ...
// }, ...]
```

---

### 3. 匹配路由函数 (findMatchingRoutes)

**文件：** `services/segmentRoutingService.ts`

```typescript
export async function findMatchingRoutes(
  userPrefs: UserHikingPreferences,
  topN: number = 5
): Promise<RouteMatchScore[]> {
  try {
    // ===== 第一阶段：尝试从数据库获取 =====
    console.log('📦 Attempting to fetch routes from database...');
    const routes = await fetchComposedRoutes();

    if (routes.length > 0) {
      // 有数据，直接用数据库方案
      const userTags = userPreferencesToTags(userPrefs);
      const scores = routes.map(route => 
        scoreRoute(route, userPrefs, userTags)
      );
      return scores
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, topN);
    }

    // ===== 第二阶段：数据库为空，用 AI =====
    console.log('📡 Database is empty, using AI to generate routes...');
    
    // Step 1: 获取所有 segments
    const segments = await fetchPublishedSegments();
    if (segments.length === 0) {
      console.warn('⚠️ No segments found');
      return [];
    }
    
    // Step 2: 调用 Gemini 生成 routes
    const aiGeneratedRoutes = await generateRoutesWithAI(
      segments,
      userPrefs.mood,
      userPrefs.difficulty,
      userPrefs.condition
    );
    
    if (aiGeneratedRoutes.length === 0) {
      console.warn('⚠️ AI failed to generate routes');
      return [];
    }
    
    // Step 3: 转换为 ComposedRoute 格式
    const convertedRoutes = convertAIRoutesToComposedRoutes(
      aiGeneratedRoutes, 
      segments
    );
    
    // Step 4: 评分
    const userTags = userPreferencesToTags(userPrefs);
    const scores = convertedRoutes.map(route => 
      scoreRoute(route, userPrefs, userTags)
    );
    
    // Step 5: 返回
    return scores
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, topN);
      
  } catch (error) {
    console.error('❌ Error in findMatchingRoutes:', error);
    return [];
  }
}
```

**调用时机：**
```typescript
// 在 PlanningView.tsx 的 handleAIRouteSearch 中
const matches = await findMatchingRoutes(userPrefs, 5);

// 返回评分最高的 5 个路由
// [
//   {
//     routeId: "ai-route-0-123456",
//     routeName: "Peaceful Reservoir Walk",
//     matchScore: 92,
//     matchReasons: ["高标签匹配度", "难度匹配"],
//     segments: [...],
//     totalDistance: 6.5,
//     totalDuration: 150,
//     difficulty: 1
//   },
//   ...
// ]
```

---

### 4. 数据转换函数 (convertAIRoutesToComposedRoutes)

**文件：** `services/segmentRoutingService.ts`

```typescript
function convertAIRoutesToComposedRoutes(
  aiRoutes: any[],          // AI 返回的原始数据
  allSegments: Segment[]     // 数据库中的所有 segments
): ComposedRoute[] {
  return aiRoutes.map((aiRoute, index) => {
    // 1. 根据 segment IDs 获取完整 segment 对象
    const routeSegments: RouteSegment[] = (aiRoute.segments || [])
      .map((segId: string, order: number) => {
        const segment = allSegments.find(s => s.id === segId);
        if (!segment) return null;
        
        return {
          segment_id: segment.id,
          segment_name: segment.name,
          segment_order: order,
          difficulty: segment.difficulty,
          distance: segment.distance,
          duration_minutes: segment.duration_minutes,
          elevation_gain: segment.elevation_gain,
          tags: segment.tags || [],
          coordinates: segment.coordinates,
        };
      })
      .filter(Boolean);
    
    // 2. 收集所有 tags
    const allTags = new Set<string>();
    routeSegments.forEach(seg => {
      seg.tags?.forEach(tag => allTags.add(tag));
    });
    
    // 3. 返回标准的 ComposedRoute 格式
    return {
      id: `ai-route-${index}-${Date.now()}`,
      name: aiRoute.name,
      description: aiRoute.description,
      region: '香港',
      is_segment_based: true,
      total_distance: aiRoute.total_distance || 
        routeSegments.reduce((sum, s) => sum + s.distance, 0),
      total_duration_minutes: aiRoute.total_duration ||
        routeSegments.reduce((sum, s) => sum + s.duration_minutes, 0),
      total_elevation_gain: aiRoute.total_elevation_gain ||
        routeSegments.reduce((sum, s) => sum + s.elevation_gain, 0),
      difficulty_level: aiRoute.difficulty || 
        Math.ceil(routeSegments.reduce((sum, s) => sum + s.difficulty, 0) / 
                  Math.max(1, routeSegments.length)),
      tags: Array.from(allTags),
      segments: routeSegments,
      created_by: 'ai',
      created_at: new Date().toISOString(),
    };
  });
}
```

**使用示例：**
```typescript
const aiRoutesRaw = [
  {
    name: "Peak Walk",
    description: "Scenic peak route",
    segments: ["seg_1", "seg_2"],  // 只有 ID
    total_distance: 8,
    total_duration: 180,
    ...
  }
];

const composedRoutes = convertAIRoutesToComposedRoutes(
  aiRoutesRaw,
  allSegmentsFromDB
);

// 返回完整的 ComposedRoute 对象，包含完整的 segment 信息
```

---

## 🔄 完整调用链路

### 用户交互流程

```
用户在 PlanningView 中：
  ↓
1. 选择 mood (Peaceful, Energetic, etc.)
2. 选择 difficulty (easy, medium, hard)
3. 输入 condition (optional)
4. 点击 "Find My Perfect Route"
  ↓
handleAIRouteSearch() 被调用
  ↓
const userPrefs = {
  mood: "Peaceful",
  difficulty: "easy",
  condition: "Well-rested...",
  availableTime: 300,
  maxDistance: 20
}
  ↓
findMatchingRoutes(userPrefs, 5)
  ↓
[从此处开始 AI 流程]
getPublishedSegments() → [seg1, seg2, ...]
generateRoutesWithAI(...) → [route1, route2, ...]
convertAIRoutesToComposedRoutes(...) → [ComposedRoute1, ...]
scoreRoute(...) → [RouteMatchScore1, ...]
  ↓
返回评分最高的 5 个路由
  ↓
setAiSearchState() 更新 state
  ↓
UI 渲染路由列表
```

---

## 🧪 测试代码

### 本地测试设置

```typescript
// services/segmentRoutingService.ts 中，可以添加测试函数

export async function testAIRouteGeneration() {
  // 创建模拟 segments 数据
  const mockSegments = [
    {
      id: 'seg_test_1',
      name: 'Test Segment 1',
      region: '香港',
      difficulty: 1,
      distance: 3,
      duration_minutes: 60,
      elevation_gain: 100,
      tags: ['scenic', 'forest'],
      start_point: { lat: 22.3, lng: 114.2 },
      end_point: { lat: 22.31, lng: 114.21 },
      coordinates: [[22.3, 114.2], [22.31, 114.21]],
      is_published: true,
    },
    {
      id: 'seg_test_2',
      name: 'Test Segment 2',
      region: '香港',
      difficulty: 1,
      distance: 2.5,
      duration_minutes: 50,
      elevation_gain: 80,
      tags: ['quiet', 'water_view'],
      start_point: { lat: 22.31, lng: 114.21 },
      end_point: { lat: 22.32, lng: 114.22 },
      coordinates: [[22.31, 114.21], [22.32, 114.22]],
      is_published: true,
    }
  ];
  
  // 测试 AI 生成
  const result = await generateRoutesWithAI(
    mockSegments,
    'Peaceful',
    'easy',
    'Want scenic walk'
  );
  
  console.log('AI 生成结果:', result);
  return result;
}

// 在浏览器 console 中使用：
// import { testAIRouteGeneration } from './services/segmentRoutingService'
// testAIRouteGeneration()
```

---

## 📚 API 文档参考

### generateContent 方法参数

```typescript
interface GenerateContentRequest {
  model: string;                    // 使用的模型
  contents: string | ContentPart[]; // 输入内容
  systemInstruction?: string;       // 系统指令
  config?: {                        // 配置选项
    temperature?: number;           // 0-1, 默认 0.9
    topP?: number;                  // 核采样参数
    topK?: number;                  // 采样参数
    maxOutputTokens?: number;       // 最大输出长度
    stopSequences?: string[];       // 停止序列
  };
  tools?: Tool[];                   // 可用工具
  safetySettings?: SafetySetting[]; // 安全设置
}

interface GenerateContentResponse {
  text: string;                     // 生成的文本
  finishReason: string;            // 完成原因
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## 🚀 性能优化建议

### 1. 添加缓存机制

```typescript
const routeCache = new Map<string, RouteMatchScore[]>();

export async function findMatchingRoutesWithCache(
  userPrefs: UserHikingPreferences,
  topN: number = 5
): Promise<RouteMatchScore[]> {
  // 生成缓存 key
  const cacheKey = JSON.stringify({
    mood: userPrefs.mood,
    difficulty: userPrefs.difficulty
  });
  
  // 检查缓存
  if (routeCache.has(cacheKey)) {
    console.log('✅ 使用缓存的结果');
    return routeCache.get(cacheKey)!;
  }
  
  // 获取新结果
  const result = await findMatchingRoutes(userPrefs, topN);
  
  // 存储缓存（5分钟过期）
  routeCache.set(cacheKey, result);
  setTimeout(() => routeCache.delete(cacheKey), 5 * 60 * 1000);
  
  return result;
}
```

### 2. 批量请求优化

```typescript
// 限制 segments 数量减少 token 使用
const segmentsInfo = segments
  .sort((a, b) => b.popularity_score - a.popularity_score) // 按热度排序
  .slice(0, 15);  // 只发送最相关的 15 个
```

---

## 📊 监控和日志

### 添加性能指标

```typescript
const metrics = {
  dbQueryTime: 0,
  apiCallTime: 0,
  conversionTime: 0,
  scoringTime: 0,
  totalTime: 0
};

const startTime = Date.now();

// ... 执行各个步骤

console.log('⏱️ 性能指标:', {
  总耗时: `${metrics.totalTime}ms`,
  数据库查询: `${metrics.dbQueryTime}ms`,
  'API 调用': `${metrics.apiCallTime}ms`,
  数据转换: `${metrics.conversionTime}ms`,
  评分排序: `${metrics.scoringTime}ms`
});
```

---

**现在你有了完整的 AI 集成系统！开始使用吧！🚀**
