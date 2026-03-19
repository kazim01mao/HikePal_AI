# ⚡ 快速开始：Gemini API 配置

## 🎬 5分钟快速设置

### 步骤 1: 获取 Gemini API Key

1. **打开 Google AI Studio**
   - 访问: https://aistudio.google.com
   - 用你的 Google 账户登录

2. **获取 API Key**
   - 点击左侧菜单 "Get API Key"
   - 创建新项目（或选择现有项目）
   - 复制生成的 API Key

   ![获取API Key的截图示例]
   ```
   AIzaSyJ_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (示例)
   ```

### 步骤 2: 配置环境变量

3. **在项目根目录创建 `.env.local` 文件**

   ```bash
   # .env.local (在 /Users/junyumao/Documents/GitHub/HikePal_AI/.env.local)
   
   VITE_API_KEY=AIzaSyJ_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   💡 **为什么用 VITE_ 前缀？**
   - 项目使用 Vite 作为构建工具
   - Vite 只会暴露前缀为 `VITE_` 的环境变量到客户端

4. **不要提交到 Git**
   ```bash
   # 确保 .env.local 在 .gitignore 中
   echo ".env.local" >> .gitignore
   ```

### 步骤 3: 验证配置

5. **重启开发服务器**
   ```bash
   npm run dev
   # 或 yarn dev
   ```

6. **在浏览器 DevTools 中验证**
   ```javascript
   // 在浏览器控制台输入：
   console.log(import.meta.env.VITE_API_KEY);
   
   // 应该输出类似：
   // "AIzaSyJ_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

### 步骤 4: 测试 AI 功能

7. **在应用中测试**
   - 打开应用
   - 导航到 "Start Hiking" 页面
   - 选择 mood 和 difficulty
   - 点击 "Find My Perfect Route"
   - **打开浏览器 DevTools → Console**
   - 观察日志输出

   **预期输出：**
   ```
   📦 Attempting to fetch routes from database...
   Database is empty, using AI to generate routes...
   Step 1️⃣: Fetching published segments...
   Found 15 segments to work with
   Step 2️⃣: Calling Gemini API to combine segments...
   📡 Calling Gemini API to generate routes...
   ✅ Gemini API Response: [...]
   ✨ AI generated 3 routes
   ...
   🎉 Successfully generated 5 route matches using AI
   ```

---

## 🔧 常见问题修复

### ❌ 问题 1: "API Key missing" 错误

**症状：**
```
Error: API Key missing
```

**解决方案：**
1. 确认 `.env.local` 文件存在于项目根目录
2. 确认文件内容正确：
   ```bash
   VITE_API_KEY=你的_api_key
   ```
3. 确认没有多余空格：`VITE_API_KEY=AIzaSy...` ✅
4. 重启开发服务器：`npm run dev`

### ❌ 问题 2: "googleapi.com 连接失败"

**症状：**
```
Failed to connect to API
CORS error
```

**解决方案：**
- 这是浏览器的 CORS 限制，正常现象
- AI 调用应该在后端进行（未来优化）
- 目前可以在 `geminiService.ts` 中检查 API Key 是否有 URL 限制

### ❌ 问题 3: 返回空数组 / 没有路线显示

**症状：**
```
No segments found in database either
```

**解决方案：**
1. 确认数据库有 published segments
2. 检查 Supabase 连接是否正常
3. 运行备选方案：使用 MOCK_ROUTES 数据

---

## 📝 工作流总结

### 当用户点击 "Find My Perfect Route"

```
┌─────────────────────────────────────┐
│  用户点击 "Find My Perfect Route"   │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ handleAIRouteSearch  │
    │ 函数被触发           │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ findMatchingRoutes   │
    │ 函数被调用           │
    └──────────┬───────────┘
               │
        ┌─────┴─────┐
        │            │
        ▼            ▼
    ✅YES        ❌NO
  DB有数据?    DB为空?
        │            │
        │            ▼
        │     generateRoutesWithAI()
        │           │
        │           ▼
        │     +─────────────────+
        │     │ 调用Gemini API  │
        │     +────────┬────────+
        │              │
        │              ▼
        │  convertAIRoutesToComposed
        │              │
        └──────┬───────┘
               │
               ▼
        ┌─────────────────┐
        │ 评分和排序      │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 返回给用户      │
        │ UI 显示结果     │
        └─────────────────┘
```

---

## 📊 实际数据流示例

### 输入：用户选择
```javascript
{
  mood: "Peaceful",
  difficulty: "easy",
  condition: "Well-rested, want quiet forest trails"
}
```

### 中间过程：Gemini API 接收的数据
```json
{
  "segments": [
    {
      "id": "seg_peak_1",
      "name": "Victoria Peak to Pok Fu Lam",
      "difficulty": 1,
      "distance": 3.5,
      "duration_minutes": 90,
      "tags": ["scenic", "forest", "city_view"]
    },
    {
      "id": "seg_res_1", 
      "name": "Pok Fu Lam Reservoir Walk",
      "difficulty": 1,
      "distance": 2.5,
      "duration_minutes": 60,
      "tags": ["quiet", "water_view", "peaceful"]
    }
  ],
  "userMood": "Peaceful",
  "userDifficulty": "easy",
  "userCondition": "Well-rested, want quiet forest trails"
}
```

### 输出：Gemini API 返回
```json
[
  {
    "name": "Peaceful Reservoir Circuit",
    "description": "A gentle, scenic walk perfect for relaxation and photography",
    "segments": ["seg_peak_1", "seg_res_1"],
    "total_distance": 6,
    "total_duration": 150,
    "total_elevation_gain": 150,
    "difficulty": 1,
    "reasons": [
      "Perfect match for peaceful mood",
      "Quiet forest sections",
      "Beautiful water views"
    ]
  }
]
```

### 最终显示给用户
```
✨ Routes Made for You

┌─────────────────────────────────────┐
│ 🏞️ Peaceful Reservoir Circuit    │
│ 92% Match                            │
│                                     │
│ 高标签匹配度 (95%)                  │
│ 难度匹配                            │
│ 时间充足                            │
│                                     │
│ 📏 6.0 km  ⏱️ 2.5h  ⬆️ 150m       │
│                                     │
│ 2 segments: Victoria Peak...        │
│            Pok Fu Lam...            │
└─────────────────────────────────────┘
```

---

## 🚀 下一步

### 本地测试清单

- [ ] 获取了 Gemini API Key
- [ ] 创建了 `.env.local` 文件
- [ ] 配置了 `VITE_API_KEY`
- [ ] 重启了开发服务器
- [ ] 在浏览器验证了 API Key
- [ ] 点击 "Find My Perfect Route" 能看到结果
- [ ] 浏览器控制台没有错误

### 优化清单

- [ ] 添加加载动画提示用户
- [ ] 缓存 AI 生成的路线
- [ ] 添加错误恢复机制
- [ ] 优化 Prompt 获得更好结果

---

## 📞 需要帮助？

**检查清单：**
1. API Key 是否正确复制？
2. `.env.local` 是否在项目根目录？
3. 开发服务器是否重启过？
4. 浏览器 Console 中是否有错误信息？

**调试命令：**
```bash
# 查看环境变量是否正确
echo $VITE_API_KEY

# 重启 npm 开发服务器
npm run dev

# 查看所有环境变量
env | grep VITE
```

---

**恭喜！你现在已经配好了 AI 驱动的路线推荐系统！🎉**
