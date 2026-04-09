# HikePal:  Hiking AI Assistant

[cite_start]**HikePal** 是一款基于生成式 AI 的远足辅助平台，旨在将传统的静态地图工具演进为主动、共情的数字伙伴 [cite: 165][cite_start]。本项目专注于解决群体登山决策冲突、动态安全风险以及社区参与感缺失等核心痛点，特别针对香港复杂的远足径网络进行了优化 [cite: 163, 168]。


## 🌟 核心功能 (Core Features)

* [cite_start]**智能行前规划引擎**：利用自然语言处理技术将用户偏好解码为情感向量，通过余弦相似度匹配最合适的路由，并提供 AI 生成的推荐理由 [cite: 166, 176]。
* **行中实时守护与 AI 伙伴**：
    * [cite_start]**上下文感知风险盾牌**：根据实时 GPS 提供位置相关的安全提醒（如陡峭边缘、信号弱区）[cite: 166, 210]。
    * [cite_start]**"Ask AI" 交互界面**：提供适应性的安全指导与文化地标介绍 [cite: 166, 232]。
* [cite_start]**情感足迹社区**：用户可以发布带有地理标签的“情感笔记”（照片+心情标签），参与 ESG 相关的社区活动（如龙脊净山行动）[cite: 166, 211, 240]。
* [cite_start]**分层路径系统**：支持官方路径与 AI 动态拼接的“生成式路径”，增强路线的灵活性 [cite: 195, 197]。

## 🏗️ 技术架构 (System Design)

[cite_start]项目采用三层模块化架构，确保实时协作与地理空间渲染的高效性 [cite: 170]：

| 层次 | 技术栈 | 核心职责 |
| :--- | :--- | :--- |
| **Presentation Layer** | React 18, TypeScript, Tailwind CSS, Zustand | [cite_start]响应式 UI、类型安全、全局状态同步（团队状态）[cite: 172, 173] |
| **Application Layer** | modular services (teamService, segmentRoutingService) | [cite_start]业务逻辑封装、坐标规范化、偏好聚合 [cite: 173, 174] |
| **Data & Geo Layer** | Supabase (PostgreSQL + PostGIS), Leaflet.js | [cite_start]空间数据库查询、实时数据订阅、离线地图瓦片加载 [cite: 174, 175, 180] |


## 📊 数据与方法论 (Data & Methodology)

1.  [cite_start]**数据采集**：从 Wikiloc 和 2Bulu 获取原始轨迹，经过清洗、格式标准化（GeoJSON）及属性增强（坡度、海拔）处理 [cite: 188, 191, 193]。
2.  [cite_start]**空间索引**：通过 PostGIS 实现高效的邻近探测，支持 hiker 与 100 多个兴趣点（POI）之间的实时交互 [cite: 203, 207]。
3.  [cite_start]**演示数据集**：涵盖香港岛核心区域超过 20 个细分路段，以及包含设施、文化和安全隐患的提醒数据库 [cite: 206, 207]。

## 🚀 快速开始 (Quick Start)

### 环境要求
* Node.js 18+
* Supabase Account (PostGIS enabled)

### 安装步骤
```bash
# 克隆仓库
git clone https://github.com/your-username/HikePal.git

# 安装依赖
npm install

# 配置环境变量 (.env)
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key

# 启动开发服务器
npm run dev
```

## 📈 未来展望 (Future Work)

* [cite_start]**IoT 生物识别集成**：通过可穿戴设备监测实时疲劳度 [cite: 248]。
* [cite_start]**多模态 AI**：支持更丰富的情感计算与交互模式 [cite: 248]。
* [cite_start]**范围扩张**：将地理范围从香港岛扩展至全港乃至全球远足径 [cite: 247]。

---

[cite_start]**Live Demo**: [https://hikepal-ai.netlify.app/](https://hikepal-ai.netlify.app/) [cite: 217]

[cite_start]*本项目为 HK POLYU GAH的Capstone 项目 [cite: 165]。* 创作人员为ERZHUO NIE and JUNYU MAO
