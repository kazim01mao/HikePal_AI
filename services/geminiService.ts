type QwenChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type QwenChatResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_MODEL =
  import.meta.env.VITE_QWEN_MODEL ||
  (typeof process !== "undefined" ? process.env.QWEN_MODEL : null) ||
  "qwen-plus";

const getQwenApiKey = (): string => {
  const apiKey =
    (typeof process !== "undefined" ? process.env.QWEN_API_KEY : null) ||
    import.meta.env.VITE_QWEN_API_KEY ||
    import.meta.env.VITE_API_KEY;

  if (!apiKey) {
    console.warn("⚠️ [QwenService] API Key is missing! AI features will be disabled.");
    console.warn("👉 To fix this: set 'QWEN_API_KEY' (server) or 'VITE_QWEN_API_KEY' (client).");
    throw new Error("API Key missing");
  }
  return apiKey;
};

/**
 * 通用 Qwen 请求函数（OpenAI 兼容格式）
 */
async function qwenRequest<T>(path: string, body: Record<string, any>): Promise<T> {
  const apiKey = getQwenApiKey();
  const response = await fetch(`${QWEN_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Qwen API Error (${response.status}): ${errText || response.statusText}`);
  }

  return (await response.json()) as T;
}

function extractFirstMessageText(resp: QwenChatResponse): string {
  return resp?.choices?.[0]?.message?.content || "";
}

export const generateHikingAdvice = async (
  userMessage: string,
  context: { 
    location: string; 
    route: string; 
    teammates: string[]; 
    routeInfo?: string;
    extraData?: any; // To include reminder_info, segments, etc.
  }
): Promise<string> => {
  try {
    try {
      getQwenApiKey();
    } catch (e) {
      return "⚠️ AI Guide is currently in offline mode (API Key missing). Please check environment variables.";
    }

    // System instruction to act as a hiking guide
    const systemInstruction = `You are HikePal AI, an expert hiking guide for Hong Kong trails. 
    Current User Context:
    - Location: ${context.location}
    - Route: ${context.route}
    - Team status: Hiking with ${context.teammates.join(', ')}
    ${context.routeInfo ? `- Route Knowledge Base:\n${context.routeInfo}` : ''}
    ${context.extraData ? `- Data from Database:\n${JSON.stringify(context.extraData)}` : ''}
    
    Provide concise, helpful safety and navigation advice based on the provided Knowledge Base and Database records. 
    If asked about toilets, water, exit points (bailouts), or specific trail highlights, check the Database records (like reminder_info) first. 
    If not covered there, be general but helpful.
    Keep responses short (under 100 words) as the user is currently hiking.`;

    const response = await qwenRequest<QwenChatResponse>("/chat/completions", {
      model: DEFAULT_QWEN_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
    });

    return extractFirstMessageText(response) || "Sorry, I couldn't get a clear signal on that.";
  } catch (error) {
    console.error("Qwen API Error:", error);
    return "I'm having trouble connecting to the network. Please check your signal.";
  }
};

/**
 * 🎯 使用 Gemini AI 自动组合 segments 生成最优路线
 * 
 * 【第一步：如何调用 Gemini API】
 * 1. getClient() 返回已初始化的 GoogleGenAI 实例
 * 2. ai.models.generateContent() 是核心API调用方法
 * 3. 参数包括：
 *    - model: 使用的模型名称 (gemini-3-flash-preview)
 *    - contents: 发送给AI的提示文本
 *    - config: 配置项（包括systemInstruction）
 */
