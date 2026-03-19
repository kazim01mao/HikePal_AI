import {
  findMatchingRoutes,
  userPreferencesToTags,
  UserHikingPreferences,
  RouteMatchScore,
  mergeSegmentCoordinates,
  ComposedRoute,
  scoreRoute,
  fetchRouteById,
  saveGeneratedRoutesForUser,
  fetchUploadedRoutes,
  fetchAllRoutesFromDB,
} from '../services/segmentRoutingService';
import { recommendRoutesForGroup, MemberPreference, type GroupRouteResult, getMemberPreferenceDetails } from '../services/groupRouteService';
import { fetchTeamMembers, fetchTeamProgress, subscribeToTeamProgress, type TeamProgress, type TeamMember } from '../services/teamMemberService';
import TeamDetailsView from './TeamDetailsView';
import PreferenceFormPanel, { PreferenceFormData } from './PreferenceFormPanel';
import React, { useState, useEffect, useRef } from 'react';
import { Route, HikingEvent, GroupHike, Track } from '../types';
import {
  MapPin,
  Download,
  Info,
  MessageSquare,
  Users,
  Calendar,
  ChevronRight,
  Star,
  Mountain,
  User,
  ArrowLeft,
  Plus,
  Flag,
  Recycle,
  ShieldAlert,
  Share2,
  Compass,
  Sparkles,
  Clock, 
  QrCode,
  Check,
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { 
  DRAGONS_BACK_COORDINATES, 
  HK_TRAIL_SECTION_1_COORDINATES,
  SECTION_2_COORDINATES,
  SECTION_3_COORDINATES,
  SECTION_4_COORDINATES,
  SECTION_5_COORDINATES,
  SECTION_6_COORDINATES,
  SECTION_7_COORDINATES
} from '../utils/trailData';

interface PlanningViewProps {
  routes?: Route[];
  onSelectRoute?: (route: Route & { teamId?: string }) => void;
  onCreateGroupHike?: (hike: GroupHike) => void;
  onJoinGroupHike?: (group: GroupHike) => void;
  onReviewTrack: (track: Track) => void;
  // 当前登录用户，用于写入 hike_sessions.user_id
  currentUserId?: string;
  // 确认出行后，通知上层开始 Companion（携带 sessionId）
  onGroupConfirmed?: (sessionId: string) => void;
  initialTeamId?: string; // 🆕 用于直接打开队伍详情
}

const MOCK_EVENTS: HikingEvent[] = [
    { id: 'e1', title: 'Dragon\'s Back Trash Cleanup', type: 'cleanup', date: 'Sat, 12 Oct', location: 'Shek O', participants: 45, imageUrl: 'https://picsum.photos/400/200?random=10' },
    { id: 'e2', title: 'Obstacle Clearing: Lantau Trail', type: 'maintenance', date: 'Sun, 13 Oct', location: 'Lantau', participants: 12, imageUrl: 'https://picsum.photos/400/200?random=11' },
    { id: 'e3', title: 'Trail Ribbon Placement Guide', type: 'guide', date: 'Sat, 19 Oct', location: 'Sai Kung', participants: 28, imageUrl: 'https://picsum.photos/400/200?random=12' },
];

const MOCK_NEARBY_GROUPS: GroupHike[] = [
  {
    id: 'g1',
    title: 'Peak Morning Walk',
    description: 'Intermediate group aiming for steady pace and photo breaks.',
    date: '2026-03-15',
    maxMembers: 5,
    currentMembers: 3,
    isOrganizer: false,
    members: ['Jason', 'Mei', 'Tom'],
    routeId: 'hk1',
    planned_duration: '3h',
    experience_level: 'occasional',
    initial_mood: 'Energetic',
  },
  {
    id: 'g2',
    title: 'Photography Slow Walk',
    description: 'Very slow, photo-friendly walk suitable for beginners.',
    date: '2026-03-20',
    maxMembers: 10,
    currentMembers: 8,
    isOrganizer: false,
    members: ['Lily', 'Ken', 'Sara', 'Leo'],
    routeId: 'hk2',
    planned_duration: '2h',
    experience_level: 'first_time',
    initial_mood: 'Peaceful',
  },
  {
    id: 'g3',
    title: 'Dragon\'s Back Challenge',
    description: 'A challenging hike for experienced hikers.',
    date: '2026-03-22',
    maxMembers: 7,
    currentMembers: 5,
    isOrganizer: false,
    members: ['John', 'Paul', 'George', 'Ringo'],
    routeId: 'hk8',
    planned_duration: '5h',
    experience_level: 'advanced',
    initial_mood: 'Adventurous',
  }
];

const MOCK_ROUTES: Route[] = [
  { 
    id: 'hk1', 
    name: 'HK Trail Sec 1: The Peak to Pok Fu Lam', 
    description: 'Starts at the Peak, offering panoramic city views before descending through lush forests to the reservoir.', 
    distance: '7.0km', 
    duration: '2h', 
    elevationGain: 120, 
    region: 'Hong Kong Island', 
    difficulty: 1, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Victoria_Peak_HK.jpg/800px-Victoria_Peak_HK.jpg'
  },
  { 
    id: 'hk2', 
    name: 'HK Trail Sec 2: Reservoir to Peel Rise', 
    description: 'A gentle section along catchwaters with views of Lamma Island and the southern coastline.', 
    distance: '4.5km', 
    duration: '1.5h', 
    elevationGain: 150, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Pok_Fu_Lam_Reservoir_6.jpg/800px-Pok_Fu_Lam_Reservoir_6.jpg'
  },
  { 
    id: 'hk3', 
    name: 'HK Trail Sec 3: Peel Rise to Wan Chai Gap', 
    description: 'Winding through Aberdeen Country Park, passing historical sites and dense woodland.', 
    distance: '6.5km', 
    duration: '2h', 
    elevationGain: 200, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Aberdeen_Upper_Reservoir_view.jpg/800px-Aberdeen_Upper_Reservoir_view.jpg'
  },
  { 
    id: 'hk4', 
    name: 'HK Trail Sec 4: Wan Chai to Wong Nai Chung', 
    description: 'Forested trail with glimpses of the northern skyline and Happy Valley.', 
    distance: '7.5km', 
    duration: '2h', 
    elevationGain: 180, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Bowen_Road_Trail_Happy_Valley.jpg/800px-Bowen_Road_Trail_Happy_Valley.jpg'
  },
  { 
    id: 'hk5', 
    name: 'HK Trail Sec 5: Mount Butler Challenge', 
    description: 'Steep climb over Jardine\'s Lookout and Mount Butler; offers the best 360-degree views on the island.', 
    distance: '4.0km', 
    duration: '1.5h', 
    elevationGain: 400, 
    region: 'Hong Kong Island', 
    difficulty: 4, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Mount_Butler_View.jpg/800px-Mount_Butler_View.jpg'
  },
  { 
    id: 'hk6', 
    name: 'HK Trail Sec 6: Butler to Tai Tam Tuk', 
    description: 'A mostly downhill section leading into the scenic Tai Tam valley and its historic dams.', 
    distance: '4.5km', 
    duration: '1.5h', 
    elevationGain: 80, 
    region: 'Hong Kong Island', 
    difficulty: 2, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Tai_Tam_Tuk_Reservoir_Dam.jpg/800px-Tai_Tam_Tuk_Reservoir_Dam.jpg'
  },
  { 
    id: 'hk7', 
    name: 'HK Trail Sec 7: Tai Tam to To Tei Wan', 
    description: 'Flat catchwater paths and shaded trails leading towards the Shek O peninsula.', 
    distance: '7.5km', 
    duration: '2h', 
    elevationGain: 100, 
    region: 'Hong Kong Island', 
    difficulty: 1, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Dragon%27s_Back_Trail.jpg/800px-Dragon%27s_Back_Trail.jpg'
  },
  { 
    id: 'hw', 
    name: 'High West Sunset Peak', 
    description: 'A steep detour from the Peak Circle Walk with incredible sunset views over the western islands.', 
    distance: '3.5km', 
    duration: '1.5h', 
    elevationGain: 200, 
    region: 'Hong Kong Island', 
    difficulty: 3, 
    startPoint: '{}', 
    endPoint: '{}',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/High_West_Hong_Kong.jpg/800px-High_West_Hong_Kong.jpg'
  },
];

const MOCK_REVIEWS = [
  { id: 1, user: 'John D.', date: '2 days ago', rating: 5, comment: 'Amazing views from the ridge! The descent to Big Wave Bay was a bit steep but worth it.', avatar: 'male' },
  { id: 2, user: 'Sarah M.', date: '1 week ago', rating: 4, comment: 'Great trail for a weekend hike. Highly recommend starting early to avoid the heat.', avatar: 'female' },
  { id: 3, user: 'Mike R.', date: '3 days ago', rating: 5, comment: 'One of the best trails in HK. Well-marked and great scenery.', avatar: 'male' },
  { id: 4, user: 'Emily L.', date: '5 days ago', rating: 4, comment: 'Beautiful scenery! The Peak section is always crowded but Section 1 is lovely.', avatar: 'female' }
];

const PlanningView: React.FC<PlanningViewProps> = ({
  routes = [], // 🆕 默认为空，避免闪烁 MOCK 数据
  onSelectRoute = (route: Route) => {},
  onCreateGroupHike = (hike: GroupHike) => {},
  onJoinGroupHike = (group: GroupHike) => {},
  onReviewTrack = (track: Track) => {},
  currentUserId = '',
  onGroupConfirmed = (sessionId: string) => {},
  initialTeamId
}) => {
  const [selectedCity] = useState('Hong Kong');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'routes' | 'start_hiking' | 'events'>('routes');
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  // Use state for official routes to support DB loading
  const [officialRoutes, setOfficialRoutes] = useState<Route[]>([]); // 🆕 初始为空
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]); // 🆕 初始为空
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true); // 🆕 添加加载状态

  // Add state for uploaded routes
  const [uploadedRoutes, setUploadedRoutes] = useState<Route[]>([]);
  const [showCommunityRoutes, setShowCommunityRoutes] = useState(false);

  useEffect(() => {
    if (initialTeamId) {
      // Fetch team data if starting with initialTeamId
      const fetchTeam = async () => {
        try {
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', initialTeamId).single();
          if (teamData) {
            const isCaptain = teamData.created_by === currentUserId;
            setIsLeader(isCaptain);
            
            // Sync current state
            const groupObj: GroupHike = {
              id: teamData.id,
              title: teamData.name,
              description: teamData.description,
              date: 'To be decided',
              maxMembers: teamData.max_team_size,
              currentMembers: teamData.team_size,
              isOrganizer: isCaptain,
              members: [],
              status: teamData.status,
              routeId: teamData.target_route_id
            };
            
            setCreatedGroup(groupObj);
            setShowTeamDetailsView(true);
            setStartSelection('group');
            setViewMode('start_hiking');

            // 🆕 If route already confirmed, also set the recommendation result so they see it
            if (teamData.target_route_id) {
               // Optional: fetch recommendation again or just show starting button
            }
          }
        } catch (e) {}
      };
      fetchTeam();
    }
  }, [initialTeamId, currentUserId]);

  useEffect(() => {
    const fetchCommunity = async () => {
        const routes = await fetchUploadedRoutes();
        if(routes && routes.length > 0) {
            // Convert ComposedRoute to Route
            const mappedRoutes: Route[] = routes.map(r => ({
                id: r.id,
                name: r.name,
                region: r.region || 'Unknown',
                distance: r.total_distance ? `${Number(r.total_distance).toFixed(1)}km` : '0km',
                duration: r.total_duration_minutes ? `${Math.round(r.total_duration_minutes/60)}h` : '0h',
                difficulty: r.difficulty_level || 3,
                description: r.description || '',
                startPoint: '',
                endPoint: '',
                elevationGain: r.total_elevation_gain || 0,
                imageUrl: r.imageUrl,
                isUserPublished: true,
                coordinates: r.full_coordinates,
                waypoints: (r as any).waypoints || [] // Pass waypoints directly
            } as any));
            setUploadedRoutes(mappedRoutes);
        }
    };
    fetchCommunity();
  }, []);

  // Fetch official trails from backend
  useEffect(() => {
    const loadOfficialRoutes = async () => {
      setIsLoadingRoutes(true);
      try {
        const dbRoutes = await fetchAllRoutesFromDB();
        if (dbRoutes && dbRoutes.length > 0) {
           console.log('DEBUG: dbRoutes[0]', dbRoutes[0]); // 调试日志
           const mappedRoutes: Route[] = dbRoutes.map(r => ({
                id: r.id,
                name: r.name,
                region: r.region || 'Unknown',
                distance: r.total_distance ? `${Number(r.total_distance).toFixed(1)}km` : '0km',
                duration: r.total_duration_minutes ? `${Math.round(r.total_duration_minutes/60)}h` : '0h',
                difficulty: r.difficulty_level || 3,
                description: r.description || '',
                startPoint: '',
                endPoint: '',
                elevationGain: r.total_elevation_gain || 0,
                // 极致健壮的图片映射：支持所有可能的字段名
                imageUrl: r.imageUrl || (r as any).cover_url || (r as any).cover_image || (r as any).cover_URL, 
                coordinates: r.full_coordinates
            }));
            console.log('DEBUG: mappedRoutes[0].imageUrl', mappedRoutes[0].imageUrl); // 调试日志
            setOfficialRoutes(mappedRoutes);
        } else {
            // 如果数据库没东西，最后才用 MOCK 作为兜底
            setOfficialRoutes(MOCK_ROUTES);
        }
      } catch (e) {
        console.error("Failed to load official routes", e);
        setOfficialRoutes(MOCK_ROUTES); // 报错也用 MOCK 兜底
      } finally {
        setIsLoadingRoutes(false);
      }
    };
    loadOfficialRoutes();
  }, []);

  // Start Hiking / AI Search State
  const [soloPreferences, setSoloPreferences] = useState<PreferenceFormData>({
    mood: '',
    difficulty: '' as any, // 🆕 无默认选项
    condition: '',
    availableTime: 0, // 🆕 无默认选项
    maxDistance: 0, // 🆕 无默认选项
  });

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
  // Start Hiking selection state: 'solo' | 'group' | 'join' | ''
  const [startSelection, setStartSelection] = useState<'solo'|'group'|'join'|''>('');
  const [createdGroup, setCreatedGroup] = useState<GroupHike | null>(null);
  const [showTeamDetailsView, setShowTeamDetailsView] = useState(!!initialTeamId); // 🆕 显示详细视图
  const [inviteCopied, setInviteCopied] = useState(false);
  const [teamIdInput, setTeamIdInput] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<''|'easy'|'medium'|'hard'>('');
  const [showTeamDetail, setShowTeamDetail] = useState(false);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(true);


  // Partner Form State
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSize, setGroupSize] = useState<number | ''>('');
  const [groupTime, setGroupTime] = useState('');
  const [groupMeetingPoint, setGroupMeetingPoint] = useState('');
  const [plannedDuration, setPlannedDuration] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'first_time' | 'occasional' | 'advanced' | ''>('');
  const [initialMood, setInitialMood] = useState('');
  const [nearbyGroups, setNearbyGroups] = useState<GroupHike[]>(MOCK_NEARBY_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<GroupHike | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Group Route Recommendation State
  const [groupRouteResult, setGroupRouteResult] = useState<GroupRouteResult | null>(null);
  const [isAnalyzingGroupPrefs, setIsAnalyzingGroupPrefs] = useState(false);
  const [groupAnalysisError, setGroupAnalysisError] = useState<string | null>(null);

  // 🆕 Team Members Progress Tracking
  const [teamProgress, setTeamProgress] = useState<TeamProgress | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeamProgress, setIsLoadingTeamProgress] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  // 🆕 Dashboard Polling for Captain & Preview Sync
  useEffect(() => {
    if (createdGroup?.id) {
       // Initial fetch
       refreshTeamDashboard();
       // Poll every 5 seconds
       const interval = setInterval(refreshTeamDashboard, 5000);
       return () => clearInterval(interval);
    }
  }, [createdGroup?.id]);

  const refreshTeamDashboard = async () => {
    if (!createdGroup) return;
    try {
      // 1. Fetch Progress Summary
      const progress = await fetchTeamProgress(createdGroup.id);
      setTeamProgress(progress);
      
      // 2. Fetch Detailed Member List (including preferences)
      const members = await fetchTeamMembers(createdGroup.id);
      setTeamMembers(members);

      // 3. Sync local state & Route status
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', createdGroup.id).single();
      
      if (progress) {
         setCreatedGroup(prev => prev ? ({
           ...prev,
           currentMembers: progress.total_members,
           members: members.map(m => m.user_name || m.user_email || 'Unknown'),
           status: teamData?.status || prev.status,
           routeId: teamData?.target_route_id || prev.routeId
         }) : null);
      }

      // If teammate is in preview mode and route gets confirmed, they should know
      if (!isLeader && teamData?.status === 'confirmed' && teamData.target_route_id && activeRouteId !== teamData.target_route_id) {
         // Auto-select confirmed route for teammate if they are in preview
         // But let's be careful not to override their current view if they are browsing
         console.log('📢 Team route confirmed by captain:', teamData.target_route_name);
      }
    } catch (e) {
      console.warn('Dashboard refresh failed', e);
    }
  };

  // 🆕 Group Organizer Preferences
  const [groupOrganizerPreferences, setGroupOrganizerPreferences] = useState<PreferenceFormData>({
    mood: '',
    difficulty: '' as any, // 🆕 无默认选项
    condition: '',
    availableTime: 0, // 🆕 无默认选项
    maxDistance: 0, // 🆕 无默认选项
  });
  const [showOrganizerPreferenceForm, setShowOrganizerPreferenceForm] = useState(false);

  const detailMapRef = useRef<HTMLDivElement>(null);
  const detailMapInstanceRef = useRef<any>(null);
  const reminderMarkersRef = useRef<any[]>([]);

  const [reminderInfo, setReminderInfo] = useState<any[]>([]);

  // Fetch reminder info once for map previews
  useEffect(() => {
    const loadMetadata = async () => {
      console.log('DEBUG: Fetching reminder_info...');
      
      // Try fetching using a direct select with PostGIS transformation
      // Note: Supabase/PostgREST doesn't directly support st_asgeojson in select strings 
      // without custom configuration. Since RPC failed, we will attempt another approach:
      // Fetching and then deciding if we need to parse.
      
      const { data: reminders, error } = await supabase
        .from('reminder_info')
        .select(`
          id,
          name,
          category,
          type,
          ai_prompt,
          risk_level,
          coordinates
        `);

      if (error) {
        console.error('DEBUG: Error fetching reminders:', error);
      } else if (reminders) {
        console.log('DEBUG: Reminders loaded:', reminders.length);
        setReminderInfo(reminders);
      }
    };
    loadMetadata();
  }, []);

  // Effect to update reminder markers on preview map when reminderInfo changes or map initializes
  useEffect(() => {
    const map = detailMapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || reminderInfo.length === 0) return;

    // Clear existing reminder markers from the preview map
    reminderMarkersRef.current.forEach(m => m.remove());
    reminderMarkersRef.current = [];

    const parseGeoPoint = (r: any): [number, number] | null => {
        // Handle GeoJSON format from RPC if present
        if (r.geojson) {
          let g = r.geojson;
          if (typeof g === 'string') {
             try { g = JSON.parse(g); } catch(e) {}
          }
          if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
            return [g.coordinates[1], g.coordinates[0]];
          }
        }

        // --- NEW: Detect and parse EWKB/Hex format from PostGIS directly ---
        // If the string starts with 0101... it's likely a Point in EWKB
        if (typeof r.coordinates === 'string' && /^[0-9A-Fa-f]{10,}/.test(r.coordinates)) {
           // We can't parse EWKB in pure JS without a library like 'terraformer-wkb-parser'
           // However, standard HK coordinates often look like this in the DB.
           // For a quick fix without adding new dependencies:
           // If it's the known hex format, we need to extract the coordinates.
           // Since we don't have a parser, let's try a heuristic or just log it.
           console.warn('DEBUG: Detected binary coordinate format, attempting to extract from hex:', r.coordinates.substring(0, 20));
           
           // Heuristic: Many WKB Points have the coordinates in the last few bytes
           // but it's not reliable. A better way is to fix the SQL to return GeoJSON.
           // Since RPC failed, we MUST fix the RPC or use a different endpoint.
        }
        
        // Fallback for JSON Point format
        const geoObj = r.coordinates;
        if (!geoObj) return null;
        if (geoObj.type === 'Point' && Array.isArray(geoObj.coordinates)) return [geoObj.coordinates[1], geoObj.coordinates[0]];
        if (typeof geoObj === 'string') {
          try {
            const parsed = JSON.parse(geoObj);
            if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) return [parsed.coordinates[1], parsed.coordinates[0]];
          } catch(e) {}
        }
        return null;
    };

    console.log('DEBUG: Updating preview map markers, reminderInfo count:', reminderInfo.length);
    reminderInfo.forEach(r => {
      const coords = parseGeoPoint(r);
      if (coords) {
        console.log(`DEBUG: Adding marker for ${r.name} at ${coords}`);
        const isRisk = r.category?.toLowerCase() === 'risk';
        const bgColor = isRisk ? '#EF4444' : '#3B82F6'; 
        const emoji = isRisk ? '⚠️' : 'ℹ️'; 
        
        let specificEmoji = emoji;
        const nameLower = r.name?.toLowerCase() || '';
        const promptLower = r.ai_prompt?.toLowerCase() || '';
        
        if (!isRisk) {
           if (nameLower.includes('toilet') || nameLower.includes('restroom')) specificEmoji = '🚻';
           else if (nameLower.includes('water')) specificEmoji = '💧';
           else if (nameLower.includes('rest') || nameLower.includes('pavilion')) specificEmoji = '🪑';
           else if (nameLower.includes('camp')) specificEmoji = '⛺';
        } else {
           if (nameLower.includes('slip') || promptLower.includes('slip')) specificEmoji = '🥾';
           else if (nameLower.includes('animal') || nameLower.includes('dog') || nameLower.includes('monkey')) specificEmoji = '🐕';
           else if (nameLower.includes('steep') || nameLower.includes('cliff')) specificEmoji = '⛰️';
           else if (nameLower.includes('sun') || nameLower.includes('heat')) specificEmoji = '☀️';
        }

        const remIcon = L.divIcon({ 
          html: `<div style="background-color: ${bgColor}; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 500;">${specificEmoji}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12]
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 200px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
               <span style="font-size: 16px;">${specificEmoji}</span>
               <strong style="color: ${bgColor}; font-size: 14px;">${r.name}</strong>
            </div>
            <div style="font-size: 12px; color: #4b5563; line-height: 1.4;">
               ${r.ai_prompt || (isRisk ? 'Please be careful in this area.' : 'Facility available here.')}
            </div>
          </div>
        `;

        const marker = L.marker(coords, { icon: remIcon, zIndexOffset: 2000 })
          .addTo(map)
          .bindPopup(popupContent, { closeButton: false });
        
        reminderMarkersRef.current.push(marker);
      }
    });
  }, [reminderInfo, detailMapInstanceRef.current, activeRouteId]);

  // Derive activeRoute from all possible sources
  const activeRoute = React.useMemo(() => {
    if (!activeRouteId) return null;
    
    // Check official routes
    const official = officialRoutes.find(r => r.id === activeRouteId);
    if (official) return official;
    
    // Check uploaded routes
    const uploaded = uploadedRoutes.find(r => r.id === activeRouteId);
    if (uploaded) return uploaded;
    
    // Check AI matches (which are RouteMatchScore format, need to be converted to Route format if used here)
    // Note: AI matches are usually handled separately in selectedRoute logic, 
    // but just in case, we check if there's a match. (Though they don't have full Route props by default).
    const aiMatch = aiSearchState.matchedRoutes.find(r => r.routeId === activeRouteId);
    if (aiMatch) {
       return {
          id: aiMatch.routeId,
          name: aiMatch.routeName,
          description: aiMatch.matchReasons.join('. '),
          region: 'Hong Kong',
          distance: `${aiMatch.totalDistance.toFixed(1)}km`,
          duration: `${Math.round(aiMatch.totalDuration / 60)}h`,
          difficulty: aiMatch.difficulty,
          startPoint: '{}', endPoint: '{}', elevationGain: 0,
          coordinates: mergeSegmentCoordinates(aiMatch.segments || []),
          segments: aiMatch.segments
       } as any;
    }
    
    // Check fallback props
    return routes.find(r => r.id === activeRouteId) || null;
  }, [activeRouteId, officialRoutes, uploadedRoutes, aiSearchState.matchedRoutes, routes]);

  // Ensure we scroll to top on major view changes, BUT keep position for route list
  useEffect(() => {
    // If we just opened a route detail or changed view mode, scroll to top
    // BUT if we are in 'routes' list view and haven't selected a route yet, stay put
    if (activeRouteId || (viewMode !== 'routes' && viewMode !== 'start_hiking') || showTeamDetailsView) {
      // 1. Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' });
      
      // 2. Find and scroll the app's main scrollable container
      const mainContainer = document.querySelector('main.flex-1.overflow-y-auto');
      if (mainContainer) {
        mainContainer.scrollTo({ top: 0, behavior: 'instant' });
      }

      // 3. Find and scroll any inner scrollable containers in PlanningView
      const innerContainers = document.querySelectorAll('.flex-1.overflow-y-auto');
      innerContainers.forEach(container => {
        container.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
  }, [viewMode, startSelection, showTeamDetailsView, activeRouteId]);

  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    if (!detailMapRef.current || !L || !activeRoute) return;

    if (detailMapInstanceRef.current) {
        detailMapInstanceRef.current.remove();
        detailMapInstanceRef.current = null;
    }

    const map = L.map(detailMapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        touchZoom: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    let coords: [number, number][] = [];
    
    // First try to use the route's own coordinates if it has them (important for AI routes)
    if (activeRoute.coordinates && Array.isArray(activeRoute.coordinates) && activeRoute.coordinates.length > 0) {
      coords = activeRoute.coordinates;
    } 
    // Fallback to mock coordinates for legacy/mock routes
    else if (activeRoute.id === 'hk8') {
        coords = DRAGONS_BACK_COORDINATES;
    } else if (activeRoute.id === 'hk7') {
        coords = SECTION_7_COORDINATES;
    } else if (activeRoute.id === 'hk1') {
        coords = HK_TRAIL_SECTION_1_COORDINATES;
    } else if (activeRoute.id === 'hk2') {
        coords = SECTION_2_COORDINATES;
    } else if (activeRoute.id === 'hk3') {
        coords = SECTION_3_COORDINATES;
    } else if (activeRoute.id === 'hk4') {
        coords = SECTION_4_COORDINATES;
    } else if (activeRoute.id === 'hk5') {
        coords = SECTION_5_COORDINATES;
    } else if (activeRoute.id === 'hk6') {
        coords = SECTION_6_COORDINATES;
    }

    if (coords.length > 0) {
        // Create a single polyline representing the whole trail with all coordinates
        const fullPolyline = L.polyline(coords, { 
            color: '#2E7D32', 
            weight: 6, 
            opacity: 0.8,
            smoothFactor: 1,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        // --- 📍 Optional: Highlight individual segments if available ---
        const routeData = (activeRoute as any);
        if (routeData.segments && routeData.segments.length > 0) {
            const colors = ['#2E7D32', '#1976D2', '#D32F2F', '#FBC02D', '#7B1FA2', '#0097A7'];
            
            routeData.segments.forEach((seg: any, i: number) => {
                if (seg.coordinates && seg.coordinates.length > 0) {
                    L.polyline(seg.coordinates, {
                        color: colors[i % colors.length],
                        weight: 6,
                        opacity: 0.9,
                        smoothFactor: 1,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(map);
                    
                    // Add segment label marker at middle point
                    const midIdx = Math.floor(seg.coordinates.length / 2);
                    const midPos = seg.coordinates[midIdx];
                    
                    const labelIcon = L.divIcon({
                        className: 'seg-label',
                        html: `<div class="bg-white/90 border-2 border-gray-400 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm whitespace-nowrap">${seg.segment_name || `Sec ${i+1}`}</div>`,
                        iconSize: [0, 0],
                        iconAnchor: [20, 10]
                    });
                    L.marker(midPos, { icon: labelIcon }).addTo(map);
                }
            });
        }

        // Add start and end markers
        L.circleMarker(coords[0], { radius: 6, color: '#4CAF50', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup('Start');
        L.circleMarker(coords[coords.length - 1], { radius: 6, color: '#F44336', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup('End');

        // Render waypoints if present (Community Routes)
        const waypoints = (activeRoute as any).waypoints;
        if (waypoints && Array.isArray(waypoints)) {
            waypoints.forEach((wp: any) => {
                if (wp.lat && wp.lng) {
                    const icon = L.divIcon({
                        className: 'waypoint-icon',
                        html: `<div style="background-color: ${wp.type === 'photo' ? '#3B82F6' : '#EF4444'}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });
                    L.marker([wp.lat, wp.lng], { icon }).addTo(map).bindPopup(wp.note || (wp.type === 'photo' ? 'Photo Spot' : 'Waypoint'));
                }
            });
        }

        // Render Reminder Info (Facilities & Risks)
        const parseGeoPoint = (r: any): [number, number] | null => {
            // Same logic as outer parseGeoPoint
            if (r.geojson) {
              let g = r.geojson;
              if (typeof g === 'string') { try { g = JSON.parse(g); } catch(e) {} }
              if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
                return [g.coordinates[1], g.coordinates[0]];
              }
            }
            const geoObj = r.coordinates;
            if (!geoObj) return null;
            if (geoObj.type === 'Point' && Array.isArray(geoObj.coordinates)) return [geoObj.coordinates[1], geoObj.coordinates[0]];
            if (typeof geoObj === 'string') {
              try {
                const parsed = JSON.parse(geoObj);
                if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) return [parsed.coordinates[1], parsed.coordinates[0]];
              } catch(e) {}
            }
            return null;
        };

        // Ensure reminder info is rendered when map initializes
        if (reminderInfo.length > 0) {
            console.log('DEBUG: Rendering reminders during map init:', reminderInfo.length);
            reminderInfo.forEach(r => {
                const coords = parseGeoPoint(r);
                if (coords) {
                    const isRisk = r.category?.toLowerCase() === 'risk';
                    const bgColor = isRisk ? '#EF4444' : '#3B82F6'; 
                    const emoji = isRisk ? '⚠️' : 'ℹ️'; 
                    
                    let specificEmoji = emoji;
                    const nameLower = r.name?.toLowerCase() || '';
                    const promptLower = r.ai_prompt?.toLowerCase() || '';
                    
                    if (!isRisk) {
                        if (nameLower.includes('toilet') || nameLower.includes('restroom')) specificEmoji = '🚻';
                        else if (nameLower.includes('water')) specificEmoji = '💧';
                        else if (nameLower.includes('rest') || nameLower.includes('pavilion')) specificEmoji = '🪑';
                        else if (nameLower.includes('camp')) specificEmoji = '⛺';
                    } else {
                        if (nameLower.includes('slip') || promptLower.includes('slip')) specificEmoji = '🥾';
                        else if (nameLower.includes('animal') || nameLower.includes('dog') || nameLower.includes('monkey')) specificEmoji = '🐕';
                        else if (nameLower.includes('steep') || nameLower.includes('cliff')) specificEmoji = '⛰️';
                        else if (nameLower.includes('sun') || nameLower.includes('heat')) specificEmoji = '☀️';
                    }

                    const remIcon = L.divIcon({ 
                        html: `<div style="background-color: ${bgColor}; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 500;">${specificEmoji}</div>`,
                        className: '',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12],
                        popupAnchor: [0, -12]
                    });

                    const popupContent = `
                        <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 200px;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                                <span style="font-size: 16px;">${specificEmoji}</span>
                                <strong style="color: ${bgColor}; font-size: 14px;">${r.name}</strong>
                            </div>
                            <div style="font-size: 12px; color: #4b5563; line-height: 1.4;">
                                ${r.ai_prompt || (isRisk ? 'Please be careful in this area.' : 'Facility available here.')}
                            </div>
                        </div>
                    `;

                    L.marker(coords, { icon: remIcon, zIndexOffset: 2000 })
                        .addTo(map)
                        .bindPopup(popupContent, { closeButton: false });
                }
            });
        }

        // Ensure we fit all coordinates
        map.fitBounds(fullPolyline.getBounds(), { padding: [40, 40] });
    } else {
        map.setView([22.26, 114.18], 12); // Focus on HK Island
    }

    detailMapInstanceRef.current = map;

    // Second effect to render reminders if they load AFTER the map
    if (reminderInfo.length > 0) {
        // (The logic is already in the main setup, but having a clean way to update 
        // would be better. For now, since setupMap re-runs on activeRoute change,
        // it's usually okay. Added a log for debugging.)
        console.log('Rendering reminders in preview map:', reminderInfo.length);
    }

    // Fix for Leaflet initialization in a dynamic container
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            if (coords.length > 0) {
                map.fitBounds(L.polyline(coords).getBounds(), { padding: [20, 20] });
            }
        }
    }, 100);

    return () => {
        if (detailMapInstanceRef.current) {
            detailMapInstanceRef.current.remove();
            detailMapInstanceRef.current = null;
        }
    };
  }, [activeRoute]);

  // AI Route Search Handler
  const handleAIRouteSearch = async () => {
    if (!soloPreferences.mood || !soloPreferences.difficulty) {
      alert('Please select mood and difficulty level');
      return;
    }

    // 1. 创建用户偏好对象
    const userPrefs: UserHikingPreferences = {
      mood: soloPreferences.mood as any,
      difficulty: soloPreferences.difficulty as any,
      condition: soloPreferences.condition,
      availableTime: soloPreferences.availableTime,
      maxDistance: soloPreferences.maxDistance,
      isSegmentBased: true // Force segment-based routing
    };

  // 2. 开始搜索
  setAiSearchState(prev => ({
    ...prev,
    isSearching: true,
    userPrefs,
  }));

  try {
    // 3. 调用 AI 匹配函数
    let matches = await findMatchingRoutes(userPrefs, 5);

    // 3.5. 如果数据库没有数据，使用 MOCK_ROUTES 作为备选
    if (matches.length === 0) {
      console.warn('No matches from DB, using MOCK_ROUTES as fallback');
      // 将 MOCK_ROUTES 转换为 RouteMatchScore 格式进行评分
      const mockComposedRoutes: ComposedRoute[] = MOCK_ROUTES.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        region: r.region,
        is_segment_based: true,
        difficulty_level: r.difficulty as any,
        total_distance: parseFloat(r.distance),
        total_duration_minutes: parseInt(r.duration) * 60,
        total_elevation_gain: r.elevationGain,
        tags: [],
        segments: [],
        created_by: 'system',
        created_at: new Date().toISOString(),
      }));
      
      const userTags = userPreferencesToTags(userPrefs);
      matches = mockComposedRoutes
        .map(route => scoreRoute(route, userPrefs, userTags))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
    }

    // 4. 保存结果
    setAiSearchState(prev => ({
      ...prev,
      isSearching: false,
      matchedRoutes: matches,
    }));

    // 5. 可选：保存搜索历史到数据库（用于 AI 学习）
    if (currentUserId && matches.length > 0) {
      await savePrefSearchHistory({
        user_id: currentUserId,
        user_mood: soloPreferences.mood,
        user_difficulty: soloPreferences.difficulty,
        user_condition: soloPreferences.condition,
        matched_routes: matches.map(m => ({
          route_id: m.routeId,
          match_score: m.matchScore,
          reason: m.matchReasons.join(', '),
        })),
      });

      // 6. 保存 AI 生成路线（仅对当前用户可见）
      await saveGeneratedRoutesForUser(currentUserId, null, userPrefs, matches);
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





  // Route Search Handler (Simplified to just update query)
  const handleRouteSearch = (query: string) => {
    setRouteSearchQuery(query);
  };

  // Effect to filter routes whenever search or source changes
  useEffect(() => {
    const sourceRoutes = showCommunityRoutes ? uploadedRoutes : officialRoutes;
    
    if (!routeSearchQuery.trim()) {
      setFilteredRoutes(sourceRoutes);
    } else {
      const query = routeSearchQuery.toLowerCase();
      const filtered = sourceRoutes.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.region.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
      );
      setFilteredRoutes(filtered);
    }
  }, [showCommunityRoutes, uploadedRoutes, officialRoutes, routeSearchQuery]);

  const renderRating = (rating: number) => {
    return (
      <div className="flex text-yellow-500">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} fill={i < rating ? "currentColor" : "none"} className={i < rating ? "" : "text-gray-300"} />
        ))}
      </div>
    );
  };

  const handleCreateGroup = async () => {
    if (!groupTitle) return;
    const size = typeof groupSize === 'number' ? groupSize : 4;
    
    try {
      // 1️⃣ 同时在 Supabase 创建 team 记录
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: groupTitle,
          description: groupDesc || 'Join us for a hike!',
          created_by: currentUserId || null,
          is_public: true,
          max_team_size: size || 4,
          team_size: 1,
          status: 'planning'
        })
        .select()
        .single();

      if (teamError) {
        console.error('Error creating team in DB:', teamError);
        alert('Failed to create team. Please try again.');
        return;
      }

      // 2️⃣ 使用数据库的 UUID 作为 GroupHike ID
      const newGroup: GroupHike = {
        id: teamData.id, // 使用数据库生成的 UUID
        title: groupTitle,
        description: groupDesc || 'Join us for a hike!',
        date: groupTime || 'To be decided',
        maxMembers: size || 4,
        currentMembers: 1,
        isOrganizer: true,
        members: ['You'],
        meetingPoint: groupMeetingPoint || 'To be decided',
        startTime: groupTime,
        companionCount: size,
        status: 'draft'
      };
      
      console.log('✅ Team created successfully with ID:', teamData.id);
      
      // 3️⃣ 写入全局「我的活动」
      onCreateGroupHike(newGroup);
      
      // 4️⃣ 立即插入当前页面的 Nearby 列表
      setNearbyGroups(prev => [newGroup, ...prev]);
      
      // 5️⃣ 重置表单，但保持在 partner 视图
      setGroupTitle('');
      setGroupDesc('');
      setGroupSize('');
      setGroupTime('');
      setGroupMeetingPoint('');
      
      // keep createdGroup available for dashboard
      setCreatedGroup(newGroup);
      setIsLeader(true);
      
      // 🆕 显示队长preference填写表单
      setShowOrganizerPreferenceForm(true);
    } catch (error) {
      console.error('Error in handleCreateGroup:', error);
      alert('Failed to create team. Please try again.');
    }
  };

  const handleCreateGroupAndStart = async () => {
    if (!groupTitle) return;
    await handleCreateGroup();
    setStartSelection('group');
  };

  const handleJoinGroup = (group: GroupHike) => {
    // 不允许超过上限
    if (group.currentMembers >= group.maxMembers) return;

    const updatedGroup: GroupHike = {
      ...group,
      currentMembers: Math.min(group.currentMembers + 1, group.maxMembers)
    };

    // 本地更新「Nearby Groups」的人数
    setNearbyGroups(prev =>
      prev.map(g => (g.id === group.id ? updatedGroup : g))
    );

    // 通知上层，把这个活动也写入「My Activities」
    if (onJoinGroupHike) {
      onJoinGroupHike(updatedGroup);
    }
  };

  /**
   * 队长点击"分析成员偏好并推荐路线"时，调用此函数
   * 将所有成员的偏好通过 AI 整合，然后推荐最佳路线
   */
  const handleAnalyzeGroupAndRecommend = async (group: GroupHike) => {
    if (!group) return;
    
    setIsAnalyzingGroupPrefs(true);
    setGroupAnalysisError(null);
    
    try {
      // 🔄 从 Supabase 获取所有成员的偏好
      setIsLoadingTeamProgress(true);
      const members = await fetchTeamMembers(group.id);
      setTeamMembers(members);

      // 🔄 构建成员偏好列表（只包含已完成表单的成员）
      const memberPreferences: MemberPreference[] = members
        .filter(m => m.preferences_completed && m.user_preferences)
        .map(m => ({
          userId: m.user_id,
          userName: m.user_name || m.user_email || 'Unknown',
          mood: m.user_mood || 'peaceful',
          difficulty: m.user_difficulty || 'medium',
          condition: m.user_condition || '',
          user_preferences: m.user_preferences
        }));

      console.log(`📦 Collected preferences from ${memberPreferences.length}/${members.length} members`);

      if (memberPreferences.length === 0) {
        setGroupAnalysisError('No members have completed their preferences yet. Please wait for team members to fill in their preferences.');
        return;
      }

      // 调用 AI 分析并推荐路线
      const result = await recommendRoutesForGroup(group.id, memberPreferences);
      setGroupRouteResult(result);
    } catch (error) {
      console.error('Error analyzing group preferences:', error);
      setGroupAnalysisError(error instanceof Error ? error.message : 'Failed to analyze group preferences');
    } finally {
      setIsAnalyzingGroupPrefs(false);
      setIsLoadingTeamProgress(false);
    }
  };

  // Save preference search history to DB
  const savePrefSearchHistory = async (data: {
    user_id: string;
    user_mood: string;
    user_difficulty: string;
    user_condition: string;
    matched_routes: Array<{
      route_id: string;
      match_score: number;
      reason: string;
    }>;
  }) => {
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
  };

  // Handle route selection
  const handleSelectRoute = async (routeId: string, forceIsLeader?: boolean) => {
    console.log('🔘 handleSelectRoute called:', { routeId, forceIsLeader, isLeader, createdGroupId: createdGroup?.id });
    try {
      let selectedRoute: Route;

      // 1. 如果是 AI 生成的动态路线 (starts with ai_gen_)
      if (routeId.startsWith('ai_gen_')) {
          const match = aiSearchState.matchedRoutes.find(r => r.routeId === routeId);
          if (!match) throw new Error('Route not found in state');
          
          selectedRoute = {
            id: routeId,
            name: match.routeName,
            region: 'Hong Kong',
            description: match.matchReasons.join('. '),
            distance: `${match.totalDistance.toFixed(1)}km`,
            duration: `${Math.round(match.totalDuration / 60)}h`,
            difficulty: match.difficulty,
            startPoint: '{}',
            endPoint: '{}',
            elevationGain: 0,
            isUserPublished: false,
            coordinates: mergeSegmentCoordinates(match.segments || []),
            segments: match.segments, // 🆕 Pass segments for mapping
          } as any;
      } 
      // 2. 如果是从首页官方列表直接点击过来的，我们可能在 state 里已经有了它的基本信息
      else {
          // 先尝试从当前环境的官方路线里找（以确保不会因为数据库找不到而崩溃）
          const existingRoute = officialRoutes.find(r => String(r.id) === String(routeId)) || uploadedRoutes.find(r => String(r.id) === String(routeId));
          
          // 获取深度信息（特别是 segments 拼接成的坐标）
          const routeData = await fetchRouteById(routeId);
          
          if (!routeData && !existingRoute) {
             throw new Error('Route not found');
          }

          // 组合坐标：优先使用深度查询返回的 full_coordinates 或合并后的 segments，
          // 如果都没有，则使用现有对象中的 coordinates，最后兜底为空数组
          let finalCoordinates: [number, number][] = [];
          if (routeData) {
            finalCoordinates = (routeData.full_coordinates && routeData.full_coordinates.length > 0)
               ? routeData.full_coordinates
               : mergeSegmentCoordinates(routeData.segments || []);
          }
          
          if (finalCoordinates.length === 0 && existingRoute?.coordinates) {
             finalCoordinates = existingRoute.coordinates;
          }

          selectedRoute = {
            id: routeId,
            name: routeData?.name || existingRoute?.name || 'Unknown Route',
            region: routeData?.region || existingRoute?.region || 'Hong Kong',
            description: routeData?.description || existingRoute?.description || '',
            distance: routeData ? `${routeData.total_distance?.toFixed(1) || 0}km` : existingRoute?.distance || '0km',
            duration: routeData ? `${Math.round(routeData.total_duration_minutes / 60) || 0}h` : existingRoute?.duration || '0h',
            difficulty: routeData?.difficulty_level || existingRoute?.difficulty || 3,
            startPoint: '{}', 
            endPoint: '{}',
            elevationGain: routeData?.total_elevation_gain || existingRoute?.elevationGain || 0,
            isUserPublished: existingRoute?.isUserPublished || false,
            coordinates: finalCoordinates,
            segments: routeData?.segments || [], // 🆕 Pass segments for mapping
          } as any;
      }

      // 4. 记录选择
      if (aiSearchState.userPrefs && currentUserId && !routeId.startsWith('ai_gen_')) {
        try {
          await supabase.from('ai_route_matches').update({
            top_route_id: routeId,
            used_at: new Date().toISOString(),
          }).eq('user_id', currentUserId);
        } catch (e) {
          // ignore stat insert error
        }
      }

      // 5. 调用回调，开始出行
      // 🆕 注入 leader 身份
      if (selectedRoute) {
        // 如果坐标为空，使用默认龙脊兜底，避免地图崩溃
        if (!selectedRoute.coordinates || selectedRoute.coordinates.length === 0) {
           selectedRoute.coordinates = DRAGONS_BACK_COORDINATES;
           console.warn("No coordinates found for route, using fallback");
        }
        
        const finalTeamId = createdGroup ? createdGroup.id : initialTeamId;
        // Correctly determine if they should act as leader in the next view
        const finalIsLeader = forceIsLeader !== undefined ? forceIsLeader : isLeader;

        console.log('🚀 Triggering onSelectRoute with:', { 
            routeId: selectedRoute.id, 
            finalTeamId, 
            finalIsLeader,
            originalIsLeader: isLeader,
            forceIsLeader
        });

        onSelectRoute?.({
          ...selectedRoute,
          isLeader: finalIsLeader,
          teamId: finalTeamId
        } as any);
      }
    } catch (error) {
      console.error('Error selecting route:', error);
      alert('Failed to load route details to start hike. Please try again.');
    }
  };

  // --- Sub-View: Events ---
  if (viewMode === 'events') {
      return (
          <div className="flex flex-col h-full bg-gray-50 animate-fade-in">
              <div className="bg-white p-4 shadow-sm flex items-center gap-3">
                  <button onClick={() => setViewMode('routes')} className="p-1"><ArrowLeft size={24} /></button>
                  <h2 className="text-xl font-bold">Community Events</h2>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto pb-20">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm flex items-start gap-3">
                      <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                      <div>
                          <span className="font-bold">Official Activities</span>
                          <p className="text-blue-600/80 text-xs mt-1">Earn badges and points by participating in conservation efforts.</p>
                      </div>
                  </div>

                  {MOCK_EVENTS.map(evt => (
                      <div key={evt.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                          <div className="h-32 w-full relative">
                              <img src={evt.imageUrl} className="w-full h-full object-cover" alt={evt.title} />
                              <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-bold text-gray-700">
                                  {evt.type.toUpperCase()}
                              </div>
                          </div>
                          <div className="p-4">
                              <h3 className="font-bold text-lg mb-1">{evt.title}</h3>
                              <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                                  <Calendar size={14} /> {evt.date}
                                  <span className="mx-1">•</span>
                                  <MapPin size={14} /> {evt.location}
                              </div>
                              <div className="flex items-center justify-between">
                                  <div className="flex -space-x-2">
                                      {[1,2,3].map(i => (
                                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-300"></div>
                                      ))}
                                      <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold">+{evt.participants}</div>
                                  </div>
                                  <button className="bg-hike-green text-white px-4 py-1.5 rounded-full text-sm font-bold shadow hover:bg-hike-dark">Join</button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )
  }

  // --- Sub-View: Start Hiking ---
  if (viewMode === 'start_hiking') {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-100 to-gray-50 animate-fade-in">
        {/* Glassmorphism Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm px-4 py-5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode('routes')} 
              className="p-2.5 hover:bg-gray-100 rounded-full transition active:scale-90 duration-200"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">Start Hiking</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose your adventure type</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
          {/* Premium Selection Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button 
              onClick={() => setStartSelection('solo')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'solo' 
                  ? 'bg-gradient-to-br from-hike-green to-hike-dark text-white shadow-lg shadow-hike-green/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-hike-green/30'
              }`}
            >
              <div className="text-2xl mb-1">🏔️</div>
              <div className="text-sm font-bold">Solo</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'solo' ? 'Selected' : 'Just you'}</div>
            </button>
            <button 
              onClick={() => setStartSelection('group')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'group' 
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-orange-300/30'
              }`}
            >
              <div className="text-2xl mb-1">👥</div>
              <div className="text-sm font-bold">Group</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'group' ? 'Selected' : 'With friends'}</div>
            </button>
            <button 
              onClick={() => setStartSelection('join')}
              className={`py-5 px-3 rounded-2xl font-bold text-center transition-all duration-300 transform active:scale-95 ${
                startSelection === 'join' 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 scale-105' 
                  : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300/30'
              }`}
            >
              <div className="text-2xl mb-1">🤝</div>
              <div className="text-sm font-bold">Join</div>
              <div className="text-[10px] text-opacity-70 mt-1">{startSelection === 'join' ? 'Selected' : 'Open teams'}</div>
            </button>
          </div>

          {/* Conditional panels based on selection */}
          {startSelection === 'solo' && (
            <div className={`transition-all duration-300 opacity-100 space-y-5 animate-fade-in`}>
              {/* AI Route Recommendation */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 mb-6">
                <h3 className="font-bold text-xl mb-5 flex items-center gap-2 text-gray-900">
                  <Sparkles size={24} className="text-orange-500" /> Your Perfect Match
                </h3>
                
                <PreferenceFormPanel
                  data={soloPreferences}
                  onChange={setSoloPreferences}
                  showTitle={false}
                />

                <button 
                  onClick={handleAIRouteSearch}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 mt-6"
                >
                  <Sparkles size={18} />
                  AI-powered route matching
                </button>
              </div>

              {/* 显示匹配的路线 */}
              {aiSearchState.isSearching ? (
  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-6 text-center">
    <div className="inline-flex items-center gap-2 text-blue-900">
      <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-semibold">Finding your perfect route...</p>
    </div>
  </div>
) : aiSearchState.matchedRoutes.length === 0 ? (
  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-4 text-center">
    <p className="text-blue-900 font-semibold text-sm">💡 Tap "Find My Perfect Route" to discover trails that match your mood and energy level.</p>
  </div>
) : (
  <div className="animate-fade-in">
    <div className="flex items-center gap-2 mb-4">
      <h3 className="font-bold text-gray-900 text-lg">✨ Routes Made for You</h3>
      <span className="text-xs bg-hike-green text-white px-2 py-1 rounded-full font-bold">
        {aiSearchState.matchedRoutes.length} match
      </span>
    </div>
    <div className="space-y-3">
      {aiSearchState.matchedRoutes.map((match, idx) => (
        <div
          key={match.routeId}
          onClick={() => {
            setAiSearchState(prev => ({
              ...prev,
              selectedRouteId: match.routeId,
            }));
            handleSelectRoute(match.routeId);
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
              {/* 优先把命中的 Tag 或者前 2-3 个核心 Tag 展示，避免堆砌 */}
              {match.tags && match.tags.length > 0 && match.tags.slice(0, 2).map((tag, i) => (
                  <span
                    key={`tag-${i}`}
                    className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold max-w-full truncate"
                  >
                    #{tag}
                  </span>
              ))}

              {match.matchReasons.map((reason, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-hike-green/20 text-hike-green px-2 py-0.5 rounded-full font-semibold max-w-full truncate"
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
              
            </div>
          )}

          {startSelection === 'join' && (
            <div className={`transition-all duration-300 opacity-100 space-y-5 animate-fade-in`}>
              {/* Quick Search by Team ID */}
              <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-sm border border-white/50">
                <label className="text-xs text-gray-600 font-bold uppercase tracking-wider block mb-3">Have a Team ID?</label>
                <div className="flex gap-2">
                  <input 
                    value={teamIdInput} 
                    onChange={e => setTeamIdInput(e.target.value)} 
                    placeholder="Enter Team ID..." 
                    className="flex-1 border-2 border-gray-200 py-3 px-3 rounded-xl focus:outline-none focus:border-blue-500 bg-gray-50/50 focus:bg-white transition-colors" 
                  />
                  <button 
                    className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm" 
                    onClick={() => {
                      const found = MOCK_NEARBY_GROUPS.find(g => g.id === teamIdInput);
                      if (found) setSelectedGroup(found);
                      else alert('Team not found');
                    }}
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Discover Teams */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50">
                <h4 className="font-bold text-lg mb-4 text-gray-900 flex items-center gap-2">
                  🌍 Discover Teams
                </h4>
                <div className="flex gap-3 mb-5">
                  {/* Date Filter */}
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="flex-1 border-2 border-gray-200 p-2.5 rounded-xl text-sm font-medium bg-gray-50/50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  >
                    <option value="">📅 Any Date</option>
                    <option value="2026-03-15">March 15, 2026</option>
                    <option value="2026-03-20">March 20, 2026</option>
                    <option value="2026-03-22">March 22, 2026</option>
                  </select>
                  {/* Difficulty Filter */}
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as any)}
                    className="flex-1 border-2 border-gray-200 p-2.5 rounded-xl text-sm font-medium bg-gray-50/50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  >
                    <option value="">🎯 Any Level</option>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                  </select>
                </div>

                {
                  (() => {
                    const filteredNearbyGroups = MOCK_NEARBY_GROUPS.filter(group => {
                      if (filterDate && group.date !== filterDate) return false;
                      if (filterDifficulty) {
                        const route = MOCK_ROUTES.find(r => r.id === group.routeId);
                        if (!route) return false;
                        if (
                          (filterDifficulty === 'easy' && route.difficulty > 2) ||
                          (filterDifficulty === 'medium' && (route.difficulty < 2 || route.difficulty > 4)) ||
                          (filterDifficulty === 'hard' && route.difficulty < 4)
                        ) return false;
                      }
                      return true;
                    });

                    return (
                      <div className="space-y-3 mt-5">
                        {filteredNearbyGroups.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <div className="text-4xl mb-2">🔍</div>
                            <div className="text-sm font-medium">No teams match your filters</div>
                          </div>
                        ) : (
                          filteredNearbyGroups.map(g => {
                            const route = MOCK_ROUTES.find(r => r.id === g.routeId);
                            const diffColor = 
                              !route ? 'gray' :
                              route.difficulty <= 2 ? 'green' :
                              route.difficulty <= 4 ? 'amber' : 'red';
                            
                            return (
                              <div key={g.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-100 hover:border-blue-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{g.title}</h5>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">{g.description}</p>
                                  </div>
                                  {route && (
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${
                                      diffColor === 'green' ? 'bg-green-100 text-green-700' :
                                      diffColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {route.difficulty <= 2 ? '🟢 Easy' : route.difficulty <= 4 ? '🟡 Medium' : '🔴 Hard'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-4 flex-wrap gap-2">
                                  <div className="flex items-center gap-1">📅 {g.date}</div>
                                  <div className="flex items-center gap-1">👥 {g.currentMembers}/{g.maxMembers}</div>
                                  {g.planned_duration && <div className="flex items-center gap-1">⏱️ {g.planned_duration}</div>}
                                </div>
                                <button 
                                  onClick={() => setSelectedGroup(g)} 
                                  className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-xs font-bold hover:shadow-md active:scale-95 transition-all duration-200 shadow-sm"
                                >
                                  View & Join
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}

                {selectedGroup && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50 animate-fade-in">
                    <div className="bg-white rounded-t-3xl p-6 w-full shadow-2xl max-h-[85vh] overflow-y-auto">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold text-gray-900">Join Team</h3>
                        <button 
                          onClick={() => setSelectedGroup(null)} 
                          className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-lg text-gray-900 mb-2">{selectedGroup.title}</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{selectedGroup.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Date</div>
                            <div className="font-bold text-gray-900 text-sm">📅 {selectedGroup.date}</div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Members</div>
                            <div className="font-bold text-gray-900 text-sm">👥 {selectedGroup.currentMembers}/{selectedGroup.maxMembers}</div>
                          </div>
                        </div>

                        {selectedGroup.planned_duration && (
                          <div className="bg-purple-50 p-4 rounded-xl flex items-center gap-3">
                            <Clock size={20} className="text-purple-600 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-purple-600 font-bold uppercase">Duration</div>
                              <div className="font-bold text-gray-900">{selectedGroup.planned_duration}</div>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={() => {
                            handleJoinGroup(selectedGroup);
                            setSelectedGroup(null);
                          }} 
                          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all duration-200"
                        >
                          Join this Team
                        </button>
                        
                        <button 
                          onClick={() => setSelectedGroup(null)} 
                          className="w-full py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {startSelection === 'group' && (
            <div className={`transition-opacity duration-300 opacity-100`}>
              {/* Group creation form */}
              {showCreateGroupForm ? (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 text-left">
                  <h3 className="font-bold text-lg mb-4">Create Group</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Event Title</label>
                      <input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Description</label>
                      <textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="w-full border-b border-gray-200 py-2 h-20 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase">Group Size</label>
                        <input type="number" min={1} max={20} value={groupSize as any} onChange={e => setGroupSize(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 4" className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase">Start Time</label>
                        <input type="text" value={groupTime} onChange={e => setGroupTime(e.target.value)} placeholder="yyyymmdd, 0830-1630" className="w-full border-b border-gray-200 py-2 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <button onClick={() => { handleCreateGroupAndStart(); setShowCreateGroupForm(false); }} className="flex-1 bg-hike-green text-white py-3 rounded-xl font-bold">Form Group</button>
                      <button onClick={() => { setStartSelection(''); setGroupTitle(''); setGroupDesc(''); setShowCreateGroupForm(true); }} className="flex-1 bg-gray-100 py-3 rounded-xl">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Form Another Group</h3>
                  <button onClick={() => setShowCreateGroupForm(true)} className="text-sm font-semibold text-hike-green hover:underline">+</button>
                </div>
              )}

              {/* After creation: invitation + dashboard */}
              {createdGroup && (
                <div className="space-y-4">
                  {/* 🆕 Group Organizer Preference Form Modal */}
                  {showOrganizerPreferenceForm && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in px-4 pb-24 sm:pb-32">
                      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        {/* Scrollable Content */}
                        <div className="overflow-y-auto p-6">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900">📋 Your Hiking Preferences</h3>
                              <p className="text-sm text-gray-500 mt-1">As the group organizer</p>
                            </div>
                            <button
                              onClick={() => setShowOrganizerPreferenceForm(false)}
                              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="space-y-6 pb-4">
                            <PreferenceFormPanel
                              data={groupOrganizerPreferences}
                              onChange={setGroupOrganizerPreferences}
                              showTitle={false}
                            />
                          </div>
                        </div>

                        {/* Fixed Bottom Buttons */}
                        <div className="flex gap-3 p-6 border-t border-gray-200 bg-white">
                          <button
                            onClick={async () => {
                              // Save organizer preferences to team_members
                              try {
                                // Validate required fields
                                if (!groupOrganizerPreferences.mood) {
                                  alert('Please select your hiking mood');
                                  return;
                                }
                                if (!groupOrganizerPreferences.difficulty) {
                                  alert('Please select your difficulty level');
                                  return;
                                }

                                const { data: { user } } = await supabase.auth.getUser();
                                
                                // Create stable user ID - use user ID if logged in, otherwise use team ID + "organizer"
                                const userId = user?.id || `organizer_${createdGroup.id}`;
                                const userEmail = user?.email || `organizer_${createdGroup.id}@hikepal.local`;
                                const userName = user?.user_metadata?.name || 'Organizer';

                                const userPrefs: UserHikingPreferences = {
                                  mood: groupOrganizerPreferences.mood as any,
                                  difficulty: groupOrganizerPreferences.difficulty as any,
                                  condition: groupOrganizerPreferences.condition,
                                  availableTime: groupOrganizerPreferences.availableTime,
                                  maxDistance: groupOrganizerPreferences.maxDistance,
                                };

                                console.log('💾 Saving organizer preferences:', {
                                  team_id: createdGroup.id,
                                  user_id: userId,
                                  user_email: userEmail,
                                  user_name: userName,
                                  user_mood: groupOrganizerPreferences.mood,
                                  user_difficulty: groupOrganizerPreferences.difficulty,
                                  prefs: userPrefs,
                                });

                                const { error, data } = await supabase
                                  .from('team_members')
                                  .insert([
                                    {
                                      team_id: createdGroup.id,
                                      user_id: userId,
                                      user_name: userName,
                                      user_email: userEmail,
                                      user_mood: groupOrganizerPreferences.mood,
                                      user_difficulty: groupOrganizerPreferences.difficulty,
                                      user_condition: groupOrganizerPreferences.condition || '',
                                      user_preferences: userPrefs,
                                      role: 'organizer',
                                      preferences_completed: true,
                                      preferences_completed_at: new Date().toISOString(),
                                    },
                                  ])
                                  .select();

                                if (error) {
                                  console.error('❌ Error details:', {
                                    code: error.code,
                                    message: error.message,
                                    details: error.details,
                                    hint: error.hint,
                                  });
                                  
                                  // Check if it's a duplicate entry (organizer already exists)
                                  if (error.code === '23505') {
                                    console.log('ℹ️ Organizer preferences already exist, closing form');
                                    setShowOrganizerPreferenceForm(false);
                                    return;
                                  }

                                  // RLS policy error
                                  if (error.code === '42501') {
                                    alert('Permission denied. Please try again or refresh the page.');
                                    return;
                                  }

                                  throw error;
                                }

                                console.log('✅ Organizer preferences saved:', data);
                                alert('✅ Your preferences have been saved!');
                                setShowOrganizerPreferenceForm(false);
                              } catch (error) {
                                console.error('❌ Exception caught:', error);
                                const errorMsg = error instanceof Error ? error.message : String(error);
                                console.error('Full error:', errorMsg);
                                alert(`Failed to save preferences:\n${errorMsg}\n\nPlease try again.`);
                              }
                            }}
                            className="flex-1 bg-hike-green text-white py-3.5 rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-green-600"
                          >
                            ✅ Save My Preferences
                          </button>
                          <button
                            onClick={() => setShowOrganizerPreferenceForm(false)}
                            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-200 transition"
                          >
                            Skip for Now
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 text-left">
                    <h3 className="font-bold text-lg mb-4 flex justify-between items-center">
                      Your Group: {createdGroup.title}
                      <button onClick={() => { setCreatedGroup(null); setShowCreateGroupForm(true); }} className="text-sm font-semibold text-hike-green hover:underline">Clear</button>
                    </h3>
                    <div className="space-y-3">
                      {/* Team Info Card */}
                      <div className="bg-gradient-to-r from-hike-green/10 to-emerald-100 rounded-2xl p-5 border border-hike-green/20">
                        <h2 className="font-bold text-lg text-gray-900 mb-2">Team Info</h2>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-gray-600 font-bold uppercase">Group Name</span>
                            <p className="font-bold text-gray-900 text-base">{createdGroup.title}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-600 font-bold uppercase">Size</span>
                            <p className="text-sm font-bold text-gray-900">
                              <span className="bg-hike-green/20 text-hike-green px-2.5 py-1 rounded-full font-bold">
                                {createdGroup.currentMembers}/{createdGroup.maxMembers} Members
                              </span>
                            </p>
                          </div>
                          {createdGroup.description && (
                            <div>
                              <span className="text-xs text-gray-600 font-bold uppercase">Description</span>
                              <p className="text-sm text-gray-700">{createdGroup.description}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                        <Share2 size={20} className="text-hike-green flex-shrink-0" />
                        <div className="flex-1 text-sm text-gray-700 font-medium">
                          Share Group Link:
                          <p className="font-mono text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md break-all mt-1">{`${window.location.origin}/?team=${createdGroup.id}`}</p>
                        </div>
                        <button className="px-3 py-1.5 bg-green-200 text-green-800 rounded-lg text-xs font-semibold hover:bg-green-300 transition" onClick={async () => {
                          const link = `${window.location.origin}/?team=${createdGroup.id}`;
                          try {
                            await navigator.clipboard.writeText(link);
                            setInviteCopied(true);
                            setTimeout(() => setInviteCopied(false), 2000);
                          } catch (e) {
                            alert(link);
                          }
                        }}>Copy</button>
                      </div>



                      <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                        <h4 className="font-bold text-lg mb-3">Members ({createdGroup.currentMembers}/{createdGroup.maxMembers})</h4>
                        <div className="space-y-2">
                          {(createdGroup.members || []).map(m => (
                            <div key={m} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center gap-2">
                                <Users size={18} className="text-gray-500"/>
                                <span className="text-base text-gray-700">{m}</span>
                              </div>
                              <span className="text-xs bg-hike-light text-hike-green px-2 py-0.5 rounded-full font-semibold">Ready</span>
                            </div>
                          ))}
                        </div>

                        {/* 🆕 Team Member Preferences Progress */}
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">📋 Preference Forms Completed</span>
                            <span className="text-sm font-bold text-hike-green bg-green-50 px-2 py-1 rounded-md">
                              {teamProgress ? `${teamProgress.completed_members}/${createdGroup.maxMembers} Completed` : 'Loading...'}
                            </span>
                          </div>

                          {/* Show pending members */}
                          {teamProgress && teamProgress.pending_members.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-900 mb-2">Pending Members:</p>
                              <div className="space-y-1">
                                {teamProgress.pending_members.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 text-xs text-blue-800">
                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                    <span>{m.user_name || m.user_email || 'Unknown'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show completed members with their preferences */}
                          {teamProgress && teamProgress.completed_members_data.length > 0 && (
                            <div className="space-y-2 mt-2">
                              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">✓ Completed Preferences</p>
                              <div className="grid grid-cols-1 gap-2">
                                {teamProgress.completed_members_data.map(m => (
                                  <div key={m.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-3 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-sm text-gray-900">{m.user_name || m.user_email || 'Unknown'}</span>
                                      {m.role === 'organizer' && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">Captain</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {m.user_mood && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">{m.user_mood}</span>}
                                      {m.user_difficulty && <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">{m.user_difficulty}</span>}
                                      {m.user_preferences?.maxDistance && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.user_preferences.maxDistance}km</span>}
                                      {m.user_preferences?.availableTime && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{Math.round(m.user_preferences.availableTime/60)}h</span>}
                                    </div>
                                    {m.user_condition && <p className="text-[10px] text-gray-500 italic mt-1 border-t border-gray-100 pt-1">"{m.user_condition}"</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Load team progress on button click */}
                          <button 
                            onClick={async () => {
                              setIsLoadingTeamProgress(true);
                              await refreshTeamDashboard();
                              setIsLoadingTeamProgress(false);
                            }}
                            disabled={isLoadingTeamProgress}
                            className="w-full px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold hover:bg-blue-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isLoadingTeamProgress ? '🔄 Refreshing...' : '🔄 Refresh Progress'}
                          </button>
                        </div>

                        {/* AI-Powered Team Route Recommendation Button */}
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <button 
            onClick={() => handleAnalyzeGroupAndRecommend(createdGroup)}
            disabled={isAnalyzingGroupPrefs}
            className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAnalyzingGroupPrefs ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                AI analyzing group preferences...
              </>
            ) : (
              <>
                <Sparkles size={20} /> AI-powered group route matching
              </>
            )}
          </button>

                          {/* Show error message if analysis fails */}
                          {groupAnalysisError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                              {groupAnalysisError}
                            </div>
                          )}

                          {/* Display recommended routes if analysis succeeds */}
                          {groupRouteResult && (
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3">
                              <div className="text-sm font-bold text-orange-900">
                                ✨ AI Analysis Complete!
                              </div>
                              <div className="text-xs text-orange-800 leading-relaxed">
                                {groupRouteResult.synthesisAnalysis}
                              </div>
                              
                              <div className="bg-white/50 rounded-xl p-3 border border-orange-100 mt-2">
                                <p className="text-[10px] font-bold text-orange-700 uppercase mb-1">Member Preference Details:</p>
                                <pre className="text-[10px] text-orange-900 font-sans whitespace-pre-wrap leading-relaxed">
                                  {getMemberPreferenceDetails(teamMembers.map(m => ({
                                    userId: m.user_id,
                                    userName: m.user_name || m.user_email || 'Unknown',
                                    mood: m.user_mood || 'peaceful',
                                    difficulty: m.user_difficulty || 'medium',
                                    condition: m.user_condition || '',
                                  })))}
                                </pre>
                              </div>
                              
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-bold text-orange-900 uppercase">Recommended Routes:</div>
                                {groupRouteResult.recommendedRoutes.map((route, idx) => (
                                  <div 
                                    key={route.routeId} 
                                    onClick={() => {
                                      // 1. 设置状态
                                      setAiSearchState(prev => ({
                                        ...prev,
                                        selectedRouteId: route.routeId,
                                        matchedRoutes: groupRouteResult.recommendedRoutes
                                      }));
                                      // 2. 直接开始预览
                                      handleSelectRoute(route.routeId);
                                  }}
                                  className={`bg-white rounded-lg p-3 border cursor-pointer active:scale-[0.98] transition-all duration-300 ${
                                    activeRouteId === route.routeId
                                      ? 'border-hike-green bg-green-50'
                                      : 'border-orange-100 hover:border-hike-green/50'
                                  }`}
                                >
                                  <div className="font-semibold text-sm text-gray-900">
                                    {idx + 1}. {route.routeName}
                                    <span className="ml-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                      {route.matchScore}% Match
                                    </span>
                                  </div>

                                    {/* Matches tags formatting like Solo trip */}
                                    <div className="my-2 flex flex-wrap gap-1">
                                      {route.tags && route.tags.length > 0 && route.tags.slice(0, 2).map((tag, i) => (
                                          <span
                                            key={`tag-${i}`}
                                            className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold max-w-full truncate"
                                          >
                                            #{tag}
                                          </span>
                                      ))}

                                      {route.matchReasons.map((reason, i) => (
                                        <span
                                          key={i}
                                          className="text-[10px] bg-hike-green/20 text-hike-green px-2 py-0.5 rounded-full font-semibold max-w-full truncate"
                                        >
                                          {reason}
                                        </span>
                                      ))}
                                    </div>

                                    <div className="flex gap-4 text-xs text-gray-600 font-medium">
                                      <span className="flex items-center gap-1">
                                        <MapPin size={12} /> {route.totalDistance.toFixed(1)} km
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock size={12} /> {Math.round(route.totalDuration / 60)}h
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Mountain size={12} /> ⬆️ {route.difficulty}/5
                                      </span>
                                    </div>
                                    
                                    {/* Segment preview */}
                                    {route.segments && route.segments.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-gray-100">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                          {route.segments.length} segments
                                        </p>
                                        <div className="flex gap-1 flex-wrap">
                                          {route.segments.slice(0, 3).map((seg, i) => (
                                            <span
                                              key={i}
                                              className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
                                            >
                                              {seg.segment_name}
                                            </span>
                                          ))}
                                          {route.segments.length > 3 && (
                                            <span className="text-[9px] text-gray-500 px-1">
                                              +{route.segments.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Start Hike Button - only visible when confirmed */}
                          {createdGroup.status === 'confirmed' && (
                            <button 
                              onClick={async () => {
                                // If route is confirmed, just go to map
                                if (createdGroup.routeId || aiSearchState.selectedRouteId) {
                                  handleSelectRoute(createdGroup.routeId || aiSearchState.selectedRouteId!, true);
                                } else {
                                  onGroupConfirmed?.(createdGroup.id);
                                }
                              }} 
                              className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                              <Compass size={20} /> Start Hike Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Default Route Detail View ---
  if (activeRoute) {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        {/* Header */}
        <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex items-center gap-3">
        <button className="p-1" onClick={() => setActiveRouteId(null)}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Route Detail</h2>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {/* Map Preview with Route Highlight */}
          <div className="h-64 bg-gray-100 relative w-full overflow-hidden">
             <div ref={detailMapRef} className="w-full h-full z-0" />
             
             {/* 🆕 Route Info Button (Left Side) */}
             <button 
                onClick={() => alert(`Route Info:\nName: ${activeRoute.name}\nDist: ${activeRoute.distance}\nTime: ${activeRoute.duration}\nDiff: ${activeRoute.difficulty}/5`)}
                className="absolute top-4 left-4 z-10 p-2.5 bg-white/90 rounded-full shadow-lg text-hike-green border border-white/40 backdrop-blur-sm"
             >
                <Info size={20} />
             </button>

             {/* Route label */}
             <div className="absolute bottom-3 left-3 z-10 bg-hike-green text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                <Flag size={13} fill="currentColor" /> {activeRoute.name}
             </div>
             {/* Info badge */}
             <div className="absolute top-3 right-3 z-10 bg-white/90 text-gray-800 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm shadow-sm border border-gray-100">
                {activeRoute.distance} • {activeRoute.duration}
             </div>
          </div>

          <div className="p-4 space-y-6 select-text">
            {/* 🆕 Team Info Header (Sync Team state in Preview) */}
            {createdGroup && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-blue-400 uppercase">Managing Team</div>
                      <div className="font-bold text-gray-900">{createdGroup.title}</div>
                    </div>
                  </div>
                  <div className="bg-white px-3 py-1 rounded-full border border-blue-200 text-xs font-bold text-blue-600">
                    {createdGroup.currentMembers}/{createdGroup.maxMembers} Members
                  </div>
                </div>

                {/* Real-time Team Member List in Preview */}
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Team Status</p>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                        <div className={`w-2 h-2 rounded-full ${m.preferences_completed ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}></div>
                        <span className="text-xs font-bold text-gray-700">{m.user_name || 'Hiker'}</span>
                        {m.role === 'leader' || m.role === 'organizer' ? (
                           <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-black uppercase">Cap</span>
                        ) : null}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, createdGroup.maxMembers - teamMembers.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center gap-1.5 bg-gray-100/50 px-2.5 py-1.5 rounded-xl border border-dashed border-gray-200">
                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                        <span className="text-xs font-bold text-gray-400">Waiting...</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-2 text-center select-text">
              <div className="bg-hike-light p-3 rounded-lg select-text">
                <div className="text-xs text-gray-500 select-text">Distance</div>
                <div className="font-bold text-hike-dark select-text">{activeRoute.distance}</div>
              </div>
              <div className="bg-hike-light p-3 rounded-lg select-text">
                <div className="text-xs text-gray-500 select-text">Duration</div>
                <div className="font-bold text-hike-dark select-text">{activeRoute.duration}</div>
              </div>
              <div className="bg-hike-light p-3 rounded-lg select-text">
                <div className="text-xs text-gray-500 select-text">Gain</div>
                <div className="font-bold text-hike-dark select-text">{activeRoute.elevationGain}m</div>
              </div>
            </div>

            {/* Actions - Solo Hike & Group Hike */}
            <div className="space-y-3">
              <button
                onClick={() => setActiveRouteId(null)}
                className="w-full bg-white text-gray-700 py-3 rounded-full font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} /> Back to selection
              </button>
              
              {/* If we are currently managing a group, show Confirm for Team button instead */}
              {createdGroup ? (
                <div className="space-y-3">
                  {isLeader ? (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            // Check if the route exists in the DB to avoid Foreign Key violation
                            let canPassId = false;
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeRoute.id);
                            
                            if (isUuid) {
                               const { data } = await supabase.from('routes').select('id').eq('id', activeRoute.id).single();
                               if (data) canPassId = true;
                            }
                            
                            const { error } = await supabase
                              .from('teams')
                              .update({ 
                                status: 'confirmed', 
                                target_route_id: canPassId ? activeRoute.id : null, 
                                target_route_name: activeRoute.name 
                              })
                              .eq('id', createdGroup.id);
                            
                            if (error) {
                                console.error('Supabase update error:', error);
                                alert(`Failed to confirm route: ${error.message || 'Unknown error'}`);
                                return;
                            }
                            alert('✅ Route confirmed for the team!');
                            // Refresh group state
                            setCreatedGroup({ ...createdGroup, status: 'confirmed' });
                            setActiveRouteId(null);
                            setViewMode('start_hiking');
                          } catch (e) {
                            console.error(e);
                            alert('Failed to confirm route');
                          }
                        }}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <Check size={20} />
                        Confirm for Team
                      </button>
                      <button 
                        onClick={() => {
                          setViewMode('start_hiking');
                          setStartSelection('group');
                          setActiveRouteId(null);
                        }}
                        className="w-full bg-hike-green text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-hike-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles size={18} />
                        AI-powered route matching
                      </button>
                    </>
                  ) : (
                    /* Teammate View in Preview */
                    <div className="space-y-3">
                      <div className={`p-4 rounded-2xl border-2 text-center animate-fade-in ${createdGroup.status === 'confirmed' && createdGroup.routeId === activeRoute.id ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                        {createdGroup.status === 'confirmed' && createdGroup.routeId === activeRoute.id ? (
                           <>
                             <p className="font-bold text-orange-900 mb-1">✅ This route is confirmed!</p>
                             <p className="text-xs text-orange-700 mb-3">Captain has finalized this plan. Ready to join?</p>
                             <button 
                               onClick={() => handleSelectRoute(activeRoute.id, false)}
                               className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                             >
                               <Compass size={18} /> Join & Start Hike
                             </button>
                           </>
                        ) : (
                           <>
                             <p className="font-bold text-blue-900 mb-1">🏔️ Previewing with Team</p>
                             <p className="text-xs text-blue-700">Waiting for Captain to confirm the final route...</p>
                           </>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveRouteId(null)}
                        className="w-full bg-white text-gray-700 py-3 rounded-full font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                      >
                        <ArrowLeft size={20} /> Back to dashboard
                      </button>
                    </div>
                  )}
                </div>
              ) : activeRoute.isUserPublished ? (
                /* 🆕 Community Review Mode */
                <div className="space-y-3">
                  {/* Waypoints Preview */}
                  {((activeRoute as any).waypoints && (activeRoute as any).waypoints.length > 0) && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h4 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">Community Waypoints</h4>
                      <div className="space-y-2">
                        {((activeRoute as any).waypoints).slice(0, 3).map((wp: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                            <span className={wp.type === 'photo' ? 'text-blue-500' : 'text-red-500'}>{wp.type === 'photo' ? '📷' : '📍'}</span>
                            <span className="truncate flex-1">{wp.note || 'Waypoint'}</span>
                          </div>
                        ))}
                        {((activeRoute as any).waypoints).length > 3 && (
                          <div className="text-xs text-gray-400 text-center pt-1">+ {((activeRoute as any).waypoints).length - 3} more on map</div>
                        )}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                        // 将 Route 转换为 Track 格式供回顾
                        const track: Track = {
                          id: activeRoute.id,
                          name: activeRoute.name,
                          date: new Date(),
                          duration: activeRoute.duration,
                          distance: activeRoute.distance,
                          difficulty: activeRoute.difficulty,
                          coordinates: activeRoute.coordinates || [],
                          waypoints: (activeRoute as any).waypoints || []
                        };
                        onReviewTrack(track);
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <History size={20} /> Review Hike on Map
                  </button>
                  <button 
                    onClick={() => {
                        setGroupTitle(`Hike at ${activeRoute.name}`);
                        setViewMode('start_hiking');
                        setStartSelection('group');
                        setActiveRouteId(null);
                    }}
                    className="w-full bg-white text-orange-600 border border-orange-200 py-3 rounded-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-orange-50"
                  >
                    <Users size={20} /> Use Route for Group Hike
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => {
                        handleSelectRoute(activeRoute.id);
                    }}
                    className="w-full bg-hike-green text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Compass size={20} /> Preview
                  </button>
                  <button 
                    onClick={() => {
                        setGroupTitle(`Hike at ${activeRoute.name}`);
                        setViewMode('start_hiking');
                        setStartSelection('group');
                        setActiveRouteId(null);
                    }}
                    className="w-full bg-orange-500 text-white py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Users size={20} /> Start Group Hike
                  </button>
                </>
              )}
            </div>

            {/* Description */}
            <div className="select-text">
              <h3 className="font-bold text-lg mb-2 text-gray-800 select-text">Route Description</h3>
              <p className="text-gray-600 leading-relaxed text-sm select-text">
                {activeRoute.description}
              </p>
            </div>

             {/* Comments */}
             <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex justify-between items-center">
                  Hikers' Reviews <span className="text-sm font-normal text-gray-500">{MOCK_REVIEWS.length * 32} reviews</span>
                </h3>
                <div className="space-y-6">
                   {MOCK_REVIEWS.map(review => (
                     <div key={review.id} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                          <User size={20} className="text-gray-400" />
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="font-bold text-sm text-gray-800">{review.user}</span>
                                <div className="flex mt-0.5">
                                  {renderRating(review.rating)}
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium">{review.date}</span>
                           </div>
                           <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                        </div>
                     </div>
                   ))}
                </div>
                <button className="w-full mt-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
                  Show More Reviews
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // List View (Default)
  // 🆕 显示团队详情视图
  if (showTeamDetailsView && createdGroup) {
    return (
      <TeamDetailsView
        teamId={createdGroup.id}
        teamName={createdGroup.title}
        teamDescription={createdGroup.description}
        maxMembers={createdGroup.maxMembers}
        onBack={async () => {
          setShowTeamDetailsView(false);
          // If route confirmed and user clicks back, they might want to see the route
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', createdGroup.id).single();
          if (teamData?.status === 'confirmed' || teamData?.target_route_id) {
            handleSelectRoute(teamData.target_route_id, teamData.created_by === currentUserId);
          } else {
             // Otherwise just go back to start selection
             setStartSelection('');
          }
        }}
        onStartHike={async () => {
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', createdGroup.id).single();
          if (teamData?.target_route_id) {
            handleSelectRoute(teamData.target_route_id, teamData.created_by === currentUserId);
          }
        }}
        isTeamLeader={isLeader}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1 font-bold text-lg">
            <MapPin size={20} className="text-hike-green" />
            <span>{selectedCity}</span>
          </div>
          <div className="text-sm text-gray-500">Sunny, 24°C</div>
        </div>
        
        {/* Functional Buttons (Active Now) */}
        <div className="grid grid-cols-2 gap-4 mb-2">
           <button 
             onClick={() => { setViewMode('start_hiking'); }}
                className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center gap-3 transition-transform active:scale-95 shadow-sm"
            >
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <MapPin size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-gray-800">Start Hiking</div>
                <div className="text-xs text-gray-500">Find Routes</div>
              </div>
           </button>
           <button 
                onClick={() => setViewMode('events')}
                className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3 transition-transform active:scale-95 shadow-sm"
           >
              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                <Calendar size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-gray-800">Events</div>
                <div className="text-xs text-gray-500">Official Hikes</div>
              </div>
           </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by trail name (e.g. Hong Kong Trail Sec 1)..."
            value={routeSearchQuery}
            onChange={e => handleRouteSearch(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-hike-green text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-1.5 px-1 font-medium italic">
            💡 Hint: Enter trail name to filter results below
          </p>
        </div>
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-700">
               {showCommunityRoutes ? 'Community Shared Routes' : 'Official Trails'}
            </h3>
            <div className="flex bg-gray-200 rounded-lg p-1">
               <button 
                  onClick={() => setShowCommunityRoutes(false)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!showCommunityRoutes ? 'bg-white shadow-sm text-hike-green' : 'text-gray-500'}`}
               >
                  Official
               </button>
               <button 
                  onClick={() => setShowCommunityRoutes(true)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${showCommunityRoutes ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
               >
                  Community
               </button>
            </div>
        </div>
        
        {isLoadingRoutes ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <div className="w-10 h-10 border-4 border-hike-green border-t-transparent rounded-full animate-spin"></div>
             <p className="text-gray-400 font-medium animate-pulse">Loading amazing trails...</p>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
             <div className="text-4xl mb-2">🔭</div>
             <p className="text-gray-500 font-medium">No routes found matching your search.</p>
          </div>
        ) : filteredRoutes.map(route => (
          <div 
            key={route.id}
            onClick={() => setActiveRouteId(route.id)}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-all duration-300 cursor-pointer hover:shadow-md group"
          >
            <div className="aspect-[16/9] w-full bg-gray-100 relative overflow-hidden">
               <img 
                 src={route.imageUrl || (route as any).cover_url || (route as any).cover_image || `https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=800&auto=format&fit=crop`} 
                 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                 alt={route.name} 
                 loading="lazy"
                 onError={(e) => {
                    // 如果加载失败，尝试使用 unsplash 关键词搜索一张相关的图
                    (e.target as HTMLImageElement).src = `https://source.unsplash.com/featured/?hiking,mountain,trail&sig=${route.id}`;
                 }}
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
               <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/30">
                    {route.region}
                  </span>
               </div>
               {route.isUserPublished && (
                 <div className="absolute top-3 right-3 bg-hike-accent text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <User size={10} /> Community
                 </div>
               )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-2">
                 <h4 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-hike-green transition-colors">{route.name}</h4>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                 {renderRating(route.difficulty)}
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Difficulty {route.difficulty}/5</span>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-gray-50 pt-4 text-gray-600">
                <div className="flex flex-col items-center">
                   <Mountain size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.elevationGain}m</span>
                </div>
                <div className="flex flex-col items-center border-x border-gray-50">
                   <Compass size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.distance}</span>
                </div>
                <div className="flex flex-col items-center">
                   <Clock size={14} className="text-gray-400 mb-1" />
                   <span className="text-xs font-bold text-gray-800">{route.duration}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanningView;