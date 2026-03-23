import { supabase } from '../utils/supabaseClient';
import { generateRoutesWithAI, rankRoutesWithAI } from './geminiService';

// ============================================================================
// 类型定义
// ============================================================================

export interface Segment {
  id: string;
  name: string;
  description?: string;
  region: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  distance: number; // km
  duration_minutes: number;
  elevation_gain: number;
  elevation_loss: number;
  start_point: { lat: number; lng: number };
  end_point: { lat: number; lng: number };
  coordinates: [number, number][]; // [[lat, lng], ...]
  tags: string[]; // ["scenic", "forest", "beginner_friendly", ...]
  best_seasons?: string[];
  highlights?: string[];
  is_published: boolean;
  popularity_score?: number;
}

export interface RouteSegment {
  segment_id: string;
  segment_name: string;
  segment_order: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  distance: number;
  duration_minutes: number;
  elevation_gain: number;
  tags: string[];
  highlights?: string[];
  coordinates: [number, number][];
  is_connected?: boolean;
  connection_distance?: number;
}

export interface ComposedRoute {
  id: string;
  name: string;
  description?: string;
  region: string;
  is_segment_based: true;
  total_distance: number;
  total_duration_minutes: number;
  total_elevation_gain: number;
  difficulty_level: 1 | 2 | 3 | 4 | 5;
  tags: string[]; // 所有 segments 的 tags 并集
  segments: RouteSegment[];
  created_by: string;
  created_at: string;
  imageUrl?: string;
  full_coordinates?: [number, number][];
}

export interface UserHikingPreferences {
  mood: 'Energetic' | 'Peaceful' | 'Adventurous' | 'Scenic' | 'peaceful' | 'scenic' | 'social' | 'challenging' | 'adventurous';
  difficulty: 'easy' | 'medium' | 'hard';
  condition: string; // 用户输入的状态描述，例如："Well-rested, had coffee, feeling strong"
  availableTime?: number; // 分钟
  maxDistance?: number; // km
  season?: string;
  isSegmentBased?: boolean;
}

export interface RouteMatchScore {
  routeId: string;
  routeName: string;
  matchScore: number; // 0-100
  matchReasons: string[];
  segments?: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  difficulty: number;
  tags?: string[];
}

// ============================================================================
// AI 标签匹配引擎
// ============================================================================

export function userPreferencesToTags(prefs: UserHikingPreferences): string[] {
  const tags: Set<string> = new Set();

  // 根据 mood 添加标签
  switch (prefs.mood) {
    case 'Energetic':
      tags.add('workout');
      tags.add('adventurous');
      tags.add('steep');
      break;
    case 'Peaceful':
      tags.add('quiet');
      tags.add('shaded');
      tags.add('forest');
      break;
    case 'Adventurous':
      tags.add('rocky');
      tags.add('mountain_peak');
      tags.add('adventurous');
      break;
    case 'Scenic':
      tags.add('scenic');
      tags.add('photo_spot');
      tags.add('water_view');
      tags.add('sunset_spot');
      break;
  }

  // 根据 difficulty 添加标签
  switch (prefs.difficulty) {
    case 'easy':
      tags.add('beginner_friendly');
      tags.add('family_friendly');
      break;
    case 'medium':
      // no specific tag
      break;
    case 'hard':
      tags.add('adventurous');
      tags.add('steep');
      break;
  }

  // 从 condition 中提取关键词匹配标签
  const conditionLower = prefs.condition.toLowerCase();
  const keywordMap: { [key: string]: string[] } = {
    'photo|picture|camera|photograph': ['photo_spot', 'scenic'],
    'quiet|peaceful|alone|solitude': ['quiet', 'shaded'],
    'flower|bloom|wildflower': ['wildflowers'],
    'sunrise|morning': ['sunrise_spot'],
    'sunset|evening': ['sunset_spot'],
    'family|kid|child': ['family_friendly'],
    'water|river|coast|beach|sea|ocean': ['water_view', 'coastal'],
    'history|historic|cultural|temple|church': ['historic'],
    'urban|city|civilization': ['urban'],
    'workout|exercise|cardio': ['workout'],
    'beginner|easy|simple': ['beginner_friendly'],
    'challenge|difficult|hard': ['adventurous'],
  };

  for (const [pattern, matchTags] of Object.entries(keywordMap)) {
    if (new RegExp(pattern).test(conditionLower)) {
      matchTags.forEach(tag => tags.add(tag));
    }
  }

  return Array.from(tags);
}

