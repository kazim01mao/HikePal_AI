# 🤖 Gemini AI Segments 自动组合指南

## 概览

本指南详细解释了如何使用 Gemini API 自动将多个 hiking segments 组合成完整的 routes。

---

## 🎯 完整流程图

```
用户点击 "Find My Perfect Route"
          ↓
    获取用户偏好 (mood, difficulty, condition)
          ↓
    尝试从数据库查询已发布的 routes
          ↓
    ✅ 有数据? → 直接返回 ✓
    ❌ 无数据? → 继续...
          ↓
    获取数据库中所有已发布的 segments
          ↓
    🤖 调用 Gemini AI API
    (提供 segments + 用户偏好)
          ↓
    AI 返回组合好的 routes (JSON)
          ↓
    转换为 ComposedRoute 格式
          ↓
    对路线评分和排序
          ↓
    返回给用户 ✨
```

---

## 📚 Gemini API 调用详解

### 第一步：初始化客户端

```typescript
// geminiService.ts 中的 getClient() 函数
const getClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.API_KEY; // 从环境变量读取
    if (!apiKey) {
      throw new Error("API Key missing");
    }
    aiClient = new GoogleGenAI({ apiKey }); // 创建客户端实例
  }
  return aiClient;
};
```

**关键点：**
- `process.env.API_KEY` - Gemini API Key 存储在环境变量中
- `GoogleGenAI` - Google 提供的 SDK 类
- 使用单例模式避免重复初始化

### 第二步：准备输入数据

```typescript
// 将 segments 转换为 AI 易读的格式
const segmentsInfo = segments.map(seg => ({
  id: seg.id,
  name: seg.name,
  region: seg.region,
  difficulty: seg.difficulty,
  distance: seg.distance,
  duration: seg.duration_minutes,
  elevation_gain: seg.elevation_gain,
  tags: seg.tags,
  highlights: seg.highlights,
  start_point: seg.start_point,  // [lat, lng]
  end_point: seg.end_point,      // [lat, lng]
}));
```

**为什么要转换？**
- AI 更容易理解清晰的结构化数据
- 减少冗余信息降低 token 使用
- 提高响应速度

### 第三步：构建提示词（Prompt）

```typescript
const prompt = `You are a hiking route designer for Hong Kong. 
    
User Preferences:
- Mood: ${userMood}           // 用户心情
- Difficulty: ${userDifficulty}      // 难度偏好
- Condition: ${userCondition}        // 身体状态

Available Trail Segments:
${JSON.stringify(segmentsInfo, null, 2)}

Task: Combine 2-4 segments into optimal hiking routes...
Return ONLY valid JSON array...`;
```

**提示词的三个关键部分：**
1. **角色定义** - 告诉 AI 它是谁
2. **上下文** - 提供用户信息和可用数据
3. **任务** - 明确要求 AI 做什么和如何输出

### 第四步：调用 API

```typescript
const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",  // 使用的模型
  contents: prompt,                  // 输入提示词
  config: {
    temperature: 0.7,               // 0-1, 越高越创意  
    max_output_tokens: 2000,        // 限制输出长度
  },
});
```

**参数解释：**
- **model** - 选择 Gemini 模型版本
  - `gemini-3-flash-preview` - 快速、成本低
  - `gemini-2-pro` - 更强大但更慢
  
- **temperature** - 控制输出的随机性
  - 0 = 完全确定性（每次相同）
  - 1 = 很随机（创意最大）
  - 推荐 0.7 = 平衡

- **max_output_tokens** - 最大输出长度（防止过长）

### 第五步：解析响应

```typescript
const responseText = response.text || '[]';

// AI 可能返回包含JSON的文本，需要提取
const jsonMatch = responseText.match(/\[[\s\S]*\]/);
const routesData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

// 验证是数组格式
return Array.isArray(routesData) ? routesData : [];
```

