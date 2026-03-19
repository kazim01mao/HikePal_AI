// ============================================================================
// INTEGRATION GUIDE: Segment-Based Route System
// ============================================================================

/**
 * 这个文件解释如何在 PlanningView.tsx 中集成新的 segment-based routing 系统
 * 
 * 核心思想：
 * 1. 用户输入 mood/difficulty/condition
 * 2. AI 分析用户输入，转换为 search tags
 * 3. 从数据库获取所有 published segments，组合成 routes
 * 4. 对每个 route 评分，返回最匹配的前 N 条
 * 5. 用户选择路线后，记录这个匹配结果供 AI 学习
 */

// ============================================================================
// 第一步：修改 PlanningView 的导入
// ============================================================================

// 在 PlanningView.tsx 顶部添加：
import {
  findMatchingRoutes,
  userPreferencesToTags,
  UserHikingPreferences,
  RouteMatchScore,
  mergeSegmentCoordinates,
  ComposedRoute,
} from '../services/segmentRoutingService';

// ============================================================================
// 第二步：修改 PlanningView 的 state
// ============================================================================

// 找到这一行：
// const [aiMatched, setAiMatched] = useState(false);

// 替换为：
interface AISearchState {
  isSearching: boolean;
  matchedRoutes: RouteMatchScore[];
  userPrefs: UserHikingPreferences | null;
  selectedRouteId: string | null;
}

const [aiSearchState, setAiSearchState] = useState<AISearchState>({
  isSearching: false,
  matchedRoutes: [],
  userPrefs: null,
  selectedRouteId: null,
});

// ============================================================================
// 第三步：修改 handleAIRouteSearch 函数
// ============================================================================

/**
 * 新的 AI 路由搜索函数
 * 使用 segment-based routing 系统替代旧的 filteredRoutes 逻辑
 */
const handleAIRouteSearch = async () => {
  if (!aiMood || !aiDifficulty) {
    alert('Please select mood and difficulty level');
    return;
  }

  // 1. 创建用户偏好对象
  const userPrefs: UserHikingPreferences = {
    mood: aiMood as any,
    difficulty: aiDifficulty as any,
    condition: aiCondition,
    availableTime: 300, // 5 hours by default
    maxDistance: 20, // km
  };

  // 2. 开始搜索
  setAiSearchState(prev => ({
    ...prev,
    isSearching: true,
    userPrefs,
  }));

  try {
    // 3. 调用 AI 匹配函数
    const matches = await findMatchingRoutes(userPrefs, 5);

    // 4. 保存结果
    setAiSearchState(prev => ({
      ...prev,
      isSearching: false,
      matchedRoutes: matches,
    }));

    // 5. 可选：保存搜索历史到数据库（用于 AI 学习）
    if (currentUserId) {
      await savePrefSearchHistory({
        user_id: currentUserId,
        user_mood: aiMood,
        user_difficulty: aiDifficulty,
        user_condition: aiCondition,
        matched_routes: matches.map(m => ({
          route_id: m.routeId,
          match_score: m.matchScore,
          reason: m.matchReasons.join(', '),
        })),
      });
    }
  } catch (error) {
    console.error('Error in AI route search:', error);
    alert('Error finding routes. Please try again.');
    setAiSearchState(prev => ({
      ...prev,
      isSearching: false,
    }));
  }
};

// ============================================================================
// 第四步：修改 UI 部分 - 替换推荐路线列表
// ============================================================================

/**
 * 在 PlanningView 中找到这部分代码：
 * 
 * {/* Recommended Routes (only after matching) *\/}
 * {!aiMatched ? (
 *   <div>...</div>
 * ) : (
 *   <div>
 *     {filteredRoutes.map(...)}
 *   </div>
 * )}
 * 
 * 替换为下面的代码：
 */

// 显示匹配的路线
const matchedRoutes = aiSearchState.matchedRoutes;
const isSearching = aiSearchState.isSearching;