export function calculateTagSimilarity(tags1: string[], tags2: string[]): number {
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function scoreRoute(
  route: ComposedRoute,
  userPrefs: UserHikingPreferences,
  userTags: string[]
): RouteMatchScore {
  const reasons: string[] = [];
  let score = 50; // 基础分数

  // 1. 标签匹配度 (40 分)
  const tagSimilarity = calculateTagSimilarity(route.tags, userTags);
  const tagScore = tagSimilarity * 40;
  score += tagScore;
  if (tagSimilarity > 0.6) {
    reasons.push(`High Tag Match (${Math.round(tagSimilarity * 100)}%)`);
  }

  // 2. 难度匹配度 (20 分)
  const difficultyMap = { easy: 1, medium: 3, hard: 5 };
  const userDiffLevel = difficultyMap[userPrefs.difficulty];
  const diffDelta = Math.abs(route.difficulty_level - userDiffLevel);
  const diffScore = Math.max(0, 20 - diffDelta * 4);
  score += diffScore;

  if (diffDelta <= 1) {
    reasons.push('Difficulty Match');
  }

  // 3. 可用时间检查 (10 分)
  if (userPrefs.availableTime && route.total_duration_minutes <= userPrefs.availableTime) {
    score += 10;
    reasons.push('Fits Duration');
  }

  // 4. 距离限制检查 (10 分)
  if (userPrefs.maxDistance && route.total_distance <= userPrefs.maxDistance) {
    score += 10;
    reasons.push('Fits Distance');
  }

  // 5. 热门度加分 (10 分，可选)
  const avgPopularity =
    route.segments.reduce((sum, seg) => sum + (seg.highlights?.length || 0), 0) /
    (route.segments.length || 1);
  const popularityScore = Math.min(5, avgPopularity);
  score += popularityScore;

  // 确保分数在 0-100 之间
  score = Math.min(100, Math.max(0, score));

  return {
    routeId: route.id,
    routeName: route.name,
    matchScore: Math.round(score),
    matchReasons: reasons,
    segments: route.segments,
    totalDistance: route.total_distance,
    totalDuration: route.total_duration_minutes,
    difficulty: route.difficulty_level,
    tags: route.tags
  };
}

// ============================================================================
// 数据库查询函数
// ============================================================================

export async function fetchPublishedSegments(): Promise<Segment[]> {
  try {
    // Try to fetch from backend segments first
    const { data: backendData, error: backendError } = await supabase
      .from('segments_backend')
      .select('*')
      .order('region', { ascending: true });

    if (!backendError && backendData && backendData.length > 0) {
      return backendData as Segment[];
    }

    // Fallback to standard segments table
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .order('region', { ascending: true });

    if (error) {
      console.warn('Error fetching segments:', error);
      return [];
    }

    return data as Segment[];
  } catch (error) {
    console.error('Error fetching segments:', error);
    return [];
  }
}

/**
 * Manually fetch and construct ComposedRoutes from tables
 * Supports both standard tables and '_backend' suffixed tables from CSV imports
 */
export async function fetchAllRoutesFromDB(): Promise<ComposedRoute[]> {
  try {
    // 1. Fetch all recommended routes (try new backend table first)
    let routesData: any[] = [];
    let { data: rData, error: rError } = await supabase.from('official_trails_backend').select('*');
    
    if (rError || !rData || rData.length === 0) {
       // Fallback to legacy table
       const res = await supabase.from('recommended_routes').select('*');
       rData = res.data;
       rError = res.error;
    }
    
    if (rError) {
      console.warn('Error fetching recommended_routes:', rError);
    }
    routesData = rData || [];

    if (routesData.length === 0) return [];

    // 2. Fetch all route segments (try _backend first)
    // Support multiple possible column names for the trail/route reference
    const routeIds = routesData.map(r => r.id);
    let routeSegmentsData: any[] = [];
    let connectionTrailIdCol = 'trail_id'; // will detect below

    // Fetch ALL connections to avoid .in limits/issues
    let { data: rsData, error: rsError } = await supabase
      .from('official_connection_backend')
      .select('*');

    let connectionSegmentIdCol = 'segment_id';

    if (!rsError && rsData && rsData.length > 0) {
      // Detect column names dynamically
      const firstRow = rsData[0];
      const keys = Object.keys(firstRow);
      
      // Find the trail ID column (matches one of our routeIds)
      const potentialTrailCols = ['trail_id', 'route_id', 'official_trail_id', 'id'];
      connectionTrailIdCol = potentialTrailCols.find(col => keys.includes(col)) || keys.find(k => k.includes('trail') || k.includes('route')) || 'trail_id';
      
      // Find the segment ID column
      const potentialSegCols = ['segment_id', 'segments_backend_id', 'seg_id'];
      connectionSegmentIdCol = potentialSegCols.find(col => keys.includes(col)) || keys.find(k => k.includes('segment')) || 'segment_id';

    } else {
      // Fallback to legacy table
      const res = await supabase
        .from('route_segments')
        .select('*')
        .order('sort_order');
      rsData = res.data;
      rsError = res.error;
      connectionTrailIdCol = 'route_id';
    }

    if (rsError) {
        console.warn('Error fetching route_segments:', rsError);
    }
    routeSegmentsData = rsData || [];

    // 3. Fetch all segments (try _backend first)
    let segmentsData: any[] = [];
    let { data: sData, error: sError } = await supabase
    .from('segments_backend')
    .select('*');
    
    if (sError || !sData || sData.length === 0) {
        const res = await supabase
        .from('segments')
        .select('*');
        sData = res.data;
        sError = res.error;
    }
    
    if (!sError && sData) segmentsData = sData;

    // 4. Construct ComposedRoutes
    const segmentsMap = new Map(segmentsData.map(s => [s.id, s]));
    
    const composedRoutes: ComposedRoute[] = routesData.map(route => {
      // Find segments for this route - use detected column name
      // Detect the order column from the first connection record
      const orderCol = routeSegmentsData.length > 0
        ? (['sort_order', 'order', 'sequence', 'order_num'].find(c => routeSegmentsData[0][c] !== undefined) || 'sort_order')
        : 'sort_order';

      const routeSegs = routeSegmentsData
        // We use loose equality here because some IDs might be numbers vs strings
        .filter(rs => String(rs[connectionTrailIdCol]) === String(route.id))
        .sort((a, b) => (a[orderCol] ?? 0) - (b[orderCol] ?? 0))
        .map(rs => {
          const segId = rs[connectionSegmentIdCol];
          const seg = segmentsMap.get(segId) || Array.from(segmentsMap.values()).find(s => String(s.id) === String(segId));
          if (!seg) return null;
          
          // Map segment fields, handling potential differences in column names
          // e.g., distance_km vs distance, slope vs difficulty
          let parsedCoordinates: [number, number][] = [];
          
          try {
              let rawJson = seg.coordinates;
              if (typeof rawJson === 'string') {
                  rawJson = JSON.parse(rawJson);
              }
              
              // Handle GeoJSON format { type: "LineString", coordinates: [...] }
              const rawCoords = rawJson.coordinates || rawJson;
              
              if (Array.isArray(rawCoords)) {
                  parsedCoordinates = rawCoords.map((pt: any) => {
                      // Ensure it's [number, number]
                      if (Array.isArray(pt) && pt.length >= 2) {
                          const [v1, v2] = pt;
                          // Heuristic for Leaflet [lat, lng]: Lat is usually -90 to 90. Lng -180 to 180.
                          // If first value is > 90 (e.g. 114 for HK), it's Longitude. Swap it.
                          if (Math.abs(v1) > 90 && Math.abs(v2) <= 90) {
                              return [v2, v1]; // Swap to [lat, lng]
                          }
                          return [v1, v2];
                      }
                      return [0, 0];
                  });
              }
          } catch (e) {
              console.warn('Failed to parse coordinates for segment', seg.id);
          }

          let tags: string[] = [];
          try {
            if (Array.isArray(seg.tags)) tags = seg.tags;
            else if (typeof seg.tags === 'string') tags = JSON.parse(seg.tags);
          } catch(e) { tags = []; }

          return {
            segment_id: seg.id,
            segment_name: seg.name,
            segment_order: rs[orderCol] || 0,
            difficulty: seg.difficulty || seg.slope || 3, // Support alternate column names
            distance: seg.distance_km || seg.distance || 0,
            duration_minutes: seg.duration_minutes || (seg.distance_km || seg.distance || 0) * 15,
            elevation_gain: seg.elevation_gain || 0,
            tags: tags,
            coordinates: parsedCoordinates,
          } as RouteSegment;
        })
        .filter((s): s is RouteSegment => s !== null);

      // Calculate totals
      const totalDistance = routeSegs.reduce((sum, s) => sum + s.distance, 0);
      const totalDuration = routeSegs.reduce((sum, s) => sum + s.duration_minutes, 0);
      const totalElevation = routeSegs.reduce((sum, s) => sum + s.elevation_gain, 0);
      
      // Collect all tags
      const allTags = new Set<string>();
      try {
        let routeTags: string[] = [];
        if (Array.isArray(route.tags)) routeTags = route.tags;
        else if (typeof route.tags === 'string') routeTags = JSON.parse(route.tags);
        routeTags.forEach((t: string) => allTags.add(t));
      } catch (e) {}
      
      routeSegs.forEach(s => s.tags.forEach(t => allTags.add(t)));

      // Try to parse full trail geometry from route if available
      let fullRouteCoords: [number, number][] | undefined = undefined;
      try {
          const geom = (route as any).full_trail_geometry || (route as any).coordinates;
          if (geom) {
              let rawGeom = geom;
              if (typeof rawGeom === 'string') rawGeom = JSON.parse(rawGeom);
              
              // Handle MultiLineString (from KML/GPX imports)
              let rawCoords = rawGeom.coordinates || rawGeom;
              
              if (Array.isArray(rawCoords)) {
                  // If it's a MultiLineString, flatten it into a single LineString
                  if (rawGeom.type === 'MultiLineString' || (Array.isArray(rawCoords[0]) && Array.isArray(rawCoords[0][0]))) {
                     rawCoords = rawCoords.flat(1);
                  }
                  
                  fullRouteCoords = rawCoords.map((pt: any) => {
                      if (Array.isArray(pt) && pt.length >= 2) {
                          // Note: pt could be [lng, lat, elevation]
                          const [v1, v2] = pt;
                          if (Math.abs(v1) > 90 && Math.abs(v2) <= 90) {
                              return [v2, v1] as [number, number]; // Return [lat, lng]
                          }
                          return [v1, v2] as [number, number];
                      }
                      return [0, 0] as [number, number];
                  });
              }
          }
      } catch (e) {
          console.warn(`Error parsing geometry for route ${route.id}:`, e);
      }

      // 🚀 CRITICAL FIX: If the route is HK Trail (Full Walk), ALWAYS prefer merged segments
      // because the single LineString in official_trails_backend is often simplified/imprecise.
      // Also, for any segment-based route, merged segments are usually more accurate.
      const isHKTrailFull = String(route.id) === 'e0ff692e-0028-4eb0-9aef-9cf56624093f' || 
                           (route.name && route.name.includes('港岛径'));
      
      if (isHKTrailFull || !fullRouteCoords || (fullRouteCoords.length < 50 && routeSegs.length > 0)) {
        const merged = mergeSegmentCoordinates(routeSegs);
        // Only override if segments actually provide data
        if (merged.length > 0) {
           console.log(`Using merged segments for ${route.name} (${merged.length} points) instead of simplified trail geometry.`);
           fullRouteCoords = merged;
        }
      }

      return {
        id: route.id,
        name: route.name,
        description: route.description,
        region: 'Hong Kong',
        is_segment_based: true,
        total_distance: totalDistance || 0,
        total_duration_minutes: totalDuration || 0,
        total_elevation_gain: route.total_elevation || totalElevation || 0,
        difficulty_level: 3,
        tags: Array.from(allTags),
        segments: routeSegs,
        created_by: 'system',
        created_at: new Date().toISOString(),
        imageUrl: route.cover_url || route.cover_image,
        full_coordinates: fullRouteCoords,
      };
    });

    return composedRoutes;
  } catch (error) {
    console.error('Error constructing routes from DB:', error);
    return [];
  }
}

export async function fetchComposedRoutes(): Promise<ComposedRoute[]> {
  // Use manual construction from core tables (official_trails_backend, etc.)
  // This bypasses the need for routes_with_segments view which was causing 406 errors.
  return await fetchAllRoutesFromDB();
}

/**
 * Fetch a single composed route by ID, handling fallback logic
 */
export async function fetchRouteById(routeId: string): Promise<ComposedRoute | null> {
  // Fetch from the reconstructed list from core tables
  const allRoutes = await fetchAllRoutesFromDB();
  return allRoutes.find(r => String(r.id) === String(routeId)) || null;
}

/**
 * 根据用户输入，AI 匹配合适的路线
 */
export async function findMatchingRoutes(
  userPrefs: UserHikingPreferences,
  topN: number = 5
): Promise<RouteMatchScore[]> {
  try {
    // =============== 阶段一：使用 AI 动态生成 (优先级最高) ===============
    // User wants custom segment combinations ("Recommended Route 1", etc.), not just pre-defined trails.
    console.log('📡 Using AI to generate custom routes from segments...');
    
    const segments = await fetchPublishedSegments();
    let aiMatches: RouteMatchScore[] = [];

    if (segments.length > 0) {
        try {
            const aiGeneratedRoutes = await generateRoutesWithAI(
              segments,
              userPrefs.mood,
              userPrefs.difficulty,
              userPrefs.condition
            );
            
            if (aiGeneratedRoutes && aiGeneratedRoutes.length > 0) {
                const segmentsMap = new Map(segments.map(s => [s.id, s]));
                
                aiMatches = aiGeneratedRoutes.map((genRoute: any, index: number) => {
                    const routeSegments = (genRoute.segment_ids || genRoute.segments || [])
                        .map((segId: string, i: number) => {
                            const seg = segmentsMap.get(segId);
                            if (!seg) return null;
                            
                            // Handle coords if string
                            let coords: any = seg.coordinates;
                            try {
                                if (typeof coords === 'string') {
                                    coords = JSON.parse(coords);
                                }
                                coords = coords.coordinates || coords;
                                
                                // Swap if needed
                                if (Array.isArray(coords)) {
                                    coords = coords.map((pt: any) => {
                                        if (Array.isArray(pt) && pt.length >= 2) {
                                            const [v1, v2] = pt;
                                            if (Math.abs(v1) > 90 && Math.abs(v2) <= 90) {
                                                return [v2, v1]; 
                                            }
                                            return [v1, v2];
                                        }
                                        return [0, 0];
                                    });
                                }
                            } catch(e) {}

                            return {
                                segment_id: seg.id,
                                segment_name: seg.name,
                                segment_order: i + 1,
                                difficulty: seg.difficulty,
                                distance: seg.distance,
                                duration_minutes: seg.duration_minutes,
                                elevation_gain: seg.elevation_gain,
                                tags: seg.tags,
                                coordinates: coords,
                            } as RouteSegment;
                        })
                        .filter((s: RouteSegment | null) => s !== null);

                    if (routeSegments.length === 0) return null;

                    return {
                        routeId: `ai_gen_${Date.now()}_${index}`,
                        routeName: genRoute.name || `Recommended Route ${index + 1}`,
                        matchScore: 95 - (index * 2), // High score for custom generation
                        matchReasons: genRoute.reasons || ['Custom Segment Combination'],
                        segments: routeSegments,
                        totalDistance: genRoute.total_distance,
                        totalDuration: genRoute.total_duration,
                        difficulty: genRoute.difficulty,
                        tags: genRoute.tags || []
                    };
                }).filter((r: RouteMatchScore | null) => r !== null);
            }
        } catch (err) {
            console.error("AI Generation failed", err);
        }
    }

    // If we have AI matches, return them immediately (User prefers segment combinations)
    if (aiMatches.length > 0) {
        return aiMatches.slice(0, topN);
    }

    // =============== 阶段二：数据库降级方案 ===============
    // Only fetch DB routes if AI generation failed or returned nothing
    console.log('📦 AI failed, attempting to fetch routes from database...');
    const routes = await fetchComposedRoutes();
    let dbMatches: RouteMatchScore[] = [];

    if (routes.length > 0) {
      console.log(`✅ Found ${routes.length} routes in database`);
      
      // Attempt to rank with Gemini AI first
      try {
        console.log('🤖 Ranking routes with Gemini AI...');
        const rankedResults = await rankRoutesWithAI(
          routes,
          userPrefs.mood,
          userPrefs.difficulty,
          userPrefs.condition
        );

        if (rankedResults && rankedResults.length > 0) {
           // Merge AI results with route details
           dbMatches = rankedResults.map((aiResult: any) => {
             const originalRoute = routes.find(r => r.id === aiResult.routeId);
             if (!originalRoute) return null;
             
             return {
               routeId: originalRoute.id,
               routeName: originalRoute.name,
               matchScore: aiResult.matchScore || 80,
               matchReasons: aiResult.matchReasons || ['AI Recommended'],
               segments: originalRoute.segments,
               totalDistance: originalRoute.total_distance,
               totalDuration: originalRoute.total_duration_minutes,
               difficulty: originalRoute.difficulty_level,
               tags: originalRoute.tags
             } as RouteMatchScore;
           }).filter(r => r !== null);
        }
      } catch (aiError) {
        console.warn('AI ranking failed, falling back to local scoring', aiError);
      }

      if (dbMatches.length === 0) {
          // Fallback: Local scoring
          const userTags = userPreferencesToTags(userPrefs);
          const scores = routes.map(route => scoreRoute(route, userPrefs, userTags));
          dbMatches = scores.sort((a, b) => b.matchScore - a.matchScore).slice(0, topN);
      }
    }

    return dbMatches;
    
  } catch (error) {
    console.error('❌ Error in findMatchingRoutes:', error);
    return [];
  }
}

// Helper to merge coordinates for display - ensure head-to-tail connection
export function mergeSegmentCoordinates(segments: RouteSegment[]): [number, number][] {
  if (!segments || segments.length === 0) return [];
  
  let merged: [number, number][] = [];
  
  segments.forEach((seg, i) => {
    let segCoords = [...seg.coordinates];
    if (segCoords.length === 0) return;

    if (i > 0 && merged.length > 0) {
      const lastPoint = merged[merged.length - 1];
      const segFirstPoint = segCoords[0];
      const segLastPoint = segCoords[segCoords.length - 1];

      // Calculate distance from lastPoint to segFirstPoint (squared)
      const distToFirstSq = Math.pow(lastPoint[0] - segFirstPoint[0], 2) + Math.pow(lastPoint[1] - segFirstPoint[1], 2);
      // Calculate distance from lastPoint to segLastPoint (squared)
      const distToLastSq = Math.pow(lastPoint[0] - segLastPoint[0], 2) + Math.pow(lastPoint[1] - segLastPoint[1], 2);

      // If the end of the segment is significantly closer to the current merged path end, 
      // reverse the segment so it connects head-to-tail.
      // (Using squared distance for performance, but comparing accurately).
      if (distToLastSq < distToFirstSq) {
        segCoords.reverse();
      }
      
      // 🚀 CRITICAL FIX: If even the closest point is too far (> 0.05 degrees, approx 5km),
      // it means there's a gap or the data is out of order. Do NOT append if it creates a long straight line.
      const minGapSq = Math.min(distToFirstSq, distToLastSq);
      if (minGapSq > 0.0025) { // 0.05^2 = 0.0025. 0.05 degrees is ~5.5km in HK.
         console.warn(`Large gap detected between segment ${i} and previous segments. Distance: ${Math.sqrt(minGapSq).toFixed(4)}`);
         // Heuristic: If it's a gap, we still append but at least we're aware. 
         // If it's the very first segment, check if it's far from "The Peak" (HK Trail start)
      }
    }
    
    merged = [...merged, ...segCoords];
  });

  return merged;
}

/**
 * Persist AI-generated routes to the database for the current user.
 * These routes are private and only visible to the generating user.
 */
export async function saveGeneratedRoutesForUser(
  userId: string,
  sessionId: string | null,
  userPrefs: UserHikingPreferences,
  generatedRoutes: RouteMatchScore[]
): Promise<void> {
  if (!userId) return;

  try {
    await supabase.from('generated_routes').insert([{ 
      user_id: userId,
      session_id: sessionId,
      user_prefs: userPrefs,
      generated_routes: generatedRoutes,
    }]);
  } catch (error) {
    console.warn('Failed to save generated routes:', error);
  }
}

/**
 * Upload a user-created route to the public shared collection.
 */
export async function uploadRouteToCommunity(
  userId: string,
  route: { name: string; description?: string; region?: string; tags?: any; route_data: any }
): Promise<void> {
  if (!userId) return;

  try {
    const { error } = await supabase.from('uploaded_routes').insert([{ 
      user_id: userId,
      name: route.name,
      description: route.description || null,
      region: route.region || null,
      tags: route.tags || null,
      route_data: route.route_data,
      is_published: true,
    }]);
    if (error) throw error;
  } catch (error) {
    console.warn('Failed to upload route to community:', error);
    throw error;
  }
}

/**
 * Fetch all published routes uploaded by the community.
 */
export interface HikingEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  location: string;
  location_name?: string;
  participants: number;
  imageUrl: string;
  trail_id?: string;
  description?: string;
  routeData?: ComposedRoute | null;
}

