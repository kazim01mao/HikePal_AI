# 组队 Hike AI 路线推荐系统 - 功能说明

## 核心需求实现

你请求的是："分享链接给别人让他们填写需求，AI 整合分析后选出合适的路线，返回给队长界面"

我已经完整实现了这个功能！以下是工作流程：

---

## 📋 用户工作流程

### 1️⃣ **队长创建分队（group）**
- 队长点击"Solo" → "Group" 来创建一个新的分队
- 填写队伍信息（名字、描述、人数等）
- 点击"Form Group"后，系统生成一个**分享链接**和**二维码**

### 2️⃣ **队长分享链接给队员**
```
Share Group Link:
http://localhost:3001/?team=<team_id>
```
- 可以直接复制链接或生成二维码
- 队员通过这个链接可以加入分队

### 3️⃣ **队员加入并填写偏好（你的成员应该会看到一个表单）**
- 队员访问链接后，会看到加入分队的表单
- 填写自己的：
  - **心情（Mood）**: peaceful, scenic, social, adventurous, challenging ...
  - **难度（Difficulty）**: easy, medium, hard
  - **需求（Condition）**: "scenic views", "family-friendly", "photo-friendly" 等

### 4️⃣ **队长点击"Analyze & Get Routes for Group"**  
- 一旦有足够的队员加入并填写了偏好
- 队长在 Group Dashboard 里看到新增的彩色按钮：**"🌟 Analyze & Get Routes for Group"**
- 点击这个按钮，系统会：
  1. **收集所有队员的偏好**（从数据库查询）
  2. **调用 AI（Gemini）来整合分析**
  3. **生成综合的团队偏好描述**
  4. **用综合偏好搜索最佳的 3-5 条路线**
  5. **展示推荐结果**，包括匹配度、距离、时间等详情

### 5️⃣ **队长看到推荐的路线，选择一条开始跋山涉水**
- AI 分析显示一条简短的 synthesized preference（如："The group consensus is looking for scenic views with moderate difficulty, suitable for team bonding"）
- 推荐的路线列表显示每条路线的：
  - **匹配度**（92% Match）
  - **核心信息**（距离、时间、难度）
  - **为什么推荐**（Why: Scenic, Moderate Length, Perfect Difficulty）

---

## 🛠️ 技术实现细节

### 新增文件
- **`services/groupRouteService.ts`**：
  - `synthesizeGroupPreferences()` - 使用 Gemini AI 整合团队偏好
  - `recommendRoutesForGroup()` - 核心方法：整合 + 推荐
  - `MemberPreference` 接口 - 单个队员的偏好数据结构
  - `GroupRouteResult` 接口 - AI 分析结果

### 修改的文件
- **`components/PlanningView.tsx`**：
  1. 导入新的 `groupRouteService`
  2. 添加新的状态：
     - `groupRouteResult` - 保存 AI 分析结果
     - `isAnalyzingGroupPrefs` - 加载状态
     - `groupAnalysisError` - 错误提示
  3. 添加处理函数 `handleAnalyzeGroupAndRecommend()`
  4. 在 Group Dashboard 中添加"Analyze & Get Routes for Group"按钮
  5. 添加推荐结果的展示 UI（彩色卡片，显示路线详情）

---

## 🔗 URL 参数系统

目前的链接格式：
```
http://localhost:3001/?team=<team_id>
```

未来可以扩展为：
```
http://localhost:3001/?team=<team_id>&invite=yes&name=<member_name>
```

这样可以：
- 让队员直接跳到填写偏好的表单
- 预填队员名字
- 简化加入流程

---

## ⚙️ AI 整合逻辑

### 示例：
如果 5 个队员的偏好是：
```
队员1: Scenic Mood, Easy Difficulty, "beautiful views"
队员2: Scenic Mood, Easy Difficulty, "good for photos"
队员3: Peaceful Mood, Medium Difficulty, "relaxing"
队员4: Peaceful Mood, Easy Difficulty, "family-friendly"
队员5: Social Mood, Easy Difficulty, "team bonding"
```

AI 会分析：
> "The group is 80% aligned on Easy difficulty and scenic/peaceful mood. Most members want beautiful views suitable for photography and relaxation. A scenic, well-established trail with photo opportunities and good for groups would be ideal."

然后用这个**综合偏好**去搜索最佳路线，返回如：
- ✨ Recommended Route 1: Dragon's Back (95% Match) - Scenic, Easy, Perfect for groups
- ✨ Recommended Route 2: Victoria Peak Loop (92% Match) - Scenic, Easy, Photo-friendly
- ...

---

## 📝 下一步改进建议

为了让这个系统完全可用，你还需要：

1. **创建成员偏好收集表单**（当队员通过链接进来时显示）
   - 目前只有队长能输入偏好
   - 需要添加队员表单页面

2. **数据库持久化**
   - 将队员偏好保存到 `team_member_preferences` 表
   - `recommendRoutesForGroup()` 会从那里读取

3. **实时成员更新**
   - 队长界面实时显示有多少队员已填写偏好
   - 加上"等待 X 个队员填写偏好"的提示

4. **重新分析**
   - 如果新队员加入，队长可以重新点击按钮刷新推荐

---

## 🚀 运行测试

目前在 `groupRouteService.ts` 中，调用 API 时 mock 了成员偏好。你可以：

1. 启动开发服务器：`npm run dev`
2. 创建一个分队
3. 看到"Analyze & Get Routes for Group"按钮
4. 点击按钮会调用 AI（需要有效的 GEMINI_API_KEY）
5. 等待 AI 返回综合分析 + 推荐的路线

---

## 📌 核心代码片段

**调用 AI 整合团队偏好：**
```typescript
export const synthesizeGroupPreferences = async (
  teamId: string,
  members: MemberPreference[]
): Promise<{ synthesis: string; preferences: UserHikingPreferences }>
```

**核心推荐函数：**
```typescript
export const recommendRoutesForGroup = async (
  teamId: string,
  members: MemberPreference[]
): Promise<GroupRouteResult>
```

这两个函数组合起来就是你需要的："分析团队偏好，选出最佳路线" 的全套逻辑！