**为什么需要解析？**
- AI 有时会在 JSON 前后添加说明文字
- 需要提取实际的 JSON 数据
- 需要处理解析错误情况

---

## 🔄 数据流转过程

### 步骤 1: 用户输入
```typescript
{
  mood: "Peaceful",
  difficulty: "easy",
  condition: "Well-rested, want quiet and scenic"
}
```

### 步骤 2: 获取 Segments（来自数据库）
```typescript
[
  {
    id: "seg_1",
    name: "Peak to Pok Fu Lam",
    difficulty: 1,
    distance: 3.5,
    tags: ["scenic", "forest"]
  },
  {
    id: "seg_2", 
    name: "Pok Fu Lam to Reservoir",
    difficulty: 1,
    distance: 2.5,
    tags: ["quiet", "water_view"]
  },
  // ...更多 segments
]
```

### 步骤 3: AI 生成的结果
```json
[
  {
    "name": "Peaceful Peak Walk",
    "description": "Easy scenic walk perfect for relaxation",
    "segments": ["seg_1", "seg_2"],
    "total_distance": 6,
    "total_duration": 120,
    "total_elevation_gain": 150,
    "difficulty": 1,
    "reasons": ["Perfect for peaceful mood", "Scenic water views"]
  },
  // ...更多路线
]
```

### 步骤 4: 转换为 ComposedRoute
```typescript
{
  id: "ai-route-0-1709491200000",
  name: "Peaceful Peak Walk",
  description: "Easy scenic walk perfect for relaxation",
  region: "香港",
  is_segment_based: true,
  total_distance: 6,
  total_duration_minutes: 120,
  total_elevation_gain: 150,
  difficulty_level: 1,
  tags: ["scenic", "forest", "quiet", "water_view"],
  segments: [
    // 完整的 segment 对象
  ],
  created_by: "ai",
  created_at: "2026-03-03T10:00:00Z"
}
```

### 步骤 5: 评分和排序
```typescript
{
  routeId: "ai-route-0-1709491200000",
  routeName: "Peaceful Peak Walk",
  matchScore: 92,  // AI 时给出的分数
  matchReasons: ["高标签匹配度 (95%)", "难度匹配", "时间充足"],
  segments: [...],
  totalDistance: 6,
  totalDuration: 120,
  difficulty: 1
}
```

---

## 🛠️ 设置和配置

### 1. 安装依赖
```bash
npm install @google/genai
```