export async function fetchEvents(): Promise<HikingEvent[]> {
  const { data: events, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  const result: HikingEvent[] = [];
  for (const event of events) {
    let routeData = null;
    if (event.trail_id) {
       routeData = await fetchRouteById(event.trail_id);
    }

    const parseEventData = (raw: any) => {
      if (!raw) return null;
      if (typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return null;
    };

    const eventData = parseEventData(event.event_data);

    const parseStartDate = (data: any): Date | null => {
      if (!data || typeof data !== 'object') return null;
      const candidate =
        data.start_time ??
        data.startTime ??
        data.start_datetime ??
        data.startDateTime ??
        data.datetime ??
        data.date ??
        data.start_date ??
        null;
      if (candidate) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      if (data.date && data.time) {
        const combined = new Date(`${data.date} ${data.time}`);
        if (!Number.isNaN(combined.getTime())) return combined;
      }
      return null;
    };

    const startDateFromEventData = parseStartDate(eventData);
    const fallbackStartDate = event.event_date ? new Date(event.event_date) : (event.start_time ? new Date(event.start_time) : null);
    const chosenDate = startDateFromEventData || (fallbackStartDate && !Number.isNaN(fallbackStartDate.getTime()) ? fallbackStartDate : null);
    const formattedDate = chosenDate
      ? chosenDate.toLocaleString('en-US', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'TBD';
    
    result.push({
      id: event.id,
      title: event.title,
      type: event.type || 'activity',
      date: formattedDate,
      location: event.location_name || event.location,
      participants: event.current_participants || 0,
      imageUrl: event.image_url || `https://picsum.photos/400/200?random=${Math.random()}`,
      trail_id: event.trail_id,
      description: event.description,
      routeData: routeData
    });
  }
  
  return result;
}

export async function fetchUploadedRoutes(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('uploaded_routes')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching uploaded routes:', error);
      return [];
    }

    // Map to ComposedRoute structure as much as possible
    return data.map((record: any) => {
      const routeData = record.route_data || {};
      return {
        id: record.id,
        name: record.name,
        description: record.description,
        region: record.region || 'Hong Kong',
        total_distance: routeData.distance_val || parseFloat(routeData.distance) || 0,
        total_duration_minutes: routeData.duration_val || (parseFloat(routeData.duration) * 60) || 0,
        total_elevation_gain: routeData.elevationGain || 0,
        difficulty_level: routeData.difficulty || 3,
        tags: record.tags || [],
        is_segment_based: false,
        created_by: record.user_id,
        created_at: record.created_at,
        imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop', // Placeholder for now
        full_coordinates: routeData.coordinates || [], // 🆕 Grab coordinates directly
        waypoints: routeData.waypoints || [], // 🆕 Grab waypoints
        // Keep original data for reference
        original_data: routeData
      };
    });
  } catch (error) {
    console.error('Failed to fetch uploaded routes:', error);
    return [];
  }
}
