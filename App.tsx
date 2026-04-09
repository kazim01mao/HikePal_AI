// App.tsx 完整逻辑参考
import React, { useState, useEffect } from 'react';
import { Tab, User, Route, Track } from './types';
import { supabase } from './utils/supabaseClient';
import { AuthPage } from './components/AuthPage';
import PlanningView from './components/PlanningView';
import CompanionView from './components/CompanionView';
import HomeView from './components/HomeView';
import TeamMemberPreferenceForm from './components/TeamMemberPreferenceForm';
import HikePalLogo from './components/HikePalLogo';
import { User as UserIcon, Compass } from 'lucide-react';
import { useHikeStore } from './store/hikeStore';
import { uploadRouteToCommunity } from './services/segmentRoutingService';
interface AppState {
  error: string | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, AppState> {
  state: AppState = { error: null };
  props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">应用崩溃了</h1>
            <p className="text-gray-600 mb-4 font-mono text-sm break-words">{this.state.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 rounded-lg font-bold"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
const App: React.FC = () => {
  const resetCompanionSession = () => {
    useHikeStore.getState().reset();
  };

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PLANNING);
  const [exploreKey, setExploreKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [myGroupHikes, setMyGroupHikes] = useState([]);
  const [newTeamId, setNewTeamId] = useState<string | null>(null);
  
  // 支持两种邀请链接：
  // 1) ?team=<team_id> (current)
  // 2) ?code=<invite_code> (legacy / teamService.generateInviteLink)
  const [teamIdFromUrl, setTeamIdFromUrl] = useState<string | null>(null);
  const [isResolvingInvite, setIsResolvingInvite] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resolveInvite = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const directTeamId = params.get('team');
        if (directTeamId) {
          if (!cancelled) {
            setTeamIdFromUrl(directTeamId);
            setIsResolvingInvite(false);
          }
          return;
        }

        const inviteCode = params.get('code');
        if (!inviteCode) {
          if (!cancelled) {
            setTeamIdFromUrl(null);
            setIsResolvingInvite(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('teams')
          .select('id')
          .eq('invite_code', inviteCode.toUpperCase())
          .single();

        if (!cancelled) {
          if (!error && data?.id) {
            setTeamIdFromUrl(data.id);
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            url.searchParams.set('team', data.id);
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
          } else {
            setTeamIdFromUrl(null);
          }
          setIsResolvingInvite(false);
        }
      } catch {
        if (!cancelled) {
          setTeamIdFromUrl(null);
          setIsResolvingInvite(false);
        }
      }
    };

    resolveInvite();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Initialize session ID once (persistent across refreshes)
  const [sessionId] = useState(() => {
    // 1. Check URL param (e.g. ?session=test)
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    if (urlSession) return urlSession;

    // 2. Check session storage
    const stored = sessionStorage.getItem('hike_session_id');
    if (stored) return stored;

    // 3. Create new
    const newId = `session_${Date.now()}`;
    sessionStorage.setItem('hike_session_id', newId);
    return newId;
  });

  const handleSaveTrack = async (track: Track) => {
    // 1. Optimistic update
    setMyTracks(prev => [...prev, track]);
    
    if (user) {
      try {
        const isUuid = (value: string | null | undefined): boolean =>
          !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        const resolveOfficialRouteBinding = async (
          sourceRouteId: string | null | undefined,
          sourceRouteName: string | null | undefined
        ) => {
          let officialRoute: any = null;
          let routeMatchMethod = 'unmatched';

          if (isUuid(sourceRouteId || '')) {
            const byId = await supabase
              .from('official_trails_backend')
              .select('id, name, cover_url, difficulty')
              .eq('id', sourceRouteId)
              .maybeSingle();
            if (!byId.error && byId.data) {
              officialRoute = byId.data;
              routeMatchMethod = 'official_id';
            }
          }

          if (!officialRoute && sourceRouteName) {
            const exactByName = await supabase
              .from('official_trails_backend')
              .select('id, name, cover_url, difficulty')
              .eq('name', sourceRouteName)
              .limit(1)
              .maybeSingle();
            if (!exactByName.error && exactByName.data) {
              officialRoute = exactByName.data;
              routeMatchMethod = 'official_name_exact';
            }
          }

          if (!officialRoute && sourceRouteName) {
            const fuzzyByName = await supabase
              .from('official_trails_backend')
              .select('id, name, cover_url, difficulty')
              .ilike('name', `%${sourceRouteName}%`)
              .limit(1)
              .maybeSingle();
            if (!fuzzyByName.error && fuzzyByName.data) {
              officialRoute = fuzzyByName.data;
              routeMatchMethod = 'official_name_fuzzy';
            }
          }

          let officialSegmentIds: string[] = [];
          if (officialRoute?.id) {
            const conn = await supabase
              .from('official_connection_backend')
              .select('segment_id, sort_order')
              .eq('route_id', officialRoute.id)
              .order('sort_order', { ascending: true });
            if (!conn.error && Array.isArray(conn.data)) {
              officialSegmentIds = conn.data
                .map((row: any) => row.segment_id)
                .filter(Boolean)
                .map((seg: any) => String(seg));
            }
          }

          return {
            officialRouteId: officialRoute?.id || null,
            officialRouteName: officialRoute?.name || null,
            officialCoverUrl: officialRoute?.cover_url || null,
            officialDifficulty: officialRoute?.difficulty || null,
            officialSegmentIds,
            routeMatchMethod
          };
        };

        const normalizeWaypoint = (wp: any) => {
          if (!wp) return null;
          const lat = Number(wp.lat);
          const lng = Number(wp.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            ...wp,
            lat,
            lng,
            emoji: typeof wp.emoji === 'string' ? wp.emoji : undefined,
            note: typeof wp.note === 'string' ? wp.note : undefined,
            imageUrl: typeof wp.imageUrl === 'string' ? wp.imageUrl : undefined
          };
        };

        // 2. Save to Supabase (compat fallback for schemas without difficulty column)
        const baseTrackPayload: any = {
          user_id: user.id,
          name: track.name,
          date: track.date,
          duration: track.duration,
          distance: track.distance,
          coordinates: track.coordinates, // JSONB
          waypoints: track.waypoints
        };
        const withDifficultyPayload = { ...baseTrackPayload, difficulty: track.difficulty };

        let insertedTrack: { id?: string } | null = null;
        let error: any = null;

        const insertWithDifficulty = await supabase
          .from('user_tracks')
          .insert(withDifficultyPayload)
          .select('id')
          .single();

        insertedTrack = insertWithDifficulty.data as any;
        error = insertWithDifficulty.error;

        if (error && (String(error.code) === '42703' || String(error.message || '').toLowerCase().includes('difficulty'))) {
          const fallbackInsert = await supabase
            .from('user_tracks')
            .insert(baseTrackPayload)
            .select('id')
            .single();
          insertedTrack = fallbackInsert.data as any;
          error = fallbackInsert.error;
        }

        if (error) {
          console.error('Error saving track to Supabase:', error);
          // Optional: revert state if failed
        } else {
          console.log('Track saved to Supabase:', track);
          const savedTrackId = insertedTrack?.id ? String(insertedTrack.id) : '';

          if (savedTrackId) {
            const rawWaypoints = Array.isArray(track.waypoints) ? track.waypoints : [];
            const normalizedWaypoints = rawWaypoints
              .map(normalizeWaypoint)
              .filter(Boolean) as any[];

            // Keep original image URLs from emotion-images; no bucket copy.
            const persistedWaypoints = normalizedWaypoints;

            const routeShape = Array.isArray(track.routeShape) && track.routeShape.length > 0
              ? track.routeShape
              : track.coordinates || [];
            const relatedReminders = Array.isArray(track.relatedReminders) ? track.relatedReminders : [];
            const officialRouteBinding = await resolveOfficialRouteBinding(
              track.routeId || null,
              track.routeName || track.name || null
            );

            try {
              const { data: contextData, error: contextError } = await supabase
                .from('profile_track_route_contexts')
                .upsert(
                  {
                    track_id: savedTrackId,
                    user_id: user.id,
                    route_id: track.routeId || null,
                    route_name: track.routeName || track.name || null,
                    official_route_id: officialRouteBinding.officialRouteId,
                    official_route_name: officialRouteBinding.officialRouteName,
                    official_cover_url: officialRouteBinding.officialCoverUrl,
                    official_difficulty: officialRouteBinding.officialDifficulty,
                    official_segment_ids: officialRouteBinding.officialSegmentIds,
                    route_match_method: officialRouteBinding.routeMatchMethod,
                    route_shape: routeShape,
                    related_reminders: relatedReminders
                  },
                  { onConflict: 'track_id' }
                )
                .select('id')
                .single();

              if (contextError) {
                console.warn('Failed to save route context (profile_track_route_contexts):', contextError);
              } else if (contextData?.id) {
                const markerRows = persistedWaypoints
                  .filter((wp: any) => wp && wp.type !== 'reminder')
                  .map((wp: any) => ({
                    context_id: contextData.id,
                    track_id: savedTrackId,
                    user_id: user.id,
                    emoji: wp.emoji || null,
                    note: wp.note || null,
                    image_url: wp.imageUrl || null,
                    latitude: Number(wp.lat),
                    longitude: Number(wp.lng)
                  }))
                  .filter((row: any) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));

                await supabase
                  .from('profile_track_markers')
                  .delete()
                  .eq('track_id', savedTrackId)
                  .eq('user_id', user.id);

                if (markerRows.length > 0) {
                  const { error: markerError } = await supabase
                    .from('profile_track_markers')
                    .insert(markerRows);
                  if (markerError) {
                    console.warn('Failed to save profile_track_markers:', markerError);
                  }
                }
              }
            } catch (bindError) {
              console.warn('Profile binding tables not available yet, skipped route/emoji/image binding save:', bindError);
            }

            // Persist AI-generated route usage snapshot into ai_route_matches schema.
            if (track.aiGenerated) {
              try {
                let topRouteId: string | null = null;
                if (isUuid(track.routeId || '')) {
                  const { data: routeExists, error: routeCheckError } = await supabase
                    .from('routes')
                    .select('id')
                    .eq('id', track.routeId)
                    .maybeSingle();
                  if (!routeCheckError && routeExists?.id) {
                    topRouteId = String(routeExists.id);
                  }
                }

                const aiMatchedRoutesPayload = Array.isArray(track.aiMatchedRoutes) && track.aiMatchedRoutes.length > 0
                  ? track.aiMatchedRoutes
                  : [
                      {
                        route_id: track.routeId || null,
                        route_name: track.routeName || track.name || null,
                        reason: 'Saved from AI generated route',
                        route_data: {
                          coordinates: routeShape,
                          related_reminders: relatedReminders
                        }
                      }
                    ];

                const { error: aiMatchInsertError } = await supabase
                  .from('ai_route_matches')
                  .insert({
                    user_id: user.id,
                    session_id: sessionId,
                    user_mood: track.aiUserMood || null,
                    user_difficulty: track.aiUserDifficulty || null,
                    user_condition: track.aiUserCondition || null,
                    matched_routes: aiMatchedRoutesPayload,
                    top_route_id: topRouteId,
                    used_at: new Date().toISOString()
                  });

                if (aiMatchInsertError) {
                  console.warn('Failed to save ai_route_matches for save-to-profile:', aiMatchInsertError);
                }
              } catch (aiSaveErr) {
                console.warn('ai_route_matches save skipped due to error:', aiSaveErr);
              }
            }
          }
          
          // 3. Update user_stats
          // Parse distance (e.g. "5.2 km" -> 5.2)
          const distVal = parseFloat(track.distance) || 0;
          
          // We use RPC or manual update. For simplicity, let's just insert track. 
          // We can let HomeView calculate stats from tracks, OR update stats table.
          // Let's update stats table for consistency if other views use it.
          const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).single();
          
          if (stats) {
             await supabase.from('user_stats').update({
               total_distance_km: (stats.total_distance_km || 0) + distVal,
               total_hikes_completed: (stats.total_hikes_completed || 0) + 1,
               // elevation?
             }).eq('user_id', user.id);
          } else {
             await supabase.from('user_stats').insert({
               user_id: user.id,
               total_distance_km: distVal,
               total_hikes_completed: 1
             });
          }

          // If this was a team hike, mark it as completed (Done)
          if (selectedTeamId) {
            const { error: teamUpdateError } = await supabase
              .from('teams')
              .update({ status: 'completed', finished_at: new Date().toISOString() })
              .eq('id', selectedTeamId);
            if (teamUpdateError) {
              console.error('Failed to mark team completed:', teamUpdateError);
            } else {
              setMyGroupHikes(prev =>
                prev.map(t => (t.id === selectedTeamId ? { ...t, status: 'completed' } : t)) as any
              );
            }
          }
        }
      } catch (err) {
        console.error('Exception saving track:', err);
      }
    }
  };

  const handlePublishTrack = async (track: Track) => {
    if (!user?.id) return;
    try {
      const distanceVal = parseFloat((track.distance || '').replace(/[^0-9.]/g, '')) || 0;
      const durationVal = typeof track.duration === 'string'
        ? parseFloat(track.duration.replace(/[^0-9.]/g, '')) || 0
        : Number(track.duration || 0);
      const baseWaypoints = Array.isArray((track as any).waypoints) ? (track as any).waypoints : [];

      // Backward compatibility:
      // older records may have photos only in team_member_emotions, not in user_tracks.waypoints.
      let legacyEmotionRows: any[] = [];
      try {
        const routeId = (track as any).routeId || null;
        if (routeId) {
          const { data } = await supabase
            .from('team_member_emotions')
            .select('id, route_id, content, latitude, longitude, image_url, created_at')
            .eq('user_id', user.id)
            .eq('route_id', String(routeId))
            .not('image_url', 'is', null)
            .order('created_at', { ascending: true })
            .limit(100);
          legacyEmotionRows = data || [];
        } else if (track.date) {
          const center = new Date(track.date).getTime();
          const from = new Date(center - 12 * 60 * 60 * 1000).toISOString();
          const to = new Date(center + 12 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from('team_member_emotions')
            .select('id, route_id, content, latitude, longitude, image_url, created_at')
            .eq('user_id', user.id)
            .not('image_url', 'is', null)
            .gte('created_at', from)
            .lte('created_at', to)
            .order('created_at', { ascending: true })
            .limit(100);
          legacyEmotionRows = data || [];
        }
      } catch (legacyErr) {
        console.warn('Failed to load legacy team_member_emotions for publish fallback:', legacyErr);
      }

      const legacyWaypoints = legacyEmotionRows
        .filter((row: any) => typeof row.latitude === 'number' && typeof row.longitude === 'number')
        .map((row: any) => ({
          id: `legacy-emotion-${row.id}`,
          lat: row.latitude,
          lng: row.longitude,
          type: 'emotion',
          note: row.content || 'Emotion Note',
          imageUrl: row.image_url
        }));

      const dedupeKey = (wp: any) =>
        `${Number(wp.lat).toFixed(6)}|${Number(wp.lng).toFixed(6)}|${String(wp.imageUrl || '')}`;
      const mergedWaypoints = [...baseWaypoints, ...legacyWaypoints].filter((wp: any) =>
        wp && typeof wp.lat === 'number' && typeof wp.lng === 'number'
      );
      const seen = new Set<string>();
      const normalizedWaypoints = mergedWaypoints.filter((wp: any) => {
        const key = dedupeKey(wp);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const firstImage = normalizedWaypoints.find((wp: any) => typeof wp.imageUrl === 'string' && wp.imageUrl.trim().length > 0)?.imageUrl || null;

      await uploadRouteToCommunity(user.id, {
        name: track.name || 'My Hike',
        description: 'Shared from my hike history',
        region: 'Hong Kong',
        tags: ['community'],
        route_data: {
          distance: `${distanceVal.toFixed(1)}km`,
          distance_val: distanceVal,
          duration: typeof track.duration === 'string' ? track.duration : `${Math.round(durationVal)}h`,
          duration_val: durationVal,
          difficulty: track.difficulty || 3,
          elevationGain: (track as any).elevationGain || 0,
          coordinates: track.coordinates || [],
          waypoints: normalizedWaypoints,
          imageUrl: firstImage,
          cover_image: firstImage,
          cover_url: firstImage
        }
      });
    } catch (e) {
      console.error('Failed to publish track:', e);
      throw e;
    }
  };

  const handleDeleteGroupHike = async (groupId: string, isOrganizer: boolean) => {
    if (!user?.id) throw new Error('User not authenticated');

    if (isOrganizer) {
      const { error } = await supabase.from('teams').delete().eq('id', groupId);
      if (error) {
        console.error('Failed to delete team:', error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', groupId)
        .eq('user_id', user.id);
      if (error) {
        console.error('Failed to leave team:', error);
        throw error;
      }
    }

    setMyGroupHikes(prev => prev.filter((t: any) => t.id !== groupId) as any);
    if (selectedTeamId === groupId) {
      setSelectedTeamId(undefined);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_tracks')
      .delete()
      .eq('id', trackId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete track:', error);
      throw error;
    }

    setMyTracks(prev => prev.filter((t) => String(t.id) !== String(trackId)));
  };

  useEffect(() => {
    // 1. 初始化检查登录状态
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as any);
        // Load tracks
        loadUserTracks(session.user.id);
        loadUserTeams(session.user.id);
      }
      setLoading(false);
    });

    // 2. 监听状态变化（登录或退出）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user as any || null;
      // Don't override if it's already a guest session
      setUser(prev => {
        if (prev?.isGuest && !currentUser) return prev;
        return currentUser;
      });
      
      if (currentUser) {
        loadUserTracks(currentUser.id);
        loadUserTeams(currentUser.id);
      } else {
        // Only clear if not guest
        setUser(prev => {
          if (prev?.isGuest) return prev;
          setMyTracks([]);
          setMyGroupHikes([]);
          return null;
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserTeams = async (userId: string) => {
    try {
      // Find all team_ids where user is a member
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId);
        
      if (memberData && memberData.length > 0) {
        const teamIds = memberData.map(m => m.team_id);
        const { data: teamsData } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds)
          .order('created_at', { ascending: false });
          
        if (teamsData) {
          const mappedTeams = teamsData.map(t => ({
            id: t.id,
            title: t.name,
            description: t.description,
            date: t.created_at,
            maxMembers: t.max_team_size || 5,
            currentMembers: t.team_size || 1,
            isOrganizer: t.created_by === userId,
            members: [], // Only showing count
            status: t.status
          }));
          setMyGroupHikes(mappedTeams as any);
        }
      } else {
        setMyGroupHikes([]);
      }
    } catch (e) {
      console.error("Failed to load user teams", e);
    }
  };

  const loadUserTracks = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_tracks')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Failed to load tracks:', error);
        return;
      }

      if (data) {
        // Map DB fields to Track interface
        const mappedTracks: Track[] = data.map(t => {
          let coords = t.coordinates;
          let waypoints = t.waypoints;
          try {
            if (typeof coords === 'string') coords = JSON.parse(coords);
            if (typeof waypoints === 'string') waypoints = JSON.parse(waypoints);
          } catch {}
          return {
            id: t.id,
            name: t.name,
            date: t.date ? new Date(t.date) : new Date(),
            duration: t.duration,
            distance: t.distance,
            difficulty: t.difficulty || 0,
            coordinates: coords,
            waypoints: waypoints
          };
        });
        setMyTracks(mappedTracks);
      } else {
        setMyTracks([]);
      }
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
  };

  const handleRouteSelection = (route: Route) => {
    resetCompanionSession();
    setActiveRoute(route);
    // 🆕 如果 route 对象中携带了队长标志，则同步更新 App 的状态
    if ((route as any).isLeader !== undefined) {
      setIsLeader((route as any).isLeader);
    } else {
      setIsLeader(false);
    }
    // 🆕 注入 teamId 到 App 状态，确保在 CompanionView 中可见
    if ((route as any).teamId) {
      setSelectedTeamId((route as any).teamId);
    }
    setActiveTab(Tab.COMPANION);
  };

  // 🆕 回顾历史记录
  const handleReviewTrack = (track: Track) => {
    resetCompanionSession();
    const normalizeLatLng = (a: any, b: any): [number, number] | null => {
      if (typeof a !== 'number' || typeof b !== 'number') return null;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      if (absA <= 90 && absB <= 180) return [a, b];
      if (absB <= 90 && absA <= 180) return [b, a];
      return null;
    };

    const normalizePoint = (p: any): [number, number] | null => {
      if (Array.isArray(p) && p.length >= 2) {
        const [a, b] = p;
        return normalizeLatLng(a, b);
      }
      if (p && typeof p === 'object' && typeof p.lat === 'number' && typeof p.lng === 'number') {
        return normalizeLatLng(p.lat, p.lng);
      }
      if (p && typeof p === 'object' && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        return normalizeLatLng(p.latitude, p.longitude);
      }
      if (p && typeof p === 'object' && p.type === 'Point' && Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
        return normalizeLatLng(p.coordinates[1], p.coordinates[0]);
      }
      return null;
    };

    const sanitizeCoords = (raw: any): [number, number][] => {
      let candidate: any = raw;
      if (candidate && typeof candidate === 'object') {
        if (candidate.type === 'Feature' && candidate.geometry) {
          candidate = candidate.geometry;
        }
        if (candidate.type === 'LineString' && Array.isArray(candidate.coordinates)) {
          candidate = candidate.coordinates.map((pt: any) =>
            Array.isArray(pt) && pt.length >= 2 ? [pt[1], pt[0]] : pt
          );
        }
      }
      if (!Array.isArray(candidate)) return [];
      const cleaned: [number, number][] = [];
      candidate.forEach((pt) => {
        const norm = normalizePoint(pt);
        if (norm) cleaned.push(norm);
      });
      return cleaned;
    };

    let coords: any = track.coordinates;
    let waypoints: any = track.waypoints;
    try {
      if (typeof coords === 'string') coords = JSON.parse(coords);
      if (typeof waypoints === 'string') waypoints = JSON.parse(waypoints);
    } catch {}

    const normalizedCoords = sanitizeCoords(coords);

    const reviewRoute: Route = {
      id: track.id,
      name: track.name,
      region: 'Recorded Hike',
      distance: track.distance,
      duration: track.duration,
      difficulty: 0,
      description: 'Hike Review Mode',
      startPoint: '',
      endPoint: '',
      elevationGain: 0,
      coordinates: normalizedCoords
    };
    // 注入特殊标志
    (reviewRoute as any).isReview = true;
    (reviewRoute as any).historyWaypoints = Array.isArray(waypoints) ? waypoints : [];
    
    setActiveRoute(reviewRoute);
    setIsLeader(false);
    setActiveTab(Tab.COMPANION);
  };

  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
  const [isLeader, setIsLeader] = useState(false);

  const handleGotoPlanning = (teamId?: string) => {
    setSelectedTeamId(teamId);
    setActiveTab(Tab.PLANNING);
  };

  const handleCreateGroupHike = (hike: any) => {
    setMyGroupHikes(prev => [hike, ...prev] as any);
  };

  const handleJoinGroupHike = (hike: any) => {
    setMyGroupHikes(prev => [hike, ...prev] as any);
  };

  const handleGroupConfirmed = (sessionId: string) => {
    console.log("Group Confirmed! Session:", sessionId);
    setIsLeader(true);
    setActiveTab(Tab.COMPANION);
  };

  // 🆕 处理直接从首页开始组队徒步
  const handleStartGroupHike = async (teamId: string) => {
    try {
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
    if (teamData && (teamData.status === 'confirmed' || teamData.target_route_id || (teamData as any)?.target_route_data)) {
        let finalRouteData: any = null;
        const snapshot = (teamData as any)?.target_route_data;

        if (snapshot) {
          finalRouteData = snapshot;
        }

        if (!finalRouteData && teamData.target_route_id) {
            // 1. Try composed_routes first
            const { data: composedData } = await supabase.from('composed_routes').select('*').eq('id', teamData.target_route_id).single();
            // 2. Try official routes
            if (!composedData) {
               const { data: officialData } = await supabase.from('routes').select('*').eq('id', teamData.target_route_id).single();
               finalRouteData = officialData;
            } else {
               finalRouteData = composedData;
            }
        }
        
        const route: Route = {
          id: snapshot?.id || teamData.target_route_id || 'mock_route_' + Date.now(),
          name: snapshot?.name || teamData.target_route_name || finalRouteData?.name || 'Team Hike',
          region: snapshot?.region || finalRouteData?.region || 'Hong Kong',
          distance: snapshot?.distance || (finalRouteData?.total_distance ? `${finalRouteData.total_distance}km` : '0km'),
          duration: snapshot?.duration || (finalRouteData?.total_duration_minutes ? `${Math.round(finalRouteData.total_duration_minutes/60)}h` : '0h'),
          difficulty: snapshot?.difficulty || finalRouteData?.difficulty_level || 3,
          description: snapshot?.description || finalRouteData?.description || 'Team hike organized by captain.',
          startPoint: '',
          endPoint: '',
          elevationGain: snapshot?.elevationGain || finalRouteData?.total_elevation_gain || 0,
          coordinates: snapshot?.coordinates || finalRouteData?.full_coordinates || []
        };

        // Fallback for coordinates if they're missing but we have segments
        if ((!route.coordinates || route.coordinates.length === 0) && (snapshot?.segments || finalRouteData?.segments)) {
          const { mergeSegmentCoordinates } = await import('./services/segmentRoutingService');
          route.coordinates = mergeSegmentCoordinates(snapshot?.segments || finalRouteData.segments);
        }

        if (!route.coordinates || route.coordinates.length === 0) {
           // As a last resort for HK routes if still missing
           const { DRAGONS_BACK_COORDINATES } = await import('./utils/trailData');
           route.coordinates = DRAGONS_BACK_COORDINATES;
        }
        
        resetCompanionSession();
        setActiveRoute(route);
        setSelectedTeamId(teamId);
        setIsLeader(teamData.created_by === user?.id);
        setActiveTab(Tab.COMPANION);
      } else {
        // 如果没有路线，去 planning 页面选择
        setSelectedTeamId(teamId);
        setActiveTab(Tab.PLANNING);
      }
    } catch (e) {
      console.error("Error starting group hike from profile:", e);
      setSelectedTeamId(teamId);
      setActiveTab(Tab.PLANNING);
    }
  };

  // 🆕 如果 URL 中有 team 参数，显示成员表单或直接进入地图（不需要登录）
  const [guestActiveRoute, setGuestActiveRoute] = useState<Route | null>(null);
  const [guestCompletedTrack, setGuestCompletedTrack] = useState<Track | null>(null); // For non-logged in users after finishing a hike

  // --- 逻辑判断：如果未登录显示登录页 ---
  if (loading || isResolvingInvite) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  const teamLinkMemberId =
    !user && teamIdFromUrl && typeof window !== 'undefined'
      ? localStorage.getItem(`hikepal_team_member_id_${teamIdFromUrl}`) || ''
      : '';

  const renderNav = () => (
    <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around py-3 z-[9999] app-bottom-nav shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <button 
        onClick={() => {
          if (teamIdFromUrl) {
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = '/';
            return;
          }
          if (activeTab === Tab.PLANNING) {
             resetCompanionSession();
             setSelectedTeamId(undefined);
             setActiveRoute(null);
             setExploreKey(prev => prev + 1);
          } else {
             resetCompanionSession();
             setActiveTab(Tab.PLANNING);
             setSelectedTeamId(undefined);
             setActiveRoute(null);
          }
        }} 
        className={`flex flex-col items-center gap-1 transition-colors ${(!teamIdFromUrl && activeTab === Tab.PLANNING) ? 'text-hike-green' : 'text-gray-400'}`}
      >
        <Compass size={24} /><span className="text-[10px]">Explore</span>
      </button>
      <button 
        onClick={() => {
          if (teamIdFromUrl) return;
          setActiveTab(Tab.COMPANION);
        }} 
        className={`flex flex-col items-center gap-1 transition-colors ${((!teamIdFromUrl && activeTab === Tab.COMPANION) || teamIdFromUrl) ? 'text-hike-green' : 'text-gray-400'}`}
      >
        <HikePalLogo className="shrink-0" size={24} /><span className="text-[10px]">HikePal AI</span>
      </button>
      <button 
        onClick={() => {
          if (teamIdFromUrl) {
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = '/';
            return;
          }
          setActiveTab(Tab.HOME);
        }} 
        className={`flex flex-col items-center gap-1 transition-colors ${(!teamIdFromUrl && activeTab === Tab.HOME) ? 'text-hike-green' : 'text-gray-400'}`}
      >
        <UserIcon size={24} /><span className="text-[10px]">Profile</span>
      </button>
    </nav>
  );

  if (teamIdFromUrl) {
    if (guestCompletedTrack) {
      // 🆕 View shown to guests after they finish a hike
      return (
        <div className="flex flex-col h-screen bg-gray-50">
          <main className="flex-1 overflow-y-auto no-scrollbar relative app-main app-safe-top flex items-center justify-center p-6 pb-20">
             <div className="bg-white rounded-[32px] shadow-2xl p-8 max-w-sm w-full text-center border border-gray-100">
                <div className="w-16 h-16 bg-green-100 text-hike-green rounded-full flex items-center justify-center mx-auto mb-6">
                   <Compass size={32} />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Hike Completed!</h2>
                <p className="text-sm text-gray-500 mb-8">You've successfully finished the route with your team.</p>
                
                <div className="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100 text-left">
                   <div className="font-bold text-gray-900 mb-4">{guestCompletedTrack.name}</div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Distance</div>
                         <div className="font-black text-gray-900">{guestCompletedTrack.distance}</div>
                      </div>
                      <div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Time</div>
                         <div className="font-black text-gray-900">{guestCompletedTrack.duration}</div>
                      </div>
                   </div>
                </div>

                <button 
                  onClick={() => {
                     window.location.href = '/'; // Go back to root (login/signup page)
                  }}
                  className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"
                >
                  Sign Up to Save Next Time
                </button>
             </div>
          </main>
          {renderNav()}
        </div>
      );
    }

    if (guestActiveRoute) {
      return (
        <div className="flex flex-col h-screen bg-gray-50">
        <main className="flex-1 overflow-hidden no-scrollbar relative app-main app-safe-top">
          <CompanionView 
              user={user || {id: 'guest', name: 'Guest', email: '', role: 'hiker'}} // Use logged in user if available
              activeRoute={guestActiveRoute}
              onSaveTrack={(track) => {
                 if (user) {
                    handleSaveTrack(track);
                    // For logged in users, clear the URL param and go to Explore tab
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setActiveTab(Tab.PLANNING);
                    setGuestActiveRoute(null);
                 } else {
                    // For guests, show the completion view
                    setGuestCompletedTrack(track);
                 }
              }} 
              userId={user?.id || teamLinkMemberId || `guest_${teamIdFromUrl}`}
              sessionId={sessionId}
              teamId={teamIdFromUrl}
              isLeader={user?.id ? (myGroupHikes.find(h => h.id === teamIdFromUrl)?.isOrganizer || false) : false}
              onBack={() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                setGuestActiveRoute(null);
                if (user) {
                  setActiveTab(Tab.PLANNING);
                  setActiveRoute(null);
                } else {
                  window.location.href = '/';
                }
              }}
            />
          </main>
          {renderNav()}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <main className="flex-1 overflow-y-auto no-scrollbar relative app-main app-safe-top pb-16">
          <TeamMemberPreferenceForm 
            teamId={teamIdFromUrl}
            onSubmitSuccess={() => {
              if (user?.id) {
                loadUserTeams(user.id);
              }
            }}
            onStartHike={async () => {
               // User trying to start hike from group link
               try {
                 const { data: teamData, error: teamError } = await supabase.from('teams').select('*').eq('id', teamIdFromUrl).single();
                 
                 if (teamError) throw teamError;

                 if (teamData?.status === 'confirmed' || teamData?.target_route_id || (teamData as any)?.target_route_data) {
                   console.log('Starting hike for teammate. Route ID:', teamData.target_route_id, 'Name:', teamData.target_route_name);
                   
                   let finalRouteData: any = null;
                   const snapshot = (teamData as any)?.target_route_data;
                   
                   if (snapshot) {
                     finalRouteData = snapshot;
                   }

                   // If we have a UUID, try to fetch from DB
                   if (!finalRouteData && teamData.target_route_id) {
                       // 1. Try composed_routes first (for AI/Custom routes)
                       const { data: composedData } = await supabase.from('composed_routes').select('*').eq('id', teamData.target_route_id).single();
                       
                       // 2. Try official routes table (for standard trails)
                       if (!composedData) {
                          const { data: officialData } = await supabase.from('routes').select('*').eq('id', teamData.target_route_id).single();
                          finalRouteData = officialData;
                       } else {
                          finalRouteData = composedData;
                       }
                   }

                   if (!finalRouteData) {
                      console.warn('Route data not found in DB or no route ID provided. Using fallback minimal info based on name.');
                   }

                   const route: Route = {
                     id: snapshot?.id || teamData.target_route_id || 'mock_route_' + Date.now(),
                     name: snapshot?.name || teamData.target_route_name || finalRouteData?.name || 'Team Hike',
                     region: snapshot?.region || finalRouteData?.region || 'Hong Kong',
                     distance: snapshot?.distance || (finalRouteData?.total_distance ? `${finalRouteData.total_distance}km` : '0km'),
                     duration: snapshot?.duration || (finalRouteData?.total_duration_minutes ? `${Math.round(finalRouteData.total_duration_minutes/60)}h` : '0h'),
                     difficulty: snapshot?.difficulty || finalRouteData?.difficulty_level || 3,
                     description: snapshot?.description || finalRouteData?.description || 'Team hike organized by captain.',
                     startPoint: '', endPoint: '', elevationGain: snapshot?.elevationGain || finalRouteData?.total_elevation_gain || 0,
                     coordinates: snapshot?.coordinates || finalRouteData?.full_coordinates || []
                   };

                   // Fallback for coordinates if they're missing but we have segments
                   if ((!route.coordinates || route.coordinates.length === 0) && (snapshot?.segments || finalRouteData?.segments)) {
                     const { mergeSegmentCoordinates } = await import('./services/segmentRoutingService');
                     route.coordinates = mergeSegmentCoordinates(snapshot?.segments || finalRouteData.segments);
                   }
                   
                   if (!route.coordinates || route.coordinates.length === 0) {
                      console.warn('No coordinates found for route:', teamData.target_route_id || teamData.target_route_name);
                      // Fallback coordinates if absolutely necessary
                      const { DRAGONS_BACK_COORDINATES } = await import('./utils/trailData');
                      route.coordinates = DRAGONS_BACK_COORDINATES; 
                   }

                  resetCompanionSession();
                  setGuestActiveRoute(route);
                 } else {
                   alert('Route not confirmed yet. Please wait for the captain.');
                 }
               } catch (err) {
                 console.error('Error in onStartHike:', err);
                 alert('Failed to start hike. Please try again.');
               }
            }}
            onBack={user ? () => {
              // If logged in, clear URL and go to home
              window.history.replaceState({}, document.title, window.location.pathname);
              window.location.href = '/';
            } : undefined} // If not logged in, don't show back button, force them to stay on the waiting page
          />
        </main>
        {renderNav()}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <main className="flex-1 overflow-y-auto no-scrollbar relative app-main app-safe-top pb-16">
          <AuthPage onLoginSuccess={(u) => setUser(u)} />
        </main>
        {renderNav()}
      </div>
    );
  }

  // --- 逻辑判断：如果已登录显示主界面 ---
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className={`flex-1 no-scrollbar relative app-main app-safe-top ${activeTab === Tab.COMPANION ? 'overflow-hidden' : 'overflow-y-auto pb-16'}`}>
        <div style={{ display: activeTab === Tab.PLANNING ? 'block' : 'none', height: '100%' }}>
          <PlanningView 
            key={`explore-${exploreKey}`}
            currentUserId={user.id} 
            onSelectRoute={(route) => {
              handleRouteSelection(route);
              // Handle leader status from route object if injected
              if ((route as any).isLeader !== undefined) {
                setIsLeader((route as any).isLeader);
              }
            }}
            onReviewTrack={handleReviewTrack}
            initialTeamId={selectedTeamId}
          />
        </div>
        
        {activeTab === Tab.COMPANION && (
          <CompanionView 
            key={`companion-${activeRoute?.id || 'no-route'}-${selectedTeamId || 'solo'}-${(activeRoute as any)?.isReview ? 'review' : 'hike'}`}
            user={user}
            activeRoute={activeRoute}
            onSaveTrack={(track) => {
               handleSaveTrack(track);
               // Force navigation back to Planning (Explore) tab upon completion
               resetCompanionSession();
               setActiveTab(Tab.PLANNING);
               setActiveRoute(null);
            }}
            userId={user.id}
            sessionId={sessionId}
            teamId={selectedTeamId}
            isLeader={isLeader}
            onBack={async () => {
              // If user quits a team hike, mark team as completed (Done)
              if (selectedTeamId) {
                const { error: teamUpdateError } = await supabase
                  .from('teams')
                  .update({ status: 'completed', finished_at: new Date().toISOString() })
                  .eq('id', selectedTeamId);
                if (teamUpdateError) {
                  console.error('Failed to mark team completed on quit:', teamUpdateError);
                } else {
                  setMyGroupHikes(prev =>
                    prev.map(t => (t.id === selectedTeamId ? { ...t, status: 'completed' } : t)) as any
                  );
                }
              }
              resetCompanionSession();
              setActiveTab(Tab.PLANNING);
              setActiveRoute(null);
            }}
          />
        )}
        {activeTab === Tab.HOME && (
          <HomeView 
            user={user}
            onLogout={() => {
              if (user.isGuest) {
                setUser(null);
                setActiveTab(Tab.PLANNING);
              } else {
                supabase.auth.signOut();
              }
            }}
            myTracks={myTracks}
            myGroupHikes={myGroupHikes}
            onPublishTrack={handlePublishTrack}
            onDeleteGroupHike={handleDeleteGroupHike}
            onDeleteTrack={handleDeleteTrack}
            onReviewTrack={handleReviewTrack}
            onPreviewTeamRoute={async (teamId) => {
              try {
                const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
                if (teamData && (teamData.target_route_id || (teamData as any)?.target_route_data)) {
                  let finalRouteData: any = null;
                  const snapshot = (teamData as any)?.target_route_data;
                  if (snapshot) {
                    finalRouteData = snapshot;
                  }
                  if (!finalRouteData && teamData.target_route_id) {
                    const { data: composedData } = await supabase.from('composed_routes').select('*').eq('id', teamData.target_route_id).single();
                    if (composedData) finalRouteData = composedData;
                    else {
                      const { data: officialData } = await supabase.from('routes').select('*').eq('id', teamData.target_route_id).single();
                      finalRouteData = officialData;
                    }
                  }

                  const route: Route = {
                    id: snapshot?.id || teamData.target_route_id || 'mock_route_' + Date.now(),
                    name: snapshot?.name || teamData.target_route_name || finalRouteData?.name || 'Team Hike',
                    region: snapshot?.region || finalRouteData?.region || 'Hong Kong',
                    distance: snapshot?.distance || (finalRouteData?.total_distance ? `${finalRouteData.total_distance}km` : '0km'),
                    duration: snapshot?.duration || (finalRouteData?.total_duration_minutes ? `${Math.round(finalRouteData.total_duration_minutes/60)}h` : '0h'),
                    difficulty: snapshot?.difficulty || finalRouteData?.difficulty_level || 3,
                    description: snapshot?.description || finalRouteData?.description || 'Team hike organized by captain.',
                    startPoint: '',
                    endPoint: '',
                    elevationGain: snapshot?.elevationGain || finalRouteData?.total_elevation_gain || 0,
                    coordinates: snapshot?.coordinates || finalRouteData?.full_coordinates || []
                  };

                  if ((!route.coordinates || route.coordinates.length === 0) && (snapshot?.segments || finalRouteData?.segments)) {
                    const { mergeSegmentCoordinates } = await import('./services/segmentRoutingService');
                    route.coordinates = mergeSegmentCoordinates(snapshot?.segments || finalRouteData.segments);
                  }
                  if (!route.coordinates || route.coordinates.length === 0) {
                    const { DRAGONS_BACK_COORDINATES } = await import('./utils/trailData');
                    route.coordinates = DRAGONS_BACK_COORDINATES;
                  }

                  resetCompanionSession();
                  setActiveRoute(route);
                  setIsLeader(false);
                  setSelectedTeamId(teamId);
                  setActiveTab(Tab.COMPANION);
                } else {
                  alert('No route data available for this team.');
                }
              } catch (e) {
                console.error('Failed to preview team route:', e);
                alert('Failed to preview route.');
              }
            }}
            onGotoPlanning={(teamId) => {
              // 如果团队已确认，尝试直接进入地图
              const team = myGroupHikes.find(h => h.id === teamId);
              if (team && (team as any).status === 'confirmed') {
                handleStartGroupHike(teamId!);
              } else {
                handleGotoPlanning(teamId);
              }
            }}
          />
        )}
      </main>
      {renderNav()}
    </div>
  );
};

function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default RootApp;