// 在 JSX 中：
{isSearching ? (
  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-6 text-center">
    <div className="inline-flex items-center gap-2 text-blue-900">
      <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-semibold">Finding your perfect route...</p>
    </div>
  </div>
) : matchedRoutes.length === 0 ? (
  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-4 text-center">
    <p className="text-blue-900 font-semibold text-sm">💡 Tap "Find My Perfect Route" to discover trails that match your mood and energy level.</p>
  </div>
) : (
  <div className="animate-fade-in">
    <div className="flex items-center gap-2 mb-4">
      <h3 className="font-bold text-gray-900 text-lg">✨ Routes Made for You</h3>
      <span className="text-xs bg-hike-green text-white px-2 py-1 rounded-full font-bold">
        {matchedRoutes.length} match
      </span>
    </div>
    <div className="space-y-3">
      {matchedRoutes.map((match, idx) => (
        <div
          key={match.routeId}
          onClick={() => {
            setAiSearchState(prev => ({
              ...prev,
              selectedRouteId: match.routeId,
            }));
            setActiveRouteId(match.routeId);
          }}
          className={`bg-white/80 backdrop-blur-sm rounded-2xl border-2 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98] transition-all duration-300 overflow-hidden flex ${
            aiSearchState.selectedRouteId === match.routeId
              ? 'border-hike-green bg-green-50'
              : 'border-gray-100 hover:border-hike-green/50'
          }`}
        >
          {/* 左侧：路线信息 */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-bold text-gray-900 text-base">{match.routeName}</h4>
              <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                {match.matchScore}%
              </div>
            </div>

            {/* 匹配原因 */}
            <div className="mb-3 flex flex-wrap gap-1">
              {match.matchReasons.map((reason, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-hike-green/20 text-hike-green px-2 py-0.5 rounded-full font-semibold"
                >
                  {reason}
                </span>
              ))}
            </div>

            {/* 路线统计 */}
            <div className="flex gap-4 text-xs text-gray-600 font-medium">
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {match.totalDistance.toFixed(1)} km
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {Math.round(match.totalDuration / 60)}h
              </span>
              <span className="flex items-center gap-1">
                <Mountain size={12} /> ⬆️ {match.difficulty}/5
              </span>
            </div>

            {/* Segment 预览 */}
            {match.segments && match.segments.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                  {match.segments.length} segments
                </p>
                <div className="flex gap-1 flex-wrap">
                  {match.segments.slice(0, 3).map((seg, i) => (
                    <span
                      key={i}
                      className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
                    >
                      {seg.segment_name}
                    </span>
                  ))}
                  {match.segments.length > 3 && (
                    <span className="text-[9px] text-gray-500 px-1">
                      +{match.segments.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：缩略图 */}
          <div className="w-24 h-24 flex-shrink-0 relative overflow-hidden bg-gray-200">
            <div className="w-full h-full bg-gradient-to-br from-hike-green/20 to-blue-200/20 flex items-center justify-center">
              <Mountain className="text-gray-400" size={32} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

// ============================================================================
// 第五步：添加保存搜索历史的函数（用于 AI 学习）
// ============================================================================

async function savePrefSearchHistory(data: {
  user_id: string;
  user_mood: string;
  user_difficulty: string;
  user_condition: string;
  matched_routes: Array<{
    route_id: string;
    match_score: number;
    reason: string;
  }>;
}) {
  try {
    const { error } = await supabase.from('ai_route_matches').insert([
      {
        user_id: data.user_id,
        user_mood: data.user_mood,
        user_difficulty: data.user_difficulty,
        user_condition: data.user_condition,
        matched_routes: data.matched_routes,
      },
    ]);

    if (error) throw error;
    console.log('Search history saved');
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

// ============================================================================
// 第六步：修改路线选择逻辑
// ============================================================================

/**
 * 当用户选择一个 route 时，需要：
 * 1. 记录这个选择
 * 2. 组合 segments 的坐标为完整路线
 * 3. 创建 hike_session 记录
 */

const handleSelectRoute = async (routeId: string) => {
  try {
    // 1. 获取完整的路线数据（包含所有 segments）
    const { data: routeData, error } = await supabase
      .from('routes_with_segments')
      .select('*')
      .eq('id', routeId)
      .single();

    if (error) throw error;

    // 2. 组合 segments 的坐标
    const mergedCoordinates = mergeSegmentCoordinates(routeData.segments);

    // 3. 创建完整的 route 对象供 Companion 使用
    const selectedRoute = {
      id: routeData.id,
      name: routeData.name,
      region: routeData.region,
      description: routeData.description,
      distance: routeData.total_distance.toString(),
      duration: `${Math.round(routeData.total_duration_minutes / 60)}h`,
      difficulty: routeData.difficulty_level,
      coordinates: mergedCoordinates,
      isUserPublished: false,
    };

    // 4. 记录选择
    if (aiSearchState.userPrefs && currentUserId) {
      await supabase.from('ai_route_matches').update({
        top_route_id: routeId,
        used_at: new Date().toISOString(),
      }).eq('user_id', currentUserId);
    }

    // 5. 调用回调，开始出行
    onSelectRoute?.(selectedRoute);
  } catch (error) {
    console.error('Error selecting route:', error);
    alert('Error loading route details');
  }
};

// ============================================================================
// 完整的 types.ts 更新
// ============================================================================

/**
 * 在 types.ts 中，添加：
 */

export interface RouteSegment {
  segment_id: string;
  segment_name: string;
  segment_order: number;
  difficulty: number;
  distance: number;
  duration_minutes: number;
  elevation_gain: number;
  tags: string[];
  highlights?: string[];
  coordinates: [number, number][];
}

export interface ComposedRoute extends Route {
  is_segment_based: true;
  total_distance: number;
  total_duration_minutes: number;
  total_elevation_gain: number;
  difficulty_level: number;
  segments?: RouteSegment[];
}

// ============================================================================
// 数据库迁移步骤
// ============================================================================

/**
 * 1. 在 Supabase 控制台执行 database_schema.sql 中的 SQL
 * 
 * 2. 初始化 segments 数据：
 *    - 使用 database_schema.sql 中的示例数据
 *    - 或者通过 API 导入现有的 trail data
 * 
 * 3. 验证数据完整性：
 *    - 每个 segment 的 end_point 应接近下一个 segment 的 start_point
 *    - 每个 segment 的 tags 应该准确标记其特点
 * 
 * 4. 创建初始的 template routes（由 segments 组成）：
 *    - Dragon's Back Classic
 *    - Harbor View Easy Walk
 *    等等
 */

// ============================================================================
// 性能优化建议
// ============================================================================

/**
 * 1. 缓存路线数据：
 *    - 使用 SWR 或 React Query 缓存 routes_with_segments 视图结果
 *    - 设置 revalidation interval 为 5 分钟
 * 
 * 2. 数据库索引：
 *    - 已在 schema 中创建了 GIN 索引用于 tags
 *    - 确保 difficulty 和 region 字段有索引
 * 
 * 3. 分页加载：
 *    - 如果 segments 很多，考虑分页加载
 *    - 使用 LIMIT/OFFSET 或 cursor-based pagination
 * 
 * 4. 前端缓存：
 *    - 在状态中缓存用户的最后一次搜索结果
 *    - 避免重复请求相同的搜索
 */

// ============================================================================
// 关键变更清单
// ============================================================================

/**
 * ✅ 修改项目：
 * 
 * 1. PlanningView.tsx
 *    - 导入 segmentRoutingService
 *    - 修改 state 结构
 *    - 替换 handleAIRouteSearch 函数
 *    - 替换推荐路线 UI
 *    - 添加 handleSelectRoute 函数
 * 
 * 2. types.ts
 *    - 添加 RouteSegment 接口
 *    - 添加 ComposedRoute 接口
 * 
 * 3. Supabase
 *    - 运行 database_schema.sql 创建表
 *    - 导入初始 segment 数据
 * 
 * 4. services/segmentRoutingService.ts（新文件）
 *    - 已创建，包含所有核心逻辑
 */

export {}; // Empty export to make this a module
