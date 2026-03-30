import React, { useState, useEffect, useRef } from 'react';
import { Message, Route, Teammate, Track, Waypoint, User } from '../types';
import { generateHikingAdvice, generateReminderReply } from '../services/geminiService';
import { uploadRouteToCommunity, mergeSegmentCoordinates } from '../services/segmentRoutingService';
import { Mic, Send, Navigation, Camera, AlertCircle, Map as MapIcon, Users, Droplet, Tent, Cigarette, Info, MessageSquare, Play, Square, Save, Upload, Compass, MapPin, Thermometer, Wind, Phone, Bell, ShieldAlert, ArrowLeft, Star, Activity, Clock, X, Edit3, Check, ChevronRight, History as HistoryIcon, Sparkles, MoveDiagonal2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { DRAGONS_BACK_COORDINATES } from '../utils/trailData';
import { useHikeStore, RouteData } from '../store/hikeStore';
import { usePathScrubbing } from '../hooks/usePathScrubbing';
import { MovementModeModal } from './MovementModeModal';
import { fetchHongKongCurrentWeather, formatWeatherForPrompt } from '../services/hkWeatherService';

// --- Utility Functions ---
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371e3; 
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) { return deg * (Math.PI / 180); }

function isPointNearRoute(pointLat: number, pointLng: number, routeCoords: [number, number][], maxDistanceMeters: number = 200) {
  if (!routeCoords || routeCoords.length === 0) return false;
  for (const coord of routeCoords) {
    if (getDistanceFromLatLonInM(pointLat, pointLng, coord[0], coord[1]) <= maxDistanceMeters) return true;
  }
  return false;
}

function normalizeLatLng(a: number, b: number): [number, number] | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (absA <= 90 && absB <= 180) return [a, b]; // [lat, lng]
  if (absB <= 90 && absA <= 180) return [b, a]; // [lng, lat] -> swap
  return null;
}

function normalizePoint(p: any): [number, number] | null {
  if (Array.isArray(p) && p.length >= 2) {
    const [a, b] = p;
    if (typeof a === 'number' && typeof b === 'number') return normalizeLatLng(a, b);
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
}

function isValidPoint(p: any): p is [number, number] {
  return normalizePoint(p) !== null;
}

function sanitizeRouteCoords(raw: any): [number, number][] {
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
}

function parseGeographyPoint(geoObj: any): [number, number] | null {
  if (!geoObj) return null;
  if (geoObj.type === 'Point' && Array.isArray(geoObj.coordinates)) return [geoObj.coordinates[1], geoObj.coordinates[0]];
  if (typeof geoObj === 'string') {
    try {
      const parsed = JSON.parse(geoObj);
      if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) return [parsed.coordinates[1], parsed.coordinates[0]];
    } catch(e) {}
  }
  return null;
}

const getCoords = (r: any): [number, number] | null => {
  // Handle GeoJSON format if present
  if (r.geojson) {
    let g = r.geojson;
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch(e) {} }
    if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
       return normalizeLatLng(g.coordinates[1], g.coordinates[0]);
    }
  }
  // Handle plain array coordinates
  if (Array.isArray(r.coordinates) && r.coordinates.length >= 2) {
    const [a, b] = r.coordinates;
    if (typeof a === 'number' && typeof b === 'number') {
      return normalizeLatLng(a, b);
    }
  }
  // Handle lat/lng fields
  if (typeof r.lat === 'number' && typeof r.lng === 'number') {
    return normalizeLatLng(r.lat, r.lng);
  }
  if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
    return normalizeLatLng(r.latitude, r.longitude);
  }
  // Handle Hex/EWKB Point heuristic for standard HK coordinates
  if (typeof r.coordinates === 'string' && r.coordinates.startsWith('0101')) {
     console.warn('DEBUG: Binary coordinates detected, please ensure RPC is installed.');
  }
  
  // Fallback to parseGeographyPoint for legacy JSON coordinates
  if (!r.coordinates) return null;
  if (r.coordinates.type === 'Point' && Array.isArray(r.coordinates.coordinates)) {
    return normalizeLatLng(r.coordinates.coordinates[1], r.coordinates.coordinates[0]);
  }
  if (typeof r.coordinates === 'string') {
    try {
      const parsed = JSON.parse(r.coordinates);
      if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) {
        return normalizeLatLng(parsed.coordinates[1], parsed.coordinates[0]);
      }
    } catch(e) {}
    // WKT like "POINT (114.17 22.25)" or "POINT(114.17 22.25)"
    const wktMatch = r.coordinates.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (wktMatch) {
      const lng = Number(wktMatch[1]);
      const lat = Number(wktMatch[2]);
      return normalizeLatLng(lat, lng);
    }
    // Comma-separated "lat,lng" or "lng,lat"
    const csvMatch = r.coordinates.match(/^\s*([-\d.]+)\s*,\s*([-\d.]+)\s*$/);
    if (csvMatch) {
      const a = Number(csvMatch[1]);
      const b = Number(csvMatch[2]);
      return normalizeLatLng(a, b);
    }
  }
  return null;
};

interface EmotionNote {
  id: string | number;
  team_id?: string | null;
  route_id?: string | null;
  user_id: string;
  user_name?: string | null;
  content: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  created_at?: string | null;
}

const isMissingRouteScopeColumnError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' || (message.includes('route_id') && message.includes('column'));
};

const isEmotionNotePermissionError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42501' || message.includes('row-level security');
};

const filterNotesForRoute = (notes: EmotionNote[], activeRouteId: string | null) => {
  if (!activeRouteId) return notes;
  return notes.filter(note => !note.route_id || String(note.route_id) === String(activeRouteId));
};

interface CompanionViewProps {
  user: User;
  activeRoute: Route | null;
  onSaveTrack: (track: Track) => void;
  userId: string;
  sessionId: string;
  onBack?: () => void;
  teamId?: string;
  isLeader?: boolean;
}

const CompanionView: React.FC<CompanionViewProps> = ({ user, activeRoute, onSaveTrack, userId, sessionId, onBack, teamId, isLeader }) => {
  // --- States ---
  const [cardPos, setCardPos] = useState({ x: 16, y: 100 });
  const [cardSize, setCardSize] = useState({ w: 280, h: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 280, h: 360 });
  const cardRef = useRef<HTMLDivElement>(null);

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [panelMode, setPanelMode] = useState<'map' | 'chat'>('map'); 
  const [chatType, setChatType] = useState<'ai' | 'team'>('ai');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [trackName, setTrackName] = useState(activeRoute?.name || 'My Hike');
  const [showSOS, setShowSOS] = useState(false);
  const [riskZones, setRiskZones] = useState<any[]>([]);
  const lastUploadRef = useRef<number>(0);
  const [isUploadingRoute, setIsUploadingRoute] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({ name: '', description: '', tags: '' });
  const [riskStats, setRiskStats] = useState({ temp: 24, humidity: 78, condition: 'Sunny' });
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [recordedPath, setRecordedPath] = useState<[number, number][]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [reminderInfo, setReminderInfo] = useState<any[]>([]);
  const alertedItemsRef = useRef<Set<string>>(new Set());
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteImage, setNoteImage] = useState<File | null>(null);
  const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [emotionNotes, setEmotionNotes] = useState<EmotionNote[]>([]);
  const [includeEmotionNotesOnSave, setIncludeEmotionNotesOnSave] = useState(true);
  const [includeEmotionNotesOnUpload, setIncludeEmotionNotesOnUpload] = useState(true);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [hasStartedHike, setHasStartedHike] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [actualTeamSize, setActualTeamSize] = useState<number>(1);
  const [isRefreshingTeam, setIsRefreshingTeam] = useState(false);
  const [aiHighlights, setAiHighlights] = useState<string>('');
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const activeRouteId = activeRoute?.id || null;

  const appendRecordedPoint = (nextPoint: [number, number]) => {
    setRecordedPath(prev => {
      if (prev.length === 0) return [nextPoint];
      const last = prev[prev.length - 1];
      if (getDistanceFromLatLonInM(last[0], last[1], nextPoint[0], nextPoint[1]) < 3) return prev;
      return [...prev, nextPoint];
    });
    if (recordedPolylineRef.current) {
      recordedPolylineRef.current.addLatLng(nextPoint);
    }
  };
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Zustand store & Custom hook
  const { hikeMode, setMode, setModalOpen, updateLocation, routeData, setRouteData, currentLocation, reset: resetHikeStore } = useHikeStore();
  const hikeModeRef = useRef(hikeMode);
  const routeDataRef = useRef<RouteData | null>(routeData);
  const { handleScrubbing } = usePathScrubbing();

  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teammateMarkersRef = useRef<{ [id: string]: any }>({});
  const reminderMarkersRef = useRef<any[]>([]);
  const emotionNoteMarkersRef = useRef<{ [id: string]: any }>({});
  const recordedPolylineRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const isReviewMode = !!(activeRoute as any)?.isReview;

  const getTeamMemberNameStorageKey = (id: string) => `hikepal_team_member_name_${id}`;

  const getMemberDisplayName = (member?: any) => {
    if (!member) return 'U';
    return (member.user_name || 'U').trim() || 'U';
  };

  const getStoredSoloNickname = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('hikepal_solo_nickname') || localStorage.getItem('hikepal_nickname') || '';
  };

  const getStoredGroupNickname = () => {
    if (typeof window === 'undefined') return '';
    if (teamId) {
      const perTeam = localStorage.getItem(getTeamMemberNameStorageKey(teamId)) || '';
      if (perTeam.trim()) return perTeam.trim();
    }
    return localStorage.getItem('hikepal_group_nickname') || '';
  };

  const getSelfDisplayName = () => {
    if (teamId) {
      const me = teamMembers.find(m => m.user_id === userId);
      const name = me?.user_name?.trim();
      if (name) return name;
      const storedGroup = getStoredGroupNickname().trim();
      if (storedGroup) return storedGroup;
      return 'Me';
    }
    const stored = getStoredSoloNickname();
    if (stored && stored.trim()) return stored.trim();
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.username ||
      user?.user_metadata?.name ||
      user?.email ||
      'Me'
    );
  };

  const syncTeamLocation = async (lat: number, lng: number) => {
    if (!teamId) return;
    const displayName = getSelfDisplayName().trim();
    const basePayload: Record<string, any> = { last_lat: lat, last_lng: lng, last_seen_at: new Date().toISOString() };
    if (displayName) {
      basePayload.user_name = displayName;
    }

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('team_members')
        .update(basePayload)
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .select('id');

      if (updateError) throw updateError;
      if (updatedRows && updatedRows.length > 0) return;

      const { error: upsertError } = await supabase.from('team_members').upsert(
        {
          team_id: teamId,
          user_id: userId,
          role: 'member',
          ...basePayload
        },
        { onConflict: 'team_id,user_id' }
      );
      if (upsertError) throw upsertError;
    } catch (err) {
      console.warn('Failed to sync team location:', err);
    }
  };

  // Handle auto-trigger for reminders prompt
  useEffect(() => {
    hikeModeRef.current = hikeMode;
    routeDataRef.current = routeData;
  }, [hikeMode, routeData]);

  useEffect(() => {
    if (activeRoute && (activeRoute as any).trigger_reminders_prompt) {
       // Clear the flag so it only triggers once
       (activeRoute as any).trigger_reminders_prompt = false;
       // Automatically send a message
       setTimeout(() => {
          handleSendMessage("Please give me the reminders for this route at once.");
       }, 1000);
    }
  }, [activeRoute]);

  // --- Functions ---
  const loadTeamMembers = async () => {
    if (!teamId) return;
    try {
      setIsRefreshingTeam(true);
      const { data: teamData } = await supabase.from('teams').select('team_size').eq('id', teamId).single();
      if (teamData) setActualTeamSize(teamData.team_size || 1);
      const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId).order('joined_at', { ascending: true });
      if (data) setTeamMembers(data);
    } catch (err) { console.warn(err); } finally { setIsRefreshingTeam(false); }
  };

  const loadMetadata = async () => {
    console.log('📡 CompanionView: Fetching reminders via RPC...');
    
    try {
      // Use RPC to get formatted GeoJSON coordinates directly
      const { data, error } = await supabase.rpc('get_reminder_with_coords');

      if (error) {
        console.error('❌ CompanionView RPC Error:', error);
        
        // Fallback to direct table query if RPC fails (e.g. during migration)
        const { data: fallbackData } = await supabase
          .from('reminder_info')
          .select('id, name, category, type, ai_prompt, risk_level, coordinates');
          
        if (fallbackData) {
          setReminderInfo(fallbackData);
        }
      } else if (data) {
        console.log('✅ CompanionView: Loaded reminders count:', data.length);
        setReminderInfo(data);
      }
    } catch (err) {
      console.error('❌ CompanionView metadata load failed:', err);
    }
  };

  const fetchWeather = async () => {
    const weather = await fetchHongKongCurrentWeather();
    setRiskStats({ temp: weather.temp, humidity: weather.humidity, condition: weather.condition });
  };

  const buildCollectedWaypoints = (includeEmotionNotes: boolean): Waypoint[] => {
    const reminderWaypoints = Array.from(alertedItemsRef.current).map(id => {
      const item = reminderInfo.find(r => r.id === id);
      const coords = getCoords(item);
      return {
        id: item?.id || String(id),
        lat: coords ? coords[0] : 0,
        lng: coords ? coords[1] : 0,
        note: item?.name || 'Reminder',
        type: 'reminder',
        timestamp: new Date()
      } as unknown as Waypoint;
    });

    if (!includeEmotionNotes) return reminderWaypoints;

      const emotionWaypoints = emotionNotes
        .filter(note => typeof note.latitude === 'number' && typeof note.longitude === 'number')
        .map(note => ({
          id: `emotion-${note.id}`,
          lat: note.latitude,
          lng: note.longitude,
          note: note.content,
          type: 'emotion',
          imageUrl: note.imageUrl,
          timestamp: note.created_at ? new Date(note.created_at) : new Date()
        } as unknown as Waypoint));

    return [...reminderWaypoints, ...emotionWaypoints];
  };

  const loadEmotionNotes = async () => {
    if (!activeRouteId) {
      setEmotionNotes([]);
      return;
    }

    try {
      const scopeCol = 'id, team_id, route_id, user_id, user_name, content, latitude, longitude, image_url, created_at';
      const fallbackCol = 'id, team_id, user_id, user_name, content, latitude, longitude, image_url, created_at';

      let query = supabase
        .from('team_member_emotions')
        .select(scopeCol)
        .order('created_at', { ascending: true });
      query = teamId ? query.eq('team_id', teamId) : query.eq('user_id', userId);

      let { data, error } = await query;
      
      // Fallback 1: Missing route_id
      if (error && isMissingRouteScopeColumnError(error)) {
        let fallbackQuery = supabase
          .from('team_member_emotions')
          .select(fallbackCol)
          .order('created_at', { ascending: true });
        fallbackQuery = teamId ? fallbackQuery.eq('team_id', teamId) : fallbackQuery.eq('user_id', userId);
        const fallback = await fallbackQuery;
        data = fallback.data as any;
        error = fallback.error;
      }
      
      // Fallback 2: Missing image_url
      if (error && (error.code === '42703' || String(error.message).includes('image_url'))) {
        const oldCol = 'id, team_id, route_id, user_id, user_name, content, latitude, longitude, created_at';
        let queryOld = supabase.from('team_member_emotions').select(oldCol).order('created_at', { ascending: true });
        queryOld = teamId ? queryOld.eq('team_id', teamId) : queryOld.eq('user_id', userId);
        const fallbackOld = await queryOld;
        
        // Fallback 3: Missing BOTH route_id AND image_url
        if (fallbackOld.error && isMissingRouteScopeColumnError(fallbackOld.error)) {
           const oldestCol = 'id, team_id, user_id, user_name, content, latitude, longitude, created_at';
           let queryOldest = supabase.from('team_member_emotions').select(oldestCol).order('created_at', { ascending: true });
           queryOldest = teamId ? queryOldest.eq('team_id', teamId) : queryOldest.eq('user_id', userId);
           const fallbackOldest = await queryOldest;
           data = fallbackOldest.data as any;
           error = fallbackOldest.error;
        } else {
           data = fallbackOld.data as any;
           error = fallbackOld.error;
        }
      }
      
      if (error) throw error;
      const notes = Array.isArray(data) ? data.map(n => ({...n, imageUrl: n.image_url})) as EmotionNote[] : [];
      setEmotionNotes(filterNotesForRoute(notes, activeRouteId));
    } catch (err) {
      console.warn('Failed to load emotion notes:', err);
    }
  };

  const handleConfirmUpload = async () => {
    if (!activeRoute) return;
    setIsUploadingRoute(true);
    try {
      await uploadRouteToCommunity(userId, {
        name: uploadData.name,
        description: uploadData.description,
        tags: uploadData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        route_data: {
          id: activeRoute.id,
          distance: activeRoute.distance,
          duration: activeRoute.duration,
          difficulty: activeRoute.difficulty,
          coordinates: recordedPath,
          waypoints: buildCollectedWaypoints(includeEmotionNotesOnUpload)
        },
      });
      setShowUploadModal(false);
      alert('✅ Shared successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to share route. Please try again.');
    } finally { setIsUploadingRoute(false); }
  };

  // --- Effects ---
  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadMetadata();
    loadEmotionNotes();
    if (teamId) {
      loadTeamMembers();
      const interval = setInterval(loadTeamMembers, 5000);
      return () => clearInterval(interval);
    }
  }, [teamId, userId, activeRouteId]);

  useEffect(() => {
    if (!teamId) return;
    const channel = supabase
      .channel(`team_members_live_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setTeamMembers(prev => {
            const eventType = payload.eventType;
            if (eventType === 'DELETE') {
              const removed = payload.old as any;
              return prev.filter(m => m.id !== removed?.id && m.user_id !== removed?.user_id);
            }
            const nextMember = payload.new as any;
            const idx = prev.findIndex(m => m.id === nextMember.id || m.user_id === nextMember.user_id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...nextMember };
              return updated;
            }
            return [...prev, nextMember];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`Realtime channel error: team_members_live_${teamId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  useEffect(() => {
    if (!activeRouteId) {
      setEmotionNotes([]);
      return;
    }

    const channelName = teamId ? `team_emotions_live_${teamId}` : `solo_emotions_live_${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_member_emotions',
          ...(teamId
            ? { filter: `team_id=eq.${teamId}` }
            : { filter: `user_id=eq.${userId}` }),
        },
        (payload) => {
          setEmotionNotes(prev => {
            if (payload.eventType === 'DELETE') {
              const removed = payload.old as any;
              return prev.filter(note => note.id !== removed?.id);
            }

            const next = payload.new as EmotionNote;
            if (activeRouteId && next.route_id && String(next.route_id) !== String(activeRouteId)) {
              return prev;
            }
            const idx = prev.findIndex(note => note.id === next.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...next };
              return updated;
            }
            return [...prev, next];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, userId, activeRouteId]);

  // Generate AI Highlights when route changes
  useEffect(() => {
    const fetchHighlights = async () => {
      if (!activeRoute) return;
      try {
        setIsLoadingHighlights(true);
        const relatedReminders = reminderInfo.filter(r => {
          const coords = getCoords(r);
          return coords && isPointNearRoute(coords[0], coords[1], activeRoute.coordinates || [], 300);
        });
        
        const highlights = await import('../services/geminiService').then(m => 
          m.generateRouteHighlights(activeRoute.name, activeRoute.description || '', relatedReminders)
        );
        setAiHighlights(highlights);
      } catch (e) {
        console.error("Highlights generation failed", e);
      } finally {
        setIsLoadingHighlights(false);
      }
    };
    
    if (activeRoute && reminderInfo.length > 0) {
      fetchHighlights();
    }
  }, [activeRoute, reminderInfo]);

  useEffect(() => {
    if (hikeMode === 'idle') return;
    if (!alertsEnabled || isReviewMode || !userPos) return;
    const activeRouteCoords = activeRoute?.coordinates || [];
    if (!activeRoute || activeRouteCoords.length === 0) return;

    const relatedReminders = reminderInfo
      .map(r => ({ r, coords: getCoords(r) }))
      .filter(item => {
        if (!item.coords) return false;
        return isPointNearRoute(item.coords[0], item.coords[1], activeRouteCoords, 300);
      });
    
    // Use a consistent proximity threshold for both Live and Manual modes
    const threshold = 300;

    const notifyNearbyReminders = async () => {
      const me = teamMembers.find(m => m.user_id === userId);
      const weatherText = formatWeatherForPrompt({
        condition: riskStats?.condition,
        temp: riskStats?.temp,
        humidity: riskStats?.humidity
      });

      for (const { r, coords } of relatedReminders) {
        if (!coords) continue;
        const id = r?.id ?? `${r?.name ?? 'reminder'}-${coords[0].toFixed(6)}-${coords[1].toFixed(6)}`;
        if (alertedItemsRef.current.has(String(id))) continue;

        const distance = getDistanceFromLatLonInM(userPos[0], userPos[1], coords[0], coords[1]);
        if (distance > threshold) continue;

        // Mark first to prevent repeated triggers while waiting for AI.
        alertedItemsRef.current.add(String(id));

        const replyText = await generateReminderReply({
          reminderName: r?.name || 'Trail reminder',
          reminderCategory: r?.category || r?.type,
          reminderType: r?.type,
          riskLevel: r?.risk_level,
          distanceMeters: distance,
          internalPrompt: r?.ai_prompt,
          context: {
            location: `${userPos[0].toFixed(4)}, ${userPos[1].toFixed(4)}`,
            route: activeRoute?.name || 'Unknown',
            hikeMode,
            teammates: teamMembers.map(m => m.user_name).filter(Boolean),
            userName: getSelfDisplayName(),
            userMood: me?.user_mood || '',
            userDifficulty: me?.user_difficulty || '',
            userCondition: me?.user_condition || '',
            weather: weatherText
          }
        });

        setMessages(prev => [
          ...prev,
          { id: `reminder-${id}`, sender: 'ai', text: replyText, timestamp: new Date() }
        ]);
        setToast({ message: `Reminder: ${r.name}`, type: 'info' });
        setTimeout(() => setToast(null), 3000);
      }
    };

    notifyNearbyReminders();
  }, [userPos, reminderInfo, activeRoute, alertsEnabled, isReviewMode, hikeMode, teamMembers, userId, riskStats]);

  useEffect(() => {
    if (hikeMode === 'live' || hikeMode === 'scrubbing') {
      alertedItemsRef.current.clear();
    }
  }, [hikeMode, activeRoute]);

  // Initialize userPos to the start of the active route if available
  useEffect(() => {
    const safeCoords = sanitizeRouteCoords(activeRoute?.coordinates);
    if (safeCoords.length > 0 && !isRecording) {
      const startCoord = safeCoords[0];
      setUserPos(startCoord);
      setRecordedPath([startCoord]);
    }
  }, [activeRoute, isRecording]);

  useEffect(() => {
    if (!isRecording || isReviewMode || hikeMode === 'scrubbing') return;
    
    const geoId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const newPos: [number, number] = [lat, lng];
        setUserPos(newPos);
        appendRecordedPoint(newPos);

        if (!activeRoute) {
          mapInstanceRef.current?.panTo(newPos);
        }
        
        // Sync to database so teammates can see
        if (Date.now() - lastUploadRef.current > 3000 && teamId) { 
           lastUploadRef.current = Date.now();
           // In a real app we'd update a real-time table. Updating team_members last_lat/last_lng
           await syncTeamLocation(lat, lng);
             
           // Also log to locations for history
           const { error: locationsInsertError } = await supabase
             .from('locations')
             .insert({ session_id: sessionId, team_id: teamId, user_id: userId, latitude: lat, longitude: lng });
           if (locationsInsertError) {
             console.warn('Failed to insert location history:', locationsInsertError);
           }
        }
      },
      (err) => console.error(err), { 
         enableHighAccuracy: true,
         timeout: 10000,
         maximumAge: 5000
      }
    );
    return () => navigator.geolocation.clearWatch(geoId);
  }, [isRecording, isReviewMode, sessionId, userId, teamId, activeRoute, hikeMode]);

  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    if (!mapContainerRef.current || !L) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }
    if (!mapInstanceRef.current) {
        const safeCoords = sanitizeRouteCoords(activeRoute?.coordinates);
        const initialView = (safeCoords.length > 0) ? safeCoords[0] : [22.25, 114.17];
        const initialZoom = activeRoute ? 15 : 12; // Zoom out for general view in demo mode
        const container = mapContainerRef.current;
        (container as any)._leaflet_id = null;
        container.innerHTML = '';
        const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(initialView, initialZoom);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
        if (safeCoords.length > 0) {
            const color = isReviewMode ? '#666' : '#2E7D32';
            const routeLine = L.polyline(safeCoords, { color, weight: 6, opacity: 0.8 }).addTo(map);
            
            // Add Start/End markers for hiking mode
            if (safeCoords.length > 0) {
              const startIcon = L.divIcon({
                  html: `<div style="background-color: #2E7D32; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>`,
                  className: '', iconSize: [24, 24], iconAnchor: [12, 12]
              });
              const endIcon = L.divIcon({
                  html: `<div style="background-color: #D32F2F; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">E</div>`,
                  className: '', iconSize: [24, 24], iconAnchor: [12, 12]
              });
              L.marker(safeCoords[0], { icon: startIcon, zIndexOffset: 900 }).addTo(map).bindPopup('Start Point');
              L.marker(safeCoords[safeCoords.length - 1], { icon: endIcon, zIndexOffset: 900 }).addTo(map).bindPopup('End Point');
            }

            // Ensure map fits trail perfectly after initialization
            setTimeout(() => {
              map.invalidateSize();
              map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
            }, 300);
        }
        recordedPolylineRef.current = L.polyline([], { color: isReviewMode ? '#D32F2F' : '#FF5722', weight: 5 }).addTo(map);
        
        // Render Reminder Info (Facilities & Risks)

        if (!isReviewMode && activeRoute) {
          const userChar = getSelfDisplayName().charAt(0).toUpperCase();
          const userIcon = L.divIcon({ 
            html: `<div style="background-color: #2563EB; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;">${userChar}</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          userMarkerRef.current = L.marker(initialView, { 
            icon: userIcon, 
            zIndexOffset: 12000, // Ensure Avatar is always on top of all map objects
            draggable: hikeMode === 'scrubbing' // Enable draggable when scrubbing
          }).addTo(map);

          // Handle Dragging Events for Path Scrubbing
          userMarkerRef.current.on('dragstart', () => {
             if (hikeModeRef.current === 'scrubbing') {
               map.dragging.disable();
             }
          });

          userMarkerRef.current.on('drag', (e: any) => {
            const currentRoute = routeDataRef.current;
            if (hikeModeRef.current === 'scrubbing' && currentRoute) {
              const rawPos = e.latlng;
              const rawLngLat = { lng: rawPos.lng, lat: rawPos.lat };
              
              // 1. Calculate Snapped Point
              const snapped = handleScrubbing(rawLngLat, currentRoute);
              
              if (snapped) {
                // 2. FORCE Snapping: Physically pull the marker back to the route
                e.target.setLatLng([snapped.lat, snapped.lng]);
                
                // 3. Sync States
                const snappedPoint: [number, number] = [snapped.lat, snapped.lng];
                setUserPos(snappedPoint);
                appendRecordedPoint(snappedPoint);
                updateLocation(snapped);
              }
            }
          });

          userMarkerRef.current.on('dragend', (e: any) => {
            map.dragging.enable();
            const currentRoute = routeDataRef.current;
            if (hikeModeRef.current === 'scrubbing' && currentRoute) {
              const rawPos = e.target._latlng;
              const rawLngLat = { lng: rawPos.lng, lat: rawPos.lat };
              const snapped = handleScrubbing(rawLngLat, currentRoute);
              if (snapped) {
                e.target.setLatLng([snapped.lat, snapped.lng]);
                const snappedPoint: [number, number] = [snapped.lat, snapped.lng];
                setUserPos(snappedPoint);
                appendRecordedPoint(snappedPoint);
                updateLocation(snapped);
              }
            }
          });

        } else if (safeCoords.length > 0 && isReviewMode) {
          recordedPolylineRef.current.setLatLngs(safeCoords);
          ((activeRoute as any).historyWaypoints || []).forEach((wp: any) => {
             if (wp && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
                const icon = L.divIcon({ html: `<div style="background-color: #F59E0B; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>` });
                L.marker([wp.lat, wp.lng], { icon }).addTo(map);
             }
          });
        }
        mapInstanceRef.current = map;
        
        // Fix Leaflet partial rendering issue when container size changes
        setTimeout(() => {
          map.invalidateSize();
          if (safeCoords.length > 0) {
            const bounds = L.polyline(safeCoords).getBounds();
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        }, 500);
    }
    if (userMarkerRef.current && userPos && isValidPoint(userPos)) {
      if (!userMarkerRef.current.dragging || !userMarkerRef.current.dragging._draggable || !userMarkerRef.current.dragging._draggable._moving) {
        userMarkerRef.current.setLatLng(userPos);
      }
      
      // Update draggable state dynamically
      if (hikeMode === 'scrubbing') {
         if (!userMarkerRef.current.dragging?.enabled()) {
            userMarkerRef.current.dragging?.enable();
         }
      } else {
         if (userMarkerRef.current.dragging?.enabled()) {
            userMarkerRef.current.dragging?.disable();
         }
      }
    }
    if (recordedPolylineRef.current && isReviewMode) { /* Review mode line is static */ }
  }, [userPos, activeRoute, isReviewMode, reminderInfo]);

  useEffect(() => {
    if (!teamId || !userMarkerRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const displayName = getSelfDisplayName();
    const userChar = displayName.charAt(0).toUpperCase();
    const userIcon = L.divIcon({ 
      html: `<div style="background-color: #2563EB; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;">${userChar}</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    userMarkerRef.current.setIcon(userIcon);
  }, [teamMembers, teamId, userId]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        (mapContainerRef.current as any)._leaflet_id = null;
        mapContainerRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 300);
    }
  }, [panelMode, activeRoute]);

  useEffect(() => {
    if (panelMode !== 'chat') return;
    const container = chatScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, panelMode, chatType]);

  // Handle Reminder Markers (Facilities & Risks)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    console.log('DEBUG: CompanionView updating markers, count:', reminderInfo.length);

    // Clear existing reminder markers
    reminderMarkersRef.current.forEach(m => m.remove());
    reminderMarkersRef.current = [];

    if (reminderInfo.length === 0) return;

    let markersToShow = reminderInfo;
    if (isRecording && activeRoute && activeRoute.coordinates) {
      markersToShow = reminderInfo.filter(r => {
        const coords = getCoords(r);
        return coords && isPointNearRoute(coords[0], coords[1], activeRoute.coordinates || [], 300);
      });
    }

    markersToShow.forEach(r => {
      const coords = getCoords(r);
      if (coords) {
        console.log(`DEBUG: CompanionView adding marker for ${r.name} at ${coords}`);
        const isRisk = r.category?.toLowerCase() === 'risk';
        const isCulture = r.category?.toLowerCase().includes('culture');
        const bgColor = isRisk ? '#EF4444' : isCulture ? '#D97706' : '#3B82F6';
        const emoji = isRisk ? '⚠️' : isCulture ? '🏛️' : 'ℹ️'; 
        
        let specificEmoji = emoji;
        const nameLower = r.name?.toLowerCase() || '';
        const typeLower = r.type?.toLowerCase() || '';
        const promptLower = r.ai_prompt?.toLowerCase() || '';
        const combinedText = `${nameLower} ${typeLower} ${promptLower}`;
        
        if (!isRisk) {
           if (combinedText.includes('toilet') || combinedText.includes('restroom')) specificEmoji = '🚻';
           else if (combinedText.includes('water')) specificEmoji = '💧';
           else if (combinedText.includes('rest') || combinedText.includes('pavilion') || combinedText.includes('bench')) specificEmoji = '🪑';
           else if (combinedText.includes('camp')) specificEmoji = '⛺';
           else if (combinedText.includes('view') || combinedText.includes('scenic') || combinedText.includes('photo')) specificEmoji = '📸';
           else if (combinedText.includes('exit') || combinedText.includes('bail')) specificEmoji = '🚪';
           else if (combinedText.includes('bus') || combinedText.includes('transport')) specificEmoji = '🚌';
           else if (combinedText.includes('food') || combinedText.includes('restaurant')) specificEmoji = '🍜';
           else if (combinedText.includes('beach')) specificEmoji = '🏖️';
           else if (combinedText.includes('stone') || combinedText.includes('monument') || combinedText.includes('history') || combinedText.includes('boundary')) specificEmoji = '🗿';
           else if (r.category?.toLowerCase().includes('culture')) specificEmoji = '🏛️';
        } else {
           if (combinedText.includes('slip')) specificEmoji = '🥾';
           else if (combinedText.includes('animal') || combinedText.includes('dog') || combinedText.includes('monkey') || combinedText.includes('boar')) specificEmoji = '🐗';
           else if (combinedText.includes('steep') || combinedText.includes('cliff') || combinedText.includes('slope')) specificEmoji = '⛰️';
           else if (combinedText.includes('sun') || combinedText.includes('heat')) specificEmoji = '☀️';
           else if (combinedText.includes('snake')) specificEmoji = '🐍';
           else if (combinedText.includes('bee') || combinedText.includes('insect')) specificEmoji = '🐝';
           else if (combinedText.includes('river') || combinedText.includes('stream')) specificEmoji = '🌊';
           else if (combinedText.includes('mud')) specificEmoji = '💩';
        }

        const remIcon = L.divIcon({ 
          html: `
            <div style="
              background-color: ${bgColor}; 
              color: white; 
              width: 28px; 
              height: 28px; 
              border-radius: 50%; 
              border: 2px solid white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 14px; 
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            ">${specificEmoji}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
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
  }, [reminderInfo, mapInstanceRef.current, isRecording, activeRoute]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (!activeRouteId) {
      Object.keys(emotionNoteMarkersRef.current).forEach(id => {
        emotionNoteMarkersRef.current[id].remove();
        delete emotionNoteMarkersRef.current[id];
      });
      return;
    }

    const escaped = (txt: string) =>
      String(txt || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const currentIds = new Set(
      emotionNotes
        .filter(n => typeof n.latitude === 'number' && typeof n.longitude === 'number')
        .map(n => n.id)
    );

    Object.keys(emotionNoteMarkersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        emotionNoteMarkersRef.current[id].remove();
        delete emotionNoteMarkersRef.current[id];
      }
    });

    emotionNotes.forEach(note => {
      if (typeof note.latitude !== 'number' || typeof note.longitude !== 'number') return;
      const isSelf = note.user_id === userId;
      const displayName = (note.user_name || '').trim() || (isSelf ? 'Me' : 'Teammate');
      const markerColor = isSelf ? '#F97316' : '#14B8A6';
      const icon = L.divIcon({
        html: `<div style="background-color: ${markerColor}; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.35);">${note.imageUrl ? '📸' : '�'}</div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });
      const createdAt = note.created_at ? new Date(note.created_at).toLocaleString() : 'Now';
      const popupContent = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
            <strong style="color: ${markerColor};">${escaped(displayName)}</strong> · ${escaped(createdAt)}
          </div>
          ${note.imageUrl ? `<img src="${escaped(note.imageUrl)}" alt="Emotion" style="width: 100%; border-radius: 8px; margin-bottom: 8px; max-height: 120px; object-fit: cover;" />` : ''}
          <div style="font-size: 13px; color: #111827; line-height: 1.4;">
            ${escaped(note.content)}
          </div>
        </div>
      `;

      if (emotionNoteMarkersRef.current[note.id]) {
        emotionNoteMarkersRef.current[note.id]
          .setLatLng([note.latitude, note.longitude])
          .setIcon(icon)
          .bindPopup(popupContent);
      } else {
        emotionNoteMarkersRef.current[note.id] = L
          .marker([note.latitude, note.longitude], { icon, zIndexOffset: 9000 })
          .addTo(map)
          .bindPopup(popupContent);
      }
    });
  }, [emotionNotes, userId, activeRouteId]);

  // Handle teammate markers
  useEffect(() => {
    if (!mapInstanceRef.current || isReviewMode) return;
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!L) return;

    // Clear existing teammate markers that are no longer in teamMembers
    Object.keys(teammateMarkersRef.current).forEach(id => {
      if (!teamMembers.find(m => m.user_id === id)) {
        teammateMarkersRef.current[id].remove();
        delete teammateMarkersRef.current[id];
      }
    });

    // Update or add markers for team members (excluding self)
    const safeCoords = sanitizeRouteCoords(activeRoute?.coordinates);

    teamMembers.forEach(member => {
      if (member.user_id === userId) return;
      
      // Fetch teammates' last known location. If missing, fall back to the route start to keep them clustered
      let teammateLat = member.last_lat;
      let teammateLng = member.last_lng;
      
      if (typeof teammateLat !== 'number' || typeof teammateLng !== 'number') {
         if (safeCoords.length > 0) {
            teammateLat = safeCoords[0][0] + (Math.random() - 0.5) * 0.0005; // tiny offset
            teammateLng = safeCoords[0][1] + (Math.random() - 0.5) * 0.0005;
         } else {
            teammateLat = 22.25 + (Math.random() - 0.5) * 0.01;
            teammateLng = 114.17 + (Math.random() - 0.5) * 0.01;
         }
      }

      if (typeof teammateLat === 'number' && typeof teammateLng === 'number') {
        const displayName = getMemberDisplayName(member);
        const char = displayName.charAt(0).toUpperCase();
        const icon = L.divIcon({
          html: `<div style="background-color: #EA580C; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${char}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        if (teammateMarkersRef.current[member.user_id]) {
          teammateMarkersRef.current[member.user_id].setLatLng([teammateLat, teammateLng]);
          teammateMarkersRef.current[member.user_id].setIcon(icon);
          teammateMarkersRef.current[member.user_id].setZIndexOffset(11000);
          teammateMarkersRef.current[member.user_id].bindPopup(displayName);
        } else {
          teammateMarkersRef.current[member.user_id] = L.marker([teammateLat, teammateLng], { icon, zIndexOffset: 11000 }).addTo(map).bindPopup(displayName);
        }
      }
    });
  }, [teamMembers, userId, isReviewMode]);

  useEffect(() => {
    if (!teamId || !userPos || !isRecording || isReviewMode || hikeMode !== 'scrubbing') return;
    if (Date.now() - lastUploadRef.current < 1000) return;
    lastUploadRef.current = Date.now();
    const [lat, lng] = userPos;
    syncTeamLocation(lat, lng);
  }, [teamId, userPos, isRecording, isReviewMode, hikeMode, userId]);

  // --- Handlers ---
  const handleStartRecording = () => {
    if (activeRoute && activeRoute.coordinates) {
      // Ensure coordinates are correctly structured for turf
      const validCoords = activeRoute.coordinates
         .filter(c => Array.isArray(c) && c.length >= 2)
         .map(c => [c[1], c[0]]); // Leaflet [lat, lng] -> Turf [lng, lat]
      
      if (validCoords.length > 0) {
        setRouteData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: validCoords
          }
        } as RouteData);
      }
    }
    
    // Set isDirectRecord to true if there is no activeRoute and no teamId
    const isDirectRecord = !activeRoute && !teamId;
    useHikeStore.getState().setDirectRecord(isDirectRecord);
    setModalOpen(true);
  };

  useEffect(() => {
    if (hikeMode === 'live' || hikeMode === 'scrubbing') {
      setIsRecording(true);
      setHasStartedHike(true);
      
      // Initial Positioning: Jump to start point for scrubbing mode
      if (hikeMode === 'scrubbing' && activeRoute?.coordinates && activeRoute.coordinates.length > 0) {
        const startPt = activeRoute.coordinates[0];
        setUserPos(startPt);
        updateLocation({ lng: startPt[1], lat: startPt[0] });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(startPt);
        }
      }

      if (!timerRef.current) {
        timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
      }
      setToast({ message: `Started ${hikeMode === 'scrubbing' ? 'virtual' : 'live'} hike!`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    }
  }, [hikeMode, activeRoute]);

  const handleSendMessage = async (text?: string) => {
    const finalMsg = text || inputText;
    if (!finalMsg.trim()) return;
    
    // 1. Add user message
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: finalMsg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // 2. Call Gemini if in AI mode
    if (chatType === 'ai') {
      try {
        // Add a "Thinking..." message
        const thinkingId = 'thinking-' + Date.now();
        setMessages(prev => [...prev, { id: thinkingId, sender: 'ai', text: '...', timestamp: new Date() }]);

        const responseText = await generateHikingAdvice(finalMsg, {
          location: (userPos && typeof userPos[0] === 'number') ? `${userPos[0].toFixed(4)}, ${userPos[1].toFixed(4)}` : 'Unknown',
          route: activeRoute?.name || 'Unknown',
          teammates: teamMembers.map(m => m.user_name),
          routeInfo: activeRoute?.description,
          extraData: {
            nearby_reminders: reminderInfo.filter(r => {
               const coords = getCoords(r);
               return coords && activeRoute && activeRoute.coordinates && isPointNearRoute(coords[0], coords[1], activeRoute.coordinates || [], 500);
            }).map(r => ({ name: r.name, info: r.ai_prompt, category: r.category })),
            current_route: activeRoute ? {
              distance: activeRoute.distance,
              duration: activeRoute.duration,
              difficulty: activeRoute.difficulty
            } : null
          }
        });

        // Replace thinking message with real response
        setMessages(prev => prev.map(m => m.id === thinkingId ? { ...m, text: responseText } : m));
      } catch (err) {
        console.error("Gemini advice failed", err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCardDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: cardPos.x,
      cardY: cardPos.y
    };
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();
    const startW = rect?.width ?? cardSize.w;
    const startH = rect?.height ?? cardSize.h;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: startW, h: startH };
    setIsResizing(true);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        const minW = 220;
        const minH = 220;
        const maxW = Math.min(window.innerWidth - 32, 380);
        const maxH = Math.min(window.innerHeight * 0.7, 560);
        const nextW = Math.max(minW, Math.min(resizeStartRef.current.w + dx, maxW));
        const nextH = Math.max(minH, Math.min(resizeStartRef.current.h + dy, maxH));
        setCardSize({ w: nextW, h: nextH });
        return;
      }
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setCardPos({
        x: dragStartRef.current.cardX + dx,
        y: dragStartRef.current.cardY + dy
      });
    };
    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isResizing]);

  useEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width && rect.height) {
      setCardSize(prev => ({
        w: prev.w || rect.width,
        h: prev.h || rect.height
      }));
    }
  }, [activeRoute, hasStartedHike]);

  const handleAddNote = async () => {
    const content = noteContent.trim();
    if (!content || !activeRouteId) return;
    setIsNoteSubmitting(true);
    try {
      let imageUrl = null;
      if (noteImage) {
        try {
          const fileExt = noteImage.name.split('.').pop() || 'jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${userId}/${fileName}`;

          console.log('Attempting to upload image to emotion-images bucket...');
          
          // Try to upload the image
          const { error: uploadError } = await supabase.storage
            .from('emotion-images')
            .upload(filePath, noteImage);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            
            // Check if the error is due to bucket not existing or permission issues
            if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
              console.warn('Bucket may not exist or have proper permissions. Skipping image upload.');
              // We'll still save the note without the image
            } else {
              // Other upload errors
              console.warn('Image upload failed, but continuing without image:', uploadError.message);
            }
          } else {
            // Success! Get the public URL
            const { data: { publicUrl } } = supabase.storage
              .from('emotion-images')
              .getPublicUrl(filePath);
            imageUrl = publicUrl;
            console.log('Image uploaded successfully:', imageUrl);
          }
        } catch (uploadError) {
          console.error('Unexpected error during image upload:', uploadError);
          // Continue without image
        }
      }

      const payload = {
        team_id: teamId,
        route_id: activeRouteId,
        user_id: userId,
        user_name: getSelfDisplayName(),
        content,
        latitude: userPos ? userPos[0] : 0,
        longitude: userPos ? userPos[1] : 0,
        image_url: imageUrl,
        created_at: new Date().toISOString()
      };

      let { data, error } = await supabase
        .from('team_member_emotions')
        .insert(payload)
        .select('id, team_id, route_id, user_id, user_name, content, latitude, longitude, image_url, created_at')
        .single();

      if (error) {
        // Fallback for missing image_url column
        const fallbackPayload = {
          team_id: teamId,
          route_id: activeRouteId,
          user_id: userId,
          user_name: getSelfDisplayName(),
          content,
          latitude: userPos ? userPos[0] : 0,
          longitude: userPos ? userPos[1] : 0,
          created_at: new Date().toISOString()
        };
        const oldCol = 'id, team_id, route_id, user_id, user_name, content, latitude, longitude, created_at';
        let queryOld = supabase.from('team_member_emotions').insert(fallbackPayload).select(oldCol).single();
        const fallbackOld = await queryOld;
        data = fallbackOld.data as any;
        error = fallbackOld.error;
      }

      // Backward compatibility: DB may not have route_id column yet.
      if (error && isMissingRouteScopeColumnError(error)) {
        const fallback = await supabase
          .from('team_member_emotions')
          .insert({
            team_id: payload.team_id,
            user_id: payload.user_id,
            user_name: payload.user_name,
            content: payload.content,
            latitude: payload.latitude,
            longitude: payload.longitude,
            image_url: payload.image_url,
            created_at: payload.created_at
          })
          .select('id, team_id, user_id, user_name, content, latitude, longitude, image_url, created_at')
          .single();
        data = fallback.data as any;
        error = fallback.error;
      }

      if (error) throw error;
      if (data) {
        const newNote: EmotionNote = {
          ...data,
          imageUrl: data.image_url
        };
        setEmotionNotes(prev => {
          if (prev.find(note => note.id === newNote.id)) return prev;
          return [...prev, newNote];
        });
      }
      
      setMessages(prev => [...prev, {
        id: `note-${Date.now()}`,
        sender: 'user',
        text: `📍 Saved a note: "${content}"`,
        timestamp: new Date()
      }]);
      setToast({ message: 'Emotion note saved', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      
      setNoteContent('');
      setNoteImage(null);
      setNoteImagePreview(null);
      setShowAddNote(false);
    } catch (e: any) {
      if (isEmotionNotePermissionError(e)) {
        const localNote: EmotionNote = {
          id: `local-${Date.now()}`,
          team_id: teamId || null,
          route_id: activeRouteId || null,
          user_id: userId,
          user_name: getSelfDisplayName(),
          content,
          latitude: userPos ? userPos[0] : 0,
          longitude: userPos ? userPos[1] : 0,
          created_at: new Date().toISOString()
        };
        setEmotionNotes(prev => [...prev, localNote]);
        setMessages(prev => [...prev, {
          id: `note-local-${Date.now()}`,
          sender: 'user',
          text: `📍 Saved locally: "${content}"`,
          timestamp: new Date()
        }]);
        setToast({ message: 'Saved locally (no DB permission)', type: 'info' });
        setTimeout(() => setToast(null), 3000);
        setNoteContent('');
        setNoteImage(null);
        setNoteImagePreview(null);
        setShowAddNote(false);
        return;
      }
      console.error('Failed to save note:', e);
      alert('Failed to save note');
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;

    // Split by newlines to handle block-level formatting
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc pl-5 my-2 space-y-1 text-gray-700">
            {currentList}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      // Trim right whitespace
      const trimmedLine = line.trimEnd();
      
      // Handle empty lines
      if (trimmedLine === '') {
        flushList();
        elements.push(<br key={`br-${lineIdx}`} />);
        return;
      }

      // Handle Bullet Lists (* item or - item)
      const listMatch = trimmedLine.match(/^(\*|-)\s+(.*)/);
      
      // Inline formatting function (Bold text)
      const renderInline = (inlineText: string, keyPrefix: string) => {
        const parts = inlineText.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`${keyPrefix}-bold-${i}`} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
          }
          return <span key={`${keyPrefix}-text-${i}`}>{part}</span>;
        });
      };

      if (listMatch) {
        // It's a list item
        const itemContent = listMatch[2];
        currentList.push(
          <li key={`li-${lineIdx}`} className="leading-relaxed">
            {renderInline(itemContent, `li-${lineIdx}`)}
          </li>
        );
      } else {
        // Regular paragraph/line
        flushList();
        elements.push(
          <div key={`p-${lineIdx}`} className="leading-relaxed my-1">
            {renderInline(trimmedLine, `p-${lineIdx}`)}
          </div>
        );
      }
    });

    flushList(); // Make sure to flush any remaining list items

    return <div className="markdown-body">{elements}</div>;
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-gray-50 relative overflow-hidden">
      <MovementModeModal />
      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[3000] animate-fade-in-up">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
            toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-blue-500/90 border-blue-400 text-white'
          }`}>
            <Activity size={18} className="animate-pulse" />
            <span className="text-sm font-bold tracking-wide uppercase">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Quick Record Button (Bottom Left of Map) */}
      {!activeRoute && !hasStartedHike && (
        <button 
          onClick={() => {
            setTrackName(`Hike ${new Date().toLocaleDateString()}`);
            handleStartRecording();
          }}
          className={`absolute ${panelMode === 'chat' ? 'bottom-[64%]' : 'bottom-[35%]'} left-4 z-[500] bg-hike-green text-white px-6 py-4 rounded-[24px] shadow-2xl active:scale-95 transition-all flex items-center gap-3 border-2 border-white/30 animate-fade-in`}
        >
          <Play size={20} fill="currentColor" />
          <span className="text-sm font-black tracking-tight">DIRECT RECORD</span>
        </button>
      )}

      {/* Back Button */}
      {!hasStartedHike && onBack && (
        <button onClick={onBack} className="absolute top-6 left-4 z-[500] p-3 bg-white shadow-lg rounded-full border"><ArrowLeft size={20}/></button>
      )}


      {/* Save Dialog */}
      {showSaveDialog && (
          <div className="absolute inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">End Hike</h3>
                  <div className="mb-4">
                      <label className="text-xs text-gray-500 font-bold uppercase">Track Name</label>
                      <input value={trackName} onChange={e => setTrackName(e.target.value)} className="w-full border-b-2 border-hike-green py-2 text-lg outline-none"/>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 mb-6">
                      <div className="flex-1 bg-gray-50 p-2 rounded"><div>Time</div><div className="font-bold">{formatTime(elapsedTime)}</div></div>
                      <div className="flex-1 bg-gray-50 p-2 rounded"><div>Dist</div><div className="font-bold">{(recordedPath.length * 0.005).toFixed(2)} km</div></div>
                  </div>
                  <label className="flex items-center justify-between text-sm text-gray-700 mb-4 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                    <span>Include Emotion Notes</span>
                    <input
                      type="checkbox"
                      checked={includeEmotionNotesOnSave}
                      onChange={e => setIncludeEmotionNotesOnSave(e.target.checked)}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                  {!user.isGuest && (
                    <>
                      <button 
                        onClick={() => { 
                          onSaveTrack({ 
                            id: Date.now().toString(), 
                            name: trackName, 
                            date: new Date(), 
                            duration: formatTime(elapsedTime), 
                            distance: (recordedPath.length * 0.005).toFixed(2) + 'km', 
                            difficulty: activeRoute?.difficulty || 0, 
                            coordinates: recordedPath, 
                            waypoints: buildCollectedWaypoints(includeEmotionNotesOnSave)
                          }); 
                          setShowSaveDialog(false); 
                          if(onBack) onBack(); 
                        }} 
                        className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold mb-3 shadow-lg active:scale-95 transition-all"
                      >
                        Save to Profile
                      </button>
                      <button 
                        onClick={() => setShowUploadModal(true)} 
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mb-3 shadow-lg active:scale-95 transition-all"
                      >
                        Share to Community
                      </button>
                    </>
                  )}
                  {user.isGuest && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6 text-center">
                      <p className="text-xs text-amber-700 font-medium">Guest mode: Your track will be displayed once but not saved permanently. Sign up to keep your history!</p>
                    </div>
                  )}
                  <button onClick={() => { if(user.isGuest && onBack) onBack(); setShowSaveDialog(false); }} className="w-full text-gray-500 py-2 text-sm">
                    {user.isGuest ? 'Close' : 'Cancel'}
                  </button>
              </div>
          </div>
      )}

      {/* Map Section */}
      <div className={`relative transition-all duration-300 ${panelMode === 'map' ? 'h-[72%] sm:h-[70%] md:h-[66%]' : 'h-[44%] sm:h-[42%]'}`}>
        <div ref={mapContainerRef} className="absolute inset-0 bg-gray-200 z-0" />
        
        {!activeRoute && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-yellow-500/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-md">
            DEMO MODE
          </div>
        )}

        {isReviewMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-gray-900/90 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md">
            <HistoryIcon size={14} className="text-orange-400" /> REVIEW MODE
          </div>
        )}

        {isRecording && (
          <div className="absolute top-6 left-16 z-[500] bg-white/80 backdrop-blur-md text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-md border border-gray-200 animate-fade-in">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="opacity-70 uppercase tracking-tighter">Rec</span>
            <span className="font-mono">{formatTime(elapsedTime)}</span>
          </div>
        )}

        {/* SOS Overlay */}
        {showSOS && (
            <div className="absolute inset-0 z-[2000] bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in">
              <ShieldAlert size={64} className="mb-4 animate-bounce" />
              <h2 className="text-4xl font-black mb-2">SOS ACTIVE</h2>
              <div className="bg-white/20 p-6 rounded-2xl w-full mb-6 border backdrop-blur-md">
                  <div className="text-xs uppercase opacity-70 mb-1">Your Location</div>
                  <div className="font-mono text-2xl font-bold">{userPos && typeof userPos[0] === 'number' ? userPos[0].toFixed(5) : '0.00000'} N, {userPos && typeof userPos[1] === 'number' ? userPos[1].toFixed(5) : '0.00000'} E</div>
              </div>
              <div className="w-full space-y-3">
                  <a href="tel:999" className="block w-full bg-white text-red-600 py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-2 shadow-lg"><Phone size={24} /> Call 999</a>
                  <button onClick={() => setShowSOS(false)} className="block w-full py-4 text-white/80 font-bold">Cancel</button>
              </div>
            </div>
        )}

        {/* Floating Draggable Summary Card (Start Hike + Highlights Merged) */}
        {!hasStartedHike && activeRoute && (
          <div 
            style={{ left: cardPos.x, top: cardPos.y }}
            className="absolute z-[600] pointer-events-auto"
          >
             <div
               ref={cardRef}
               style={{ width: cardSize.w, height: cardSize.h }}
               className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-2xl border border-white/40 overflow-auto relative"
             >
                <div 
                   onPointerDown={handleCardDragStart}
                   className="cursor-move flex flex-col items-center mb-4 bg-gray-50/50 -m-5 p-4 rounded-t-3xl border-b border-gray-100 touch-none"
                >
                   <div className="w-8 h-1 bg-gray-300 rounded-full mb-3"></div>
                   <h2 className="text-base font-black text-gray-900 leading-tight text-center">{activeRoute.name}</h2>
                </div>
                
                <div className="mt-4 space-y-4">
                   <div className="grid grid-cols-2 gap-2">
                      <div className="bg-hike-light/50 p-2.5 rounded-xl text-center">
                         <div className="text-[9px] font-bold text-hike-green uppercase tracking-wider mb-0.5">Dist</div>
                         <div className="text-xs font-bold text-gray-800">{activeRoute.distance}</div>
                      </div>
                      <div className="bg-hike-light/50 p-2.5 rounded-xl text-center">
                         <div className="text-[9px] font-bold text-hike-green uppercase tracking-wider mb-0.5">Time</div>
                         <div className="text-xs font-bold text-gray-800">{activeRoute.duration}</div>
                      </div>
                   </div>
                   
                   <div className="bg-orange-50 p-2 rounded-xl border border-orange-100 flex items-center justify-between px-3">
                      <div className="text-[9px] font-bold text-orange-600 uppercase tracking-wider">Difficulty</div>
                      <div className="text-xs font-bold text-gray-800">{activeRoute.difficulty}/5</div>
                   </div>

                   <div className="flex flex-col gap-2 pt-2">
                      {isLeader && teamId && !hasStartedHike && !isReviewMode && (
                        <button 
                          onClick={async () => { 
                          try {
                            // Diagnostics: Check types
                            console.log('Confirmation details:', { teamId, routeId: activeRoute.id, routeName: activeRoute.name });

                            // Check if the route exists in the DB to avoid Foreign Key violation
                            let canPassId = false;
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeRoute.id);
                            
                            if (isUuid) {
                               const { data } = await supabase.from('routes').select('id').eq('id', activeRoute.id).single();
                               if (data) canPassId = true;
                            }

                            let snapshotCoords = (activeRoute.coordinates && activeRoute.coordinates.length > 0)
                              ? activeRoute.coordinates
                              : mergeSegmentCoordinates((activeRoute as any).segments || []);

                            if ((!snapshotCoords || snapshotCoords.length === 0) && activeRoute.id) {
                              const { data: composedRoute } = await supabase
                                .from('composed_routes')
                                .select('full_coordinates, segments')
                                .eq('id', activeRoute.id)
                                .single();
                              if (composedRoute) {
                                const composedCoords = Array.isArray((composedRoute as any).full_coordinates)
                                  ? (composedRoute as any).full_coordinates
                                  : [];
                                snapshotCoords = composedCoords.length > 0
                                  ? composedCoords
                                  : mergeSegmentCoordinates((composedRoute as any).segments || []);
                              } else {
                                const { data: officialRoute } = await supabase
                                  .from('routes')
                                  .select('full_coordinates, segments')
                                  .eq('id', activeRoute.id)
                                  .single();
                                if (officialRoute) {
                                  const officialCoords = Array.isArray((officialRoute as any).full_coordinates)
                                    ? (officialRoute as any).full_coordinates
                                    : [];
                                  snapshotCoords = officialCoords.length > 0
                                    ? officialCoords
                                    : mergeSegmentCoordinates((officialRoute as any).segments || []);
                                }
                              }
                            }

                            const { data: memberRows } = await supabase
                              .from('team_members')
                              .select('user_id, user_name, role, preferences_completed, user_preferences, joined_at')
                              .eq('team_id', teamId)
                              .order('joined_at', { ascending: true });
                            
                            const targetRouteData = {
                              id: activeRoute.id,
                              name: activeRoute.name,
                              region: activeRoute.region || 'Hong Kong',
                              description: activeRoute.description || '',
                              distance: activeRoute.distance,
                              duration: activeRoute.duration,
                              difficulty: activeRoute.difficulty,
                              elevationGain: (activeRoute as any).elevationGain || 0,
                              coordinates: snapshotCoords,
                              segments: (activeRoute as any).segments || [],
                              confirmed_at: new Date().toISOString(),
                              confirmed_by: userId || null,
                              team_members_snapshot: Array.isArray(memberRows) ? memberRows : []
                            };

                            const { error } = await supabase
                              .from('teams')
                              .update({ 
                                 status: 'confirmed', 
                                 target_route_id: canPassId ? activeRoute.id : null, 
                                 target_route_name: activeRoute.name,
                                 target_route_data: targetRouteData
                              })
                              .eq('id', teamId); 
                            
                            if (error) {
                               console.error('Supabase update error:', error);
                               alert(`Failed to confirm route: ${error.message || 'Unknown database error'}`);
                               return;
                            }
                            alert('✅ Route confirmed! Your team can now join this hike.'); 
                          } catch (e) {
                            console.error('Catch error:', e);
                            alert('Failed to confirm route due to a client-side error.');
                          }
                          }} 
                          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={14}/> Confirm for Team
                        </button>
                      )}
                      {!isReviewMode && (
                        <button onClick={handleStartRecording} className="w-full bg-gradient-to-r from-hike-green to-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><Navigation size={14}/> Start Hike</button>
                      )}
                   </div>
                </div>

                <div
                  onPointerDown={handleResizeStart}
                  className="absolute right-2 bottom-2 h-6 w-6 rounded-full border border-gray-200 bg-white/90 shadow-sm cursor-se-resize touch-none flex items-center justify-center text-gray-500"
                  title="Resize"
                >
                  <MoveDiagonal2 size={12} />
                </div>
             </div>
          </div>
        )}

        {/* Side Controls */}
        {!isReviewMode && (
          <div className={`absolute right-4 z-[400] flex flex-col origin-top-right ${panelMode === 'chat' ? 'top-4 gap-2 scale-90' : 'top-24 gap-3'}`}>
             <button onClick={() => setShowSOS(true)} className={`bg-red-600 text-white rounded-full shadow-2xl font-black border-2 border-white/30 ${panelMode === 'chat' ? 'p-3 text-[10px]' : 'p-4 text-[11px]'}`}>SOS</button>
             {isLeader && <button onClick={() => setShowSaveDialog(true)} className={`bg-blue-600 text-white rounded-full shadow-lg border border-white/30 ${panelMode === 'chat' ? 'p-3' : 'p-3.5'}`}><Upload size={panelMode === 'chat' ? 18 : 20}/></button>}
             <button
               onClick={() => {
                 if (!activeRouteId) {
                   setToast({ message: 'Select a route first to add an emotion note.', type: 'info' });
                   setTimeout(() => setToast(null), 3000);
                   return;
                 }
                 setShowAddNote(true);
               }}
               className={`bg-white rounded-full shadow-lg border border-white/30 ${activeRouteId ? 'text-orange-500' : 'text-gray-300'} ${panelMode === 'chat' ? 'p-3' : 'p-3.5'}`}
               title={activeRouteId ? 'Add emotion note' : 'Select a route first'}
             >
               <Star size={panelMode === 'chat' ? 18 : 20}/>
             </button>
             {hasStartedHike && (
               <>
                 <button
                   onClick={() => {
                     setIsRecording(false);
                     setShowSaveDialog(true);
                   }}
                   className={`${panelMode === 'chat' ? 'p-3' : 'p-3.5'} rounded-full shadow-lg border border-white/30 bg-green-600 text-white`}
                 >
                   <Check size={panelMode === 'chat' ? 18 : 20}/>
                 </button>
                 <button onClick={() => { 
                   if(window.confirm('Quit?')) {
                     resetHikeStore();
                     onBack && onBack(); 
                   }
                 }} className={`bg-white rounded-full shadow-lg text-gray-500 border border-white/30 ${panelMode === 'chat' ? 'p-3' : 'p-3.5'}`}><X size={panelMode === 'chat' ? 18 : 20}/></button>
               </>
             )}
          </div>
        )}
        
        {/* Info Toggle (Left Side) */}
        {activeRoute && (
          <div className="absolute top-24 left-4 z-[500]">
            <button onClick={() => setShowRouteInfo(true)} className="p-3 bg-white/90 rounded-full shadow-lg text-hike-green border border-white/40 backdrop-blur-sm"><Info size={24} /></button>
          </div>
        )}
      </div>

      {/* Emotion Note Modal */}
      {showAddNote && (
        <div className="absolute inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowAddNote(false)}>
           <div className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl relative animate-scale-in" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowAddNote(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
              
              <div className="mb-6">
                 <h3 className="text-2xl font-black text-gray-900 mb-2">How are you feeling?</h3>
                 <div className="h-1.5 w-12 bg-orange-500 rounded-full"></div>
                 <p className="text-xs text-gray-500 mt-2 font-medium">Your location & mood will be shared with the team.</p>
              </div>

              <div className="space-y-4">
                 <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <textarea 
                       value={noteContent} 
                       onChange={e => setNoteContent(e.target.value)} 
                       placeholder="Write something about this spot..." 
                       className="w-full bg-transparent border-none outline-none resize-none h-32 text-gray-700 font-medium"
                    />
                    
                    {noteImagePreview ? (
                      <div className="relative mt-2">
                        <img src={noteImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                        <button 
                          onClick={() => { setNoteImage(null); setNoteImagePreview(null); }}
                          className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex justify-end">
                        <label className="cursor-pointer text-gray-500 hover:text-hike-green transition-colors flex items-center gap-1 text-sm font-bold bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                          <Camera size={16} />
                          <span>Add Photo</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNoteImage(file);
                                const reader = new FileReader();
                                reader.onloadend = () => setNoteImagePreview(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }} 
                          />
                        </label>
                      </div>
                    )}
                 </div>
                 
                 <div className="flex flex-wrap gap-2">
                    {['🏔️ Great', '😴 Tired', '📸 Scenic', '💧 Need Water'].map(tag => (
                       <button 
                          key={tag} 
                          onClick={() => setNoteContent(prev => prev ? `${prev} ${tag}` : tag)}
                          className="px-3 py-1.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600 hover:bg-gray-200"
                       >
                          {tag}
                       </button>
                    ))}
                 </div>

                 <button 
                    onClick={handleAddNote} 
                    disabled={isNoteSubmitting || !noteContent.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-[24px] font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 mt-4"
                 >
                    {isNoteSubmitting ? 'Saving...' : 'Pin to Map'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Info Modal (Centered) */}
      {showRouteInfo && (
        <div className="absolute inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowRouteInfo(false)}>
           <div className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[85vh] relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowRouteInfo(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
              
              <div className="mb-8">
                 <h3 className="text-2xl font-black text-gray-900 mb-2">Route Overview</h3>
                 <div className="h-1.5 w-12 bg-hike-green rounded-full"></div>
              </div>

              <div className="space-y-8 select-text">
                 <div className="bg-gray-50 p-5 rounded-[32px] border border-gray-100 select-text">
                    <h4 className="font-bold text-gray-900 mb-2 select-text">{activeRoute?.name}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed select-text">{activeRoute?.description}</p>
                 </div>

                 <div className="select-text">
                    <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Sparkles size={16} className="text-orange-500"/> Route Highlights
                    </h4>
                    {isLoadingHighlights ? (
                       <div className="flex flex-col items-center py-6 space-y-2">
                          <div className="w-6 h-6 border-2 border-hike-green border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-[10px] text-gray-400 font-bold animate-pulse uppercase tracking-wider">AI Generating Highlights...</p>
                       </div>
                    ) : aiHighlights ? (
                       <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm select-text">
                          <div className="prose prose-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap select-text">
                             {renderMarkdown(aiHighlights)}
                          </div>
                       </div>
                    ) : (
                       <div className="space-y-4 select-text">
                          {reminderInfo.filter(r => { 
                             const coords = getCoords(r);
                             return coords && isPointNearRoute(coords[0], coords[1], activeRoute?.coordinates || [], 200); 
                          }).map(r => (
                             <div key={r.id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex gap-3 select-text">
                                <div className={`mt-0.5 p-2 rounded-xl ${r.category?.toLowerCase() === 'risk' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                   {r.category?.toLowerCase() === 'risk' ? <AlertCircle size={18}/> : <Info size={18}/>}
                                </div>
                                <div className="select-text">
                                   <div className="text-sm font-bold text-gray-900 mb-1 select-text">{r.name}</div>
                                   <p className="text-xs text-gray-500 italic select-text">"{r.ai_prompt}"</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
              
              <button onClick={() => setShowRouteInfo(false)} className="w-full mt-10 bg-gray-900 text-white py-4 rounded-[24px] font-bold shadow-lg active:scale-95 transition-all">Got it</button>
           </div>
        </div>
      )}

      {/* Chat Section */}
      <div className="flex-1 min-h-0 bg-white flex flex-col pb-0 overflow-hidden relative">
         {/* Drag Handle to collapse */}
         {panelMode === 'chat' && (
            <div 
               onClick={() => setPanelMode('map')} 
               className="w-full h-6 flex items-center justify-center cursor-pointer bg-gray-50 border-b border-gray-200"
               title="Collapse Panel"
            >
               <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>
         )}
         <div className="flex border-b border-gray-100">
            <button onClick={() => {setChatType('ai'); setPanelMode('chat');}} className={`flex-1 ${panelMode === 'map' ? 'py-2.5 text-xs' : 'py-4 text-sm'} font-bold ${chatType === 'ai' ? 'text-hike-green border-b-2 border-hike-green' : 'text-gray-400'}`}>AI Guide</button>
            <button onClick={() => {setChatType('team'); setPanelMode('chat');}} className={`flex-1 ${panelMode === 'map' ? 'py-2.5 text-xs' : 'py-4 text-sm'} font-bold ${chatType === 'team' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
               <span className={isRefreshingTeam ? 'animate-pulse' : ''}>Team ({teamId ? actualTeamSize : (activeRoute ? 1 : 0)})</span>
            </button>
         </div>
         <div ref={chatScrollRef} className={`flex-1 min-h-0 overflow-y-auto bg-gray-50 select-text ${panelMode === 'map' ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}>
            {chatType === 'team' ? (
               <div className="space-y-4 select-text">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 select-text">
                     <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> {teamId ? 'Team Members' : (activeRoute ? 'Solo Hiker' : 'No Team')}</h4>
                     <div className="space-y-3 select-text">
                        {!activeRoute && !teamId && (
                           <div className="text-sm text-gray-500 text-center py-4">Demo Mode - No active team</div>
                        )}
                        {teamMembers.map((member, idx) => (
                           <div key={idx} className="p-3 bg-gray-50 rounded-xl border flex flex-col gap-2 select-text">
                              <div className="flex justify-between items-center select-text"><span className="font-bold text-gray-900 text-sm select-text">{member.user_name}</span><span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">{member.role}</span></div>
                              <div className="flex flex-wrap gap-1.5 select-text">{member.user_mood && <span className="text-[10px] bg-white px-2 py-0.5 rounded border select-text">Mood: {member.user_mood}</span>}{member.user_difficulty && <span className="text-[10px] bg-white px-2 py-0.5 rounded border select-text">Level: {member.user_difficulty}</span>}</div>
                              {member.user_condition && <p className="text-[10px] text-gray-500 italic mt-1 border-t pt-1 select-text">"{member.user_condition}"</p>}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            ) : (
               <div className="space-y-4 select-text">
                  {panelMode === 'chat' && (
                     <div className="sticky top-0 z-20 pb-2 mb-3">
                      <div className="grid grid-cols-4 gap-2 bg-white/18 backdrop-blur-xl border border-white/30 rounded-2xl p-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                        <button onClick={() => handleSendMessage("Where is water?")} className="flex flex-col items-center bg-white/45 hover:bg-white/60 p-2 rounded-xl border border-white/35 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors"><Droplet size={18} className="text-blue-500 mb-1"/><span className="text-[9px]">Water</span></button>
                        <button onClick={() => handleSendMessage("Rest points?")} className="flex flex-col items-center bg-white/45 hover:bg-white/60 p-2 rounded-xl border border-white/35 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors"><Tent size={18} className="text-green-500 mb-1"/><span className="text-[9px]">Rest</span></button>
                        <button onClick={() => handleSendMessage("Help!")} className="flex flex-col items-center bg-white/45 hover:bg-white/60 p-2 rounded-xl border border-white/35 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors"><AlertCircle size={18} className="text-red-500 mb-1"/><span className="text-[9px]">Help</span></button>
                        <button onClick={() => handleSendMessage("Trail Info")} className="flex flex-col items-center bg-white/45 hover:bg-white/60 p-2 rounded-xl border border-white/35 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors"><Info size={18} className="text-gray-400 mb-1"/><span className="text-[9px]">Info</span></button>
                      </div>
                     </div>
                  )}
                  {(panelMode === 'chat'
                    ? messages
                    : (() => {
                        const aiMessages = messages.filter(m => m.sender === 'ai');
                        const lastAi = aiMessages[aiMessages.length - 1];
                        return lastAi ? [lastAi] : [];
                      })()
                  ).map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} select-text`}>
                       <div
                         className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap select-text ${m.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none shadow-sm'} ${panelMode === 'map' ? 'line-clamp-3' : ''}`}
                       >
                         {renderMarkdown(m.text)}
                       </div>
                    </div>
                  ))}
                  {panelMode === 'map' && messages.filter(m => m.sender === 'ai').length === 0 && (
                    <div className="text-xs text-gray-400">AI Guide is ready.</div>
                  )}
               </div>
            )}
         </div>
         {!isReviewMode && (
           panelMode === 'chat' ? (
             <div className="p-3 bg-white border-t flex items-center gap-2 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
                <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask AI..." className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" />
                <button onClick={() => handleSendMessage()} className="p-2 bg-hike-green text-white rounded-full shadow-sm"><Send size={18} /></button>
             </div>
         ) : (
             <button
               onClick={() => { setChatType('ai'); setPanelMode('chat'); }}
               className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 w-14 h-14 rounded-full bg-gradient-to-br from-hike-green to-emerald-600 text-white shadow-2xl shadow-emerald-500/40 flex items-center justify-center active:scale-95 transition-all border-2 border-white/30 z-[600]"
               title="Ask AI"
             >
               <Sparkles size={24} />
             </button>
           )
         )}
       </div>

      {/* Upload Modal (Moved here to ensure it's on top) */}
      {showUploadModal && (
        <div className="absolute inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowUploadModal(false)}>
           <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Share Route</h3><button onClick={() => setShowUploadModal(false)}><X size={20}/></button></div>
              <div className="space-y-4">
                 <div><label className="text-xs font-bold text-gray-500 uppercase">Route Name</label><input value={uploadData.name} onChange={e => setUploadData({...uploadData, name: e.target.value})} className="w-full border-b-2 border-hike-green py-2 outline-none"/></div>
                 <div><label className="text-xs font-bold text-gray-500 uppercase">Description</label><textarea value={uploadData.description} onChange={e => setUploadData({...uploadData, description: e.target.value})} className="w-full border-b py-2 h-20 outline-none resize-none"/></div>
                 <label className="flex items-center justify-between text-sm text-gray-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                   <span>Include Emotion Notes</span>
                   <input
                     type="checkbox"
                     checked={includeEmotionNotesOnUpload}
                     onChange={e => setIncludeEmotionNotesOnUpload(e.target.checked)}
                     className="h-4 w-4 accent-orange-500"
                   />
                 </label>
                 <button onClick={handleConfirmUpload} disabled={isUploadingRoute} className="w-full bg-hike-green text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50">{isUploadingRoute ? 'Uploading...' : 'Confirm & Share'}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CompanionView;