export const generateRoutesWithAI = async (
  segments: any[], // 从数据库获取的所有segments
  userMood: string,
  userDifficulty: string,
  userCondition: string
): Promise<any[]> => {
  try {
    try {
      getQwenApiKey();
    } catch (e) {
      console.warn("Falling back to local route generation (API Key missing)");
      return []; // Return empty to trigger local DB fallback in segmentRoutingService
    }
    
    // 🆕 如果没有 segments，生成默认推荐路线
    if (!segments || segments.length === 0) {
      console.log('⚠️ No segments available, generating default recommendations...');
      return [
        {
          name: "Recommended Route 1",
          description: "A scenic hiking path with moderate difficulty",
          segment_ids: [],
          total_distance: 8,
          total_duration: 240,
          total_elevation_gain: 400,
          difficulty: 3,
          tags: ["scenic", "moderate"],
          reasons: ["Good for your preferences"]
        },
        {
          name: "Recommended Route 2",
          description: "A challenging route with great views",
          segment_ids: [],
          total_distance: 12,
          total_duration: 360,
          total_elevation_gain: 600,
          difficulty: 4,
          tags: ["challenging", "views"],
          reasons: ["Adventure-focused"]
        },
        {
          name: "Recommended Route 3",
          description: "An easy walking trail with relaxing atmosphere",
          segment_ids: [],
          total_distance: 5,
          total_duration: 150,
          total_elevation_gain: 150,
          difficulty: 2,
          tags: ["easy", "relaxing"],
          reasons: ["Perfect for casual hikers"]
        }
      ];
    }
    
    // 【第二步：准备数据给AI】
    // 将segments转换为AI易读的格式，精简以节省Token
    const segmentsInfo = segments.map(seg => ({
      id: seg.id,
      name: seg.name,
      diff: seg.difficulty, // 缩写
      dist: Math.round(seg.distance * 10) / 10, // 缩写
      dur: Math.round(seg.duration_minutes || seg.distance * 15), // 缩写
      elev: seg.elevation_gain || 0, // 缩写
      tags: Array.isArray(seg.tags) ? seg.tags.slice(0, 3) : [], // 限制标签数量
      // start_point/end_point 是关键，必须保留
      start: seg.start_point, 
      end: seg.end_point,
    })).slice(0, 60); // 增加限制到60个，覆盖更多路线可能性
    
    // 【第三步：构建 AI 提示词】
    // 让AI根据用户偏好和segment特性来组合segments
    const prompt = `You are a hiking route designer for Hong Kong. Generate 3-5 different hiking route combinations.

User Preferences:
- Mood: ${userMood}
- Difficulty Level: ${userDifficulty}
- Specific Condition: ${userCondition}

Available Trail Segments (total: ${segmentsInfo.length}):
${JSON.stringify(segmentsInfo, null, 2)}

IMPORTANT INSTRUCTIONS:
1. Generate EXACTLY 3-5 different route combinations.
2. Focus on stitching segments together to form a coherent journey. 
3. Preference: Head-to-tail connected segments (where one segment's end is near another's start) are better than a single isolated segment.
4. Each combination should be unique.
5. Each route should have a simple name like "Recommended Route 1", "Recommended Route 2", etc.
>>>>+++ REPLACE

5. Always include the route index number in the name (e.g., Route 1, Route 2, Route 3)
6. Estimate distance and duration accurately

Return ONLY a valid JSON array, no other text:
[
  {
    "name": "Recommended Route 1",
    "description": "Short description of the route combination",
    "segment_ids": ["id1", "id2"] or [] if single segment,
    "total_distance": estimated_km_number,
    "total_duration": estimated_minutes_number,
    "total_elevation_gain": estimated_meters_number,
    "difficulty": 1-5 scale,
    "tags": ["tag1", "tag2"],
    "reasons": ["reason1", "reason2"] (keep reasons extremely short, concise keywords only, 1-3 words max, e.g. "Scenic Views", "Perfect Length")
  }
]`;

    // 【第四步：调用 Qwen API】
    console.log('📡 Calling Qwen API to generate routes...');
    
    const response = await qwenRequest<QwenChatResponse>("/chat/completions", {
      model: DEFAULT_QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, // 创意度 (0-1)，值越高结果越随机
      max_tokens: 3000, // 增加输出长度限制
    });

    const responseText = extractFirstMessageText(response) || '[]';
    console.log('✅ Qwen API Response:', responseText);
    
    // 【第五步：解析 AI 响应】
    // AI返回的是JSON字符串，需要解析
    try {
      // 提取JSON数组（处理AI可能返回的额外文本）
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      let routesData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      // 🆕 验证并修正返回的路线
      if (!Array.isArray(routesData)) {
        console.error('Invalid routes data format, using fallback');
        routesData = [];
      }
      
      // 🆕 确保至少有 1 个路线，最多 5 个
      if (routesData.length === 0) {
        console.warn('No routes generated, using default recommendations');
        return [];
      }
      
      // 🆕 标准化路线名字 - 确保使用 "Recommended Route N" 格式
      const normalizedRoutes = routesData.slice(0, 5).map((route: any, index: number) => ({
        name: route.name || `Recommended Route ${index + 1}`,
        description: route.description || 'A recommended hiking route',
        segment_ids: route.segment_ids || [],
        total_distance: route.total_distance || 0,
        total_duration: route.total_duration || 0,
        total_elevation_gain: route.total_elevation_gain || 0,
        difficulty: route.difficulty || 3,
        tags: route.tags || [],
        reasons: route.reasons || ['Matches your preferences']
      }));
      
      console.log(`✅ Generated ${normalizedRoutes.length} routes successfully`);
      return normalizedRoutes;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('🚨 Error calling Qwen API:', error);
    return [];
  }
};

/**
 * 🎯 使用 Gemini AI 评估现有路线与用户偏好的匹配度
 */
export const rankRoutesWithAI = async (
  routes: any[],
  userMood: string,
  userDifficulty: string,
  userCondition: string
): Promise<any[]> => {
  try {
    try {
      getQwenApiKey();
    } catch (e) {
      return []; // Fallback to local scoring
    }
    
    // 简化 routes 数据，只包含关键信息
    const routesInfo = routes.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      difficulty: r.difficulty_level,
      distance: r.total_distance,
      elevation: r.total_elevation_gain,
      tags: r.tags,
      region: r.region
    }));

    const prompt = `You are an expert hiking guide for Hong Kong.
    
User Profile:
- Mood: ${userMood}
- Difficulty: ${userDifficulty}
- Current Condition: ${userCondition}

Available Routes:
${JSON.stringify(routesInfo, null, 2)}

Task: Select and rank the top 3-5 routes that best match the user's profile.
Return ONLY a valid JSON array of objects with the following structure:
[
  {
    "routeId": "string",
    "matchScore": number (0-100),
    "matchReasons": ["string", "string"] (keep these very short, 1-3 words max, as keywords or tags. e.g. "Scenic Views", "Perfect Length")
  }
]`;

    const response = await qwenRequest<QwenChatResponse>("/chat/completions", {
      model: DEFAULT_QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const text = extractFirstMessageText(response);
    if (!text) return [];
    
    try {
      // 尝试解析 JSON
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']') + 1;
      if (jsonStart === -1 || jsonEnd === 0) return [];
      
      const jsonStr = text.substring(jsonStart, jsonEnd);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse Qwen response as JSON:", e);
      return [];
    }
  } catch (error) {
    console.error("Qwen AI Ranking Error:", error);
    return [];
  }
};