### 2. 获取 Gemini API Key
1. 访问 [Google AI Studio](https://aistudio.google.com)
2. 点击 "Get API Key"
3. 选择或创建项目
4. 复制 API Key

### 3. 配置环境变量
```bash
# .env 或 .env.local
VITE_API_KEY=your_gemini_api_key_here
```

**注意：** 前缀需要是 `VITE_` 因为使用了 Vite

### 4. 在代码中使用
```typescript
// 如果用 Vite，改为：
const apiKey = import.meta.env.VITE_API_KEY;
```

---

## 📊 调用费用估算

Gemini API 的定价（按以下估算）：

| 操作 | Token 数量 | 成本 |
|------|----------|------|
| 发送 20 个 segments | ~5,000 tokens | ~$0.001 |
| AI 生成 5 个 routes | ~1,000 tokens | ~$0.0002 |
| **总计** | ~6,000 tokens | ~$0.0015 |

💡 **成本非常低**，可以频繁调用！

---

## 🐛 调试技巧

### 1. 打印日志查看流程
```typescript
console.log('📡 Calling Gemini API...');
const response = await ai.models.generateContent({...});
console.log('✅ Response:', response.text);
```

### 2. 检查 API Key
```typescript
// 在浏览器控制台运行
console.log(import.meta.env.VITE_API_KEY?.slice(0, 10) + '...');
// 输出: AIzaSyJ... (如果配置正确)
```

### 3. 验证 JSON 解析
```typescript
try {
  const parsed = JSON.parse(jsonMatch[0]);
  console.log('✅ 解析成功:', parsed);
} catch (e) {
  console.error('❌ 解析失败:', e);
  console.error('原始文本:', responseText);
}
```

### 4. 查看完整日志输出
在浏览器的 **DevTools → Console** 中可以看到：
```
📦 Attempting to fetch routes from database...
Database is empty, using AI to generate routes...
Step 1️⃣: Fetching published segments...
Found 15 segments to work with
Step 2️⃣: Calling Gemini API to combine segments...
📡 Calling Gemini API to generate routes...
✅ Gemini API Response: [...]
✨ AI generated 3 routes
Step 3️⃣: Converting AI results to route format...
...
🎉 Successfully generated 5 route matches using AI
```

---

## ⚙️ 优化建议

### 1. 批量处理 Segments
```typescript
// ❌ 不好：每次发送所有 segments
const response = await ai.models.generateContent({
  contents: JSON.stringify(allSegments) // 太大
});

// ✅ 好：分类发送相关 segments
const byRegion = segments.groupBy(s => s.region);
for (const [region, segs] of Object.entries(byRegion)) {
  await generateRoutesWithAI(segs, ...);
}
```

### 2. 缓存结果
```typescript
// 缓存 AI 生成的路线避免重复调用
const routeCache = new Map();

async function getCachedRoutes(userId, preferences) {
  const key = `${userId}-${JSON.stringify(preferences)}`;
  if (routeCache.has(key)) {
    return routeCache.get(key);
  }
  
  const routes = await generateRoutesWithAI(...);
  routeCache.set(key, routes);
  return routes;
}
```

### 3. 添加超时控制
```typescript
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('API 超时')), 10000)
);

const response = await Promise.race([
  ai.models.generateContent({...}),
  timeoutPromise
]);
```

---

## 🚀 进阶用法

### 1. 多模态输入（未来）
```typescript
// 当前只支持文本，未来可能支持图片
const response = await ai.models.generateContent({
  contents: [
    { text: "分析这条路线..." },
    { image: routeImageData } // 未来支持
  ]
});
```

### 2. 流式输出（提高体验）
```typescript
// 不是一次获取整个响应，而是逐步接收
const stream = await ai.models.generateContentStream({
  contents: prompt
});

for await (const chunk of stream) {
  console.log('接收片段:', chunk.text);
  // 在 UI 上逐步显示结果
}
```

### 3. 函数调用（Function Calling）
```typescript
// AI 可以调用你定义的函数
const response = await ai.models.generateContent({
  contents: prompt,
  tools: [
    {
      functionDeclarations: [
        {
          name: "calculate_route_stats",
          description: "计算路线统计",
          parameters: {
            type: "object",
            properties: {
              segments: { type: "array" }
            }
          }
        }
      ]
    }
  ]
});
```

---

## 📞 常见问题

**Q: API Key 在哪里配置？**
A: 在 `.env.local` 文件中添加 `VITE_API_KEY=...`

**Q: 为什么 AI 返回的 JSON 无法解析？**
A: AI 有时在 JSON 前后加文字，使用正则表达式提取：
```typescript
const jsonMatch = text.match(/\[[\s\S]*\]/);
```

**Q: 如何减少 API 调用成本？**
A: 
1. 缓存结果
2. 减少发送的 segments 数量
3. 使用批量请求

**Q: 如果 API 调用失败怎么办？**
A: 已有 try-catch 处理，会返回空数组，UI 会显示备选方案（MOCK 数据）

---

## 📚 参考资源

- [Gemini API 文档](https://ai.google.dev/documentation)
- [GoogleGenAI SDK](https://github.com/googleapis/google-cloud-node)
- [提示词工程最佳实践](https://cloud.google.com/docs/generative-ai/best-practices)

---

**就这样！现在你的应用已经拥有 AI 动力的路线推荐系统了！🎉**