/**
 * 🎯 使用 Gemini AI 根据路线数据和周边信息生成亮点总结
 */
export const generateRouteHighlights = async (
  routeName: string,
  routeDescription: string,
  reminders: any[]
): Promise<string> => {
  try {
    try {
      getQwenApiKey();
    } catch (e) {
      return "Scenic views and fresh air along the trail.";
    }
    
    const prompt = `You are a professional hiking guide. Based on the trail information and points of interest below, generate 3-5 high-quality "Route Highlights".
    Each highlight should be a short, punchy sentence (max 15 words) with an appropriate emoji.
    
    Trail: ${routeName}
    Description: ${routeDescription}
    POI Data (from database):
    ${reminders.map(r => `- ${r.name} (${r.category}): ${r.ai_prompt}`).join('\n')}
    
    Format the output as a simple bulleted list. 
    Focus on variety: mention scenery, facilities (like toilets/water), and safety/difficulty if relevant.`;

    const response = await qwenRequest<QwenChatResponse>("/chat/completions", {
      model: DEFAULT_QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return extractFirstMessageText(response) || "Scenic views and fresh air along the trail.";
  } catch (error) {
    console.error("Qwen Highlights Error:", error);
    return "Beautiful trail with local points of interest.";
  }
};

/**
 * 兼容旧调用：简单 prompt -> 文本输出
 */
export const callGeminiAPI = async (prompt: string): Promise<string> => {
  try {
    const response = await qwenRequest<QwenChatResponse>("/chat/completions", {
      model: DEFAULT_QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    return extractFirstMessageText(response) || "";
  } catch (error) {
    console.error("Qwen API Error (callGeminiAPI):", error);
    throw error;
  }
};
