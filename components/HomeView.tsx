import React, { useState, useEffect } from 'react';
import { User, UserStats, Track, GroupHike } from '../types';
import { Settings, QrCode, Map, Clock, Zap, Activity, Share2, Users, Trash2, LogOut, Flame, Mountain, AlertCircle, Loader, Compass, History as HistoryIcon, Info } from 'lucide-react';
import HikePalLogo from './HikePalLogo';
import { supabase } from '../utils/supabaseClient';
import { createTeam } from '../services/teamService';
import { mergeSegmentCoordinates, fetchRouteById } from '../services/segmentRoutingService';

interface HomeViewProps {
    user: User; 
    onLogout: () => void; 
    myTracks: Track[];
    myGroupHikes: GroupHike[];
    onPublishTrack: (track: Track) => Promise<void>;
    onDeleteGroupHike?: (groupId: string, isOrganizer: boolean) => Promise<void>;
    onDeleteTrack?: (trackId: string) => Promise<void>;
    onGotoPlanning?: (teamId?: string) => void; 
    onReviewTrack?: (track: Track) => void;
    onPreviewTeamRoute?: (teamId: string) => void;
}

const buildMinimalAvatarDataUri = (cfg: {
  bg: string;
  faceColor: string;
  elements: string;
}) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112">
    <rect width="112" height="112" rx="56" fill="${cfg.bg}"/>
    <g transform="translate(24, 24) scale(1.15)">
      <circle cx="28" cy="28" r="26" fill="${cfg.faceColor}"/>
      ${cfg.elements}
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const SYSTEM_AVATAR_PRESETS = [
  {
    id: 'm1', label: 'Happy Mike',
    url: buildMinimalAvatarDataUri({ bg: '#E5E7EB', faceColor: '#FFE0BD', elements: '<circle cx="18" cy="24" r="2.5"/><circle cx="38" cy="24" r="2.5"/><path d="M18 38c3 4 17 4 20 0" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>' })
  },
  {
    id: 'm2', label: 'Cool Alex',
    url: buildMinimalAvatarDataUri({ bg: '#DBEAFE', faceColor: '#FFD1A4', elements: '<path d="M12 22h32v6h-32z" fill="#000"/><path d="M18 36h20" stroke="#000" stroke-width="3" stroke-linecap="round"/>' })
  },
  {
    id: 'm3', label: 'Wink Ben',
    url: buildMinimalAvatarDataUri({ bg: '#DCFCE7', faceColor: '#FFE0BD', elements: '<path d="M14 24l8 2m12-2c2 0 6 0 8 0" stroke="#000" stroke-width="2.5" stroke-linecap="round"/><path d="M20 40c4 2 12 2 16 0" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>' })
  },
  {
    id: 'm4', label: 'Surprised Leo',
    url: buildMinimalAvatarDataUri({ bg: '#FEF9C3', faceColor: '#FFCC99', elements: '<circle cx="18" cy="22" r="3"/><circle cx="38" cy="22" r="3"/><circle cx="28" cy="38" r="5" fill="none" stroke="#000" stroke-width="2.5"/>' })
  },
  {
    id: 'm5', label: 'Grinning Sam',
    url: buildMinimalAvatarDataUri({ bg: '#F3E8FF', faceColor: '#FFE0BD', elements: '<path d="M16 22h4m16 0h4" stroke="#000" stroke-width="3"/><path d="M16 34h24v6H16z" fill="#FFF" stroke="#000" stroke-width="2"/>' })
  },
  {
    id: 'f1', label: 'Smiling Joy',
    url: buildMinimalAvatarDataUri({ bg: '#FCE7F3', faceColor: '#FFD1A4', elements: '<circle cx="18" cy="25" r="2"/><circle cx="38" cy="25" r="2"/><path d="M15 36c4 6 22 6 26 0" fill="none" stroke="#E91E63" stroke-width="3" stroke-linecap="round"/>' })
  },
  {
    id: 'f2', label: 'Playful Mia',
    url: buildMinimalAvatarDataUri({ bg: '#FEE2E2', faceColor: '#FFE0BD', elements: '<circle cx="18" cy="24" r="2.5"/><circle cx="38" cy="24" r="2.5"/><path d="M22 38h12" stroke="#000" stroke-width="3" stroke-linecap="round"/><path d="M28 38v4c0 2 4 2 4 0v-4" fill="#FF5252"/>' })
  },
  {
    id: 'f3', label: 'Zen Ava',
    url: buildMinimalAvatarDataUri({ bg: '#FFEDD5', faceColor: '#FFCC99', elements: '<path d="M14 26c2-2 6-2 8 0m12 0c2-2 6-2 8 0" fill="none" stroke="#000" stroke-width="2.5"/><path d="M20 40c4 2 12 2 16 0" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>' })
  },
  {
    id: 'f4', label: 'Shy Zoe',
    url: buildMinimalAvatarDataUri({ bg: '#ECFDF5', faceColor: '#FFE0BD', elements: '<circle cx="18" cy="24" r="2"/><circle cx="38" cy="24" r="2"/><circle cx="12" cy="30" r="4" fill="#FF8A80" opacity="0.4"/><circle cx="44" cy="30" r="4" fill="#FF8A80" opacity="0.4"/><path d="M24 38c2 1 6 1 8 0" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>' })
  },
  {
    id: 'f5', label: 'Calm Emma',
    url: buildMinimalAvatarDataUri({ bg: '#E0F2FE', faceColor: '#FFD1A4', elements: '<circle cx="18" cy="24" r="2"/><circle cx="38" cy="24" r="2"/><path d="M22 38h12" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>' })
  }
];

const STATUS_PRESETS = [
  { value: 'ready', label: '🥾 Ready to Hike' },
  { value: 'planning', label: '🗺️ Planning Next Trail' },
  { value: 'weekend', label: '🌄 Weekend Explorer' },
  { value: 'recovery', label: '🧘 Recovery Mode' },
  { value: 'teamup', label: '🤝 Team Up Welcome' },
  { value: 'guest', label: '🧭 Guest Trial Mode' }
];

const MOUNTAIN_SEA_BG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#9ED8FF"/>
        <stop offset="45%" stop-color="#BFE7FF"/>
        <stop offset="100%" stop-color="#EAF6FF"/>
      </linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5FAFD0"/>
        <stop offset="100%" stop-color="#2D7FA7"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#sky)"/>
    <path d="M0 500 C180 440 280 430 420 470 C600 520 730 360 900 420 C1030 465 1110 440 1200 400 L1200 800 L0 800 Z" fill="#6EA286"/>
    <path d="M0 560 C200 500 340 520 500 560 C680 610 850 560 1020 535 C1100 522 1150 524 1200 530 L1200 800 L0 800 Z" fill="#4E7B66"/>
    <path d="M0 610 C220 585 380 628 580 656 C770 682 950 660 1200 620 L1200 800 L0 800 Z" fill="url(#sea)"/>
    <path d="M0 665 C190 640 410 700 610 710 C840 722 1010 685 1200 655 L1200 800 L0 800 Z" fill="#2A6D92" opacity="0.75"/>
  </svg>`
)}`;

const normalizeStatusValue = (raw: string | null | undefined): string => {
  if (!raw) return 'ready';
  const byValue = STATUS_PRESETS.find(s => s.value === raw);
  if (byValue) return byValue.value;
  const legacy = raw.toLowerCase();
  if (legacy.includes('ready')) return 'ready';
  if (legacy.includes('plan')) return 'planning';
  if (legacy.includes('weekend')) return 'weekend';
  if (legacy.includes('recover')) return 'recovery';
  if (legacy.includes('team')) return 'teamup';
  if (legacy.includes('guest')) return 'guest';
  return 'ready';
};

const getTeamStatusMeta = (rawStatus: string | null | undefined): { label: string; className: string } => {
  const raw = String(rawStatus || '').trim();
  const status = raw.toLowerCase();
  if (raw === '完成') {
    return { label: 'Done', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (raw === '退出') {
    return { label: 'Exited', className: 'bg-red-100 text-red-700' };
  }
  if (raw === '确认') {
    return { label: 'Confirmed', className: 'bg-green-100 text-green-700' };
  }
  if (status === 'completed' || status === 'done') {
    return { label: 'Done', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (status === 'confirmed') {
    return { label: 'Confirmed', className: 'bg-green-100 text-green-700' };
  }
  if (status === 'exited') {
    return { label: 'Exited', className: 'bg-red-100 text-red-700' };
  }
  return { label: 'Planning', className: 'bg-amber-100 text-amber-700' };
};

const getTeamStatusCode = (rawStatus: string | null | undefined): 'done' | 'confirmed' | 'exited' | 'planning' => {
  const raw = String(rawStatus || '').trim();
  const status = raw.toLowerCase();
  if (raw === '完成' || status === 'completed' || status === 'done') return 'done';
  if (raw === '退出' || status === 'exited') return 'exited';
  if (raw === '确认' || status === 'confirmed') return 'confirmed';
  return 'planning';
};

const HomeView: React.FC<HomeViewProps> = ({ user, onLogout, myTracks, myGroupHikes, onPublishTrack, onDeleteGroupHike, onDeleteTrack, onGotoPlanning, onReviewTrack, onPreviewTeamRoute }) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const trackMapRef = React.useRef<HTMLDivElement>(null);
  const trackMapInstanceRef = React.useRef<any>(null);
  const [profileUsername, setProfileUsername] = useState(user.name || 'Explorer');
  const [profileRole, setProfileRole] = useState<'hiker' | 'guardian' | 'ngo_admin'>('hiker');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [showTeamDetail, setShowTeamDetail] = useState(false);
  const [teamDetail, setTeamDetail] = useState<any>(null);
  const [isLoadingTeamDetail, setIsLoadingTeamDetail] = useState(false);
  const teamRouteMapRef = React.useRef<HTMLDivElement>(null);
  const teamRouteMapInstanceRef = React.useRef<any>(null);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string>('ready');
  
  const syncNicknameCaches = (nicknameRaw: string) => {
    if (typeof window === 'undefined') return;
    const nickname = nicknameRaw.trim();
    if (!nickname) return;
    localStorage.setItem('hikepal_nickname', nickname);
    localStorage.setItem('hikepal_solo_nickname', nickname);
    localStorage.setItem('hikepal_group_nickname', nickname);

    Object.keys(localStorage)
      .filter(key => key.startsWith('hikepal_team_member_name_'))
      .forEach(key => localStorage.setItem(key, nickname));

    window.dispatchEvent(new CustomEvent('hikepal:nickname-updated', { detail: { nickname } }));
  };

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
    if (Array.isArray(p) && p.length >= 2) return normalizeLatLng(p[0], p[1]);
    if (p && typeof p === 'object' && typeof p.lat === 'number' && typeof p.lng === 'number') return normalizeLatLng(p.lat, p.lng);
    if (p && typeof p === 'object' && typeof p.latitude === 'number' && typeof p.longitude === 'number') return normalizeLatLng(p.latitude, p.longitude);
    if (p && typeof p === 'object' && p.type === 'Point' && Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
      return normalizeLatLng(p.coordinates[1], p.coordinates[0]);
    }
    return null;
  };

  const sanitizeRouteCoords = (raw: any): [number, number][] => {
    let candidate: any = raw;
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        return [];
      }
    }
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
    candidate.forEach((pt: any) => {
      const norm = normalizePoint(pt);
      if (norm) cleaned.push(norm);
    });
    return cleaned;
  };

  const getDisplayWaypoints = (track: Track | null): any[] => {
    if (!track || !Array.isArray(track.waypoints)) return [];
    return track.waypoints.filter((wp: any) => wp && wp.type !== 'reminder');
  };

  const resolveWaypointEmoji = (wp: any): string => {
    if (wp?.imageUrl) return '📸';
    if (typeof wp?.emoji === 'string' && wp.emoji.trim().length > 0) return wp.emoji.trim();
    const noteText = String(wp?.note || '').trim();
    if (!noteText) return '🙂';
    const emojiMatch = noteText.match(/(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
    if (emojiMatch?.[1]) return emojiMatch[1];
    const firstChar = Array.from(noteText)[0];
    return firstChar && firstChar.length > 0 ? firstChar : '🙂';
  };

  const resolveSnapshotCoords = (snapshot: any): [number, number][] => {
    if (!snapshot) return [];
    const direct = sanitizeRouteCoords(snapshot.coordinates);
    if (direct.length > 0) return direct;
    if (Array.isArray(snapshot.segments) && snapshot.segments.length > 0) {
      return sanitizeRouteCoords(mergeSegmentCoordinates(snapshot.segments));
    }
    if (Array.isArray(snapshot.full_coordinates) && snapshot.full_coordinates.length > 0) {
      return sanitizeRouteCoords(snapshot.full_coordinates);
    }
    return [];
  };

  const openTeamDetail = async (teamId: string) => {
    setIsLoadingTeamDetail(true);
    setShowTeamDetail(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, description, team_size, max_team_size, status, created_at, target_route_id, target_route_name, target_route_data')
        .eq('id', teamId)
        .single();
      if (error) throw error;

      const { data: membersData } = await supabase
        .from('team_members')
        .select('user_id, user_name, role, preferences_completed, user_preferences, joined_at')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      const members = Array.isArray(membersData) ? membersData : [];
      const missingNameIds = members
        .filter((m: any) => !String(m.user_name || '').trim())
        .map((m: any) => m.user_id)
        .filter(Boolean);

      let profileNameMap: Record<string, string> = {};
      if (missingNameIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', missingNameIds);
        profileNameMap = (profileRows || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = (p.full_name || p.username || '').trim();
          return acc;
        }, {});
      }

      const normalizedMembers = members.map((m: any) => ({
        ...m,
        user_name: String(m.user_name || '').trim() || profileNameMap[m.user_id] || 'Member'
      }));

      const snapshotMembers = Array.isArray((data as any)?.target_route_data?.team_members_snapshot)
        ? (data as any).target_route_data.team_members_snapshot
        : [];

      let hydratedRouteSnapshot = (data as any)?.target_route_data || null;
      const existingSnapshotCoords = resolveSnapshotCoords(hydratedRouteSnapshot);

      if ((!hydratedRouteSnapshot || existingSnapshotCoords.length === 0) && (data as any)?.target_route_id) {
        const deepRoute = await fetchRouteById((data as any).target_route_id);
        if (deepRoute) {
          const fallbackCoords = sanitizeRouteCoords(deepRoute.full_coordinates || []);
          const mergedCoords = fallbackCoords.length > 0
            ? fallbackCoords
            : sanitizeRouteCoords(mergeSegmentCoordinates(deepRoute.segments || []));
          hydratedRouteSnapshot = {
            ...(hydratedRouteSnapshot || {}),
            id: deepRoute.id || (data as any).target_route_id,
            name: hydratedRouteSnapshot?.name || deepRoute.name || (data as any).target_route_name || 'Team Route',
            region: hydratedRouteSnapshot?.region || deepRoute.region || 'Hong Kong',
            description: hydratedRouteSnapshot?.description || deepRoute.description || '',
            distance: hydratedRouteSnapshot?.distance || `${Number(deepRoute.total_distance || 0).toFixed(1)}km`,
            duration: hydratedRouteSnapshot?.duration || `${Math.round(Number(deepRoute.total_duration_minutes || 0) / 60) || 0}h`,
            difficulty: hydratedRouteSnapshot?.difficulty || deepRoute.difficulty_level || 3,
            elevationGain: hydratedRouteSnapshot?.elevationGain || deepRoute.total_elevation_gain || 0,
            coordinates: mergedCoords,
            segments: hydratedRouteSnapshot?.segments || deepRoute.segments || []
          };
        }
      }

      setTeamDetail({
        ...data,
        target_route_data: hydratedRouteSnapshot,
        team_members: snapshotMembers.length > 0 ? snapshotMembers : normalizedMembers
      });
    } catch (e) {
      console.error('Failed to load team detail:', e);
      setTeamDetail(null);
    } finally {
      setIsLoadingTeamDetail(false);
    }
  };

  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    const routeCoords = resolveSnapshotCoords((teamDetail as any)?.target_route_data);

    if (!showTeamDetail || !teamRouteMapRef.current || !L || routeCoords.length === 0) {
      if (teamRouteMapInstanceRef.current) {
        teamRouteMapInstanceRef.current.remove();
        teamRouteMapInstanceRef.current = null;
      }
      return;
    }

    if (teamRouteMapInstanceRef.current) {
      teamRouteMapInstanceRef.current.remove();
      teamRouteMapInstanceRef.current = null;
    }
    const container = teamRouteMapRef.current;
    (container as any)._leaflet_id = null;
    container.innerHTML = '';

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    const line = L.polyline(routeCoords, {
      color: '#2E7D32',
      weight: 5,
      opacity: 0.85
    }).addTo(map);

    if (routeCoords.length > 0) {
      const startIcon = L.divIcon({
        html: `<div style="background:#2E7D32;color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:10px;font-weight:700;">S</div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      const endIcon = L.divIcon({
        html: `<div style="background:#D32F2F;color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:10px;font-weight:700;">E</div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      L.marker(routeCoords[0], { icon: startIcon }).addTo(map);
      L.marker(routeCoords[routeCoords.length - 1], { icon: endIcon }).addTo(map);
    }

    map.fitBounds(line.getBounds(), { padding: [16, 16] });
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(line.getBounds(), { padding: [16, 16] });
    }, 200);

    teamRouteMapInstanceRef.current = map;

    return () => {
      if (teamRouteMapInstanceRef.current) {
        teamRouteMapInstanceRef.current.remove();
        teamRouteMapInstanceRef.current = null;
      }
      if (teamRouteMapRef.current) {
        (teamRouteMapRef.current as any)._leaflet_id = null;
        teamRouteMapRef.current.innerHTML = '';
      }
    };
  }, [showTeamDetail, teamDetail]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setCreateError('Please enter a team name');
      return;
    }
    try {
      setCreatingTeam(true);
      setCreateError(null);
      const newTeam = await createTeam(teamName.trim(), '', true, 1);
      setShowCreateTeam(false);
      setTeamName('');
      if (onGotoPlanning) {
        onGotoPlanning(newTeam.id);
      }
    } catch (error) {
      console.error('Error creating team:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const updates = {
        id: user.id,
        full_name: profileUsername,
        role: profileRole,
        avatar_url: profileAvatarUrl,
        updated_at: new Date(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hikepal_profile_status_${user.id}`, profileStatus);
      }
      syncNicknameCaches(profileUsername);
      setShowEditProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (user.isGuest) {
        setProfileUsername('Guest Explorer');
        setProfileAvatarUrl(SYSTEM_AVATAR_PRESETS[0].url);
        setProfileRole('hiker');
        setProfileStatus('guest');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          const resolvedNickname = profileData.full_name || profileData.username || user.name || 'Explorer';
          setProfileUsername(resolvedNickname);
          setProfileAvatarUrl(profileData.avatar_url || SYSTEM_AVATAR_PRESETS[0].url);
          setProfileRole(profileData.role || 'hiker');
          syncNicknameCaches(resolvedNickname);
        } else {
          setProfileUsername(user.name || 'Explorer');
          setProfileAvatarUrl(SYSTEM_AVATAR_PRESETS[0].url);
        }
        const savedStatus = typeof window !== 'undefined' ? localStorage.getItem(`hikepal_profile_status_${user.id}`) : null;
        setProfileStatus(normalizeStatusValue(savedStatus));
        setLoading(false);
      } catch (error) {
        setProfileUsername(user.name || 'Explorer');
        setProfileAvatarUrl(SYSTEM_AVATAR_PRESETS[0].url);
        const savedStatus = typeof window !== 'undefined' ? localStorage.getItem(`hikepal_profile_status_${user.id}`) : null;
        setProfileStatus(normalizeStatusValue(savedStatus));
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user.id]);

  useEffect(() => {
    setShowEditProfile(false);
    setShowCreateTeam(false);
    setShowJoinTeam(false);
    setTeamName('');
    setJoinCode('');
  }, [user.id]);

  const stats: UserStats = user.isGuest ? {
    totalDistanceKm: 0,
    hikesCompleted: 0,
    elevationGainedM: 0,
    status: STATUS_PRESETS.find(s => s.value === 'guest')?.label || '🧭 Guest Trial Mode'
  } : {
    totalDistanceKm: myTracks.reduce((acc, t) => acc + (parseFloat(t.distance) || 0), 0),
    hikesCompleted: myTracks.length,
    elevationGainedM: myTracks.reduce((acc, t) => acc + 150, 0),
    status: STATUS_PRESETS.find(s => s.value === profileStatus)?.label || STATUS_PRESETS[0].label
  };

  // Effect to handle track map
  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    if (!selectedTrack || !trackMapRef.current || !L) {
      if (trackMapInstanceRef.current) {
        trackMapInstanceRef.current.remove();
        trackMapInstanceRef.current = null;
      }
      return;
    }

    if (trackMapInstanceRef.current) {
      trackMapInstanceRef.current.remove();
      trackMapInstanceRef.current = null;
    }
    if (trackMapRef.current) {
      const container = trackMapRef.current;
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    }

    const map = L.map(trackMapRef.current, {
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    const normalizePoint = (p: any): [number, number] | null => {
      if (Array.isArray(p) && p.length >= 2) {
        const [a, b] = p;
        if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
          return [a, b];
        }
      }
      if (p && typeof p === 'object' && typeof p.lat === 'number' && typeof p.lng === 'number') {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          return [p.lat, p.lng];
        }
      }
      return null;
    };

    const sanitizeCoords = (raw: any): [number, number][] => {
      if (!Array.isArray(raw)) return [];
      const cleaned: [number, number][] = [];
      raw.forEach((pt) => {
        const norm = normalizePoint(pt);
        if (norm) cleaned.push(norm);
      });
      return cleaned;
    };

    // Ensure we can handle tracks directly uploaded by the community which might have full_coordinates or coordinates
    const coordsSource = selectedTrack.coordinates || (selectedTrack as any).full_coordinates || [];
    const safeCoords = sanitizeCoords(coordsSource);

    if (safeCoords.length > 0) {
      const polyline = L.polyline(safeCoords, {
        color: '#2E7D32',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

      // Add user waypoint markers to map (hide reminder_info markers)
      const displayWaypoints = getDisplayWaypoints(selectedTrack);
      if (displayWaypoints.length > 0) {
        displayWaypoints.forEach((wp: any) => {
          if (wp && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
            const isEmotion = wp.type === 'emotion';
            const isPhoto = wp.type === 'photo';
            
            let emoji = '📍';
            let color = '#F59E0B'; // default marker color
            
            if (isEmotion) {
              emoji = resolveWaypointEmoji(wp);
              color = '#EA580C'; // orange
            } else if (isPhoto) {
              emoji = '📸';
              color = '#3B82F6'; // blue
            }

            const icon = L.divIcon({ 
              html: `<div style="background-color: ${color}; color: white; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${emoji}</div>`,
              className: '',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            
            const escaped = (txt: string) => String(txt || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#39;');
            const popupContent = `
              <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
                <div style="font-size: 14px; font-weight: bold; color: ${color}; margin-bottom: 4px;">
                  ${escaped(wp.note || 'Waypoint')}
                </div>
                ${wp.imageUrl ? `<img src="${escaped(wp.imageUrl)}" alt="Waypoint Image" style="width: 100%; border-radius: 8px; margin-bottom: 8px; max-height: 120px; object-fit: cover;" />` : ''}
              </div>
            `;
            
            L.marker([wp.lat, wp.lng], { icon }).addTo(map).bindPopup(popupContent);
          }
        });
      }

      // Delay to ensure container is fully visible
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      }, 300);
    } else {
      map.setView([22.3193, 114.1694], 11);
    }

    trackMapInstanceRef.current = map;

    return () => {
      if (trackMapInstanceRef.current) {
        trackMapInstanceRef.current.remove();
        trackMapInstanceRef.current = null;
      }
      if (trackMapRef.current) {
        (trackMapRef.current as any)._leaflet_id = null;
        trackMapRef.current.innerHTML = '';
      }
    };
  }, [selectedTrack]);

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] pb-24 overflow-y-auto">
      {user.isGuest && (
        <div className="bg-amber-50 border-b border-amber-100 py-2 px-4 text-center z-[60]">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Info size={12} /> Note: This profile is showing demo data for guest trial
          </p>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-hike-green border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 text-sm">Loading profile...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
	          <div className="px-4 sm:px-6 pt-16 pb-4">
	            <div className="relative rounded-[34px] overflow-hidden border border-white/70 bg-white/72 backdrop-blur-2xl shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
	              <div className="absolute inset-0 pointer-events-none">
	                <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-cyan-300/35 blur-3xl"></div>
	                <div className="absolute -bottom-24 -right-12 w-72 h-72 rounded-full bg-emerald-300/30 blur-3xl"></div>
	                <div className="absolute inset-0 bg-white/24"></div>
	              </div>

	              <div className="relative z-10 px-5 sm:px-6 pt-5 pb-6">
	                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-hike-light shadow-sm">
                        <HikePalLogo className="text-hike-green" size={26} />
                      </div>
                      <span className="text-xl font-black tracking-[-0.02em] text-gray-900">HikePal</span>
                    </div>
                    <div className="flex gap-2.5">
	                  <button
	                    onClick={() => setShowEditProfile(true)}
	                    className="h-11 w-11 rounded-full bg-white/80 backdrop-blur-xl border border-white/80 text-gray-700 shadow-[0_8px_20px_rgba(0,0,0,0.06)] active:scale-95 transition-transform flex items-center justify-center"
	                  >
	                    <Settings size={20}/>
	                  </button>
	                  <button
	                    onClick={onLogout}
	                    className="h-11 w-11 rounded-full bg-white/80 backdrop-blur-xl border border-white/80 text-red-500 shadow-[0_8px_20px_rgba(0,0,0,0.06)] active:scale-95 transition-transform flex items-center justify-center"
	                  >
	                    <LogOut size={20}/>
	                  </button>
                    </div>
	                </div>

	                <div className="flex flex-col items-center text-center">
	                  <div className="relative mb-5">
	                    <div className="absolute -inset-x-7 -inset-y-4 rounded-[26px] overflow-hidden">
	                      <div
	                        className="absolute inset-0 bg-center bg-cover opacity-90 scale-110 blur-md"
	                        style={{ backgroundImage: `url(${MOUNTAIN_SEA_BG})` }}
	                      />
	                      <div className="absolute inset-0 bg-white/18 backdrop-blur-[1px]" />
	                    </div>
	                    <div className="absolute inset-[-10px] rounded-[38px] bg-cyan-200/35 blur-xl" />
	                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-[36px] p-1.5 bg-white/75 border border-white/85 shadow-[0_14px_36px_rgba(0,0,0,0.12)]">
	                      <img
	                        src={profileAvatarUrl}
	                        className="w-full h-full rounded-[30px] object-cover"
	                        alt="Profile"
	                        onError={(e) => {
	                          (e.target as HTMLImageElement).src = SYSTEM_AVATAR_PRESETS[0].url;
	                        }}
	                      />
	                    </div>
	                  </div>

	                  <h1 className="text-[34px] sm:text-[38px] leading-tight font-black tracking-[-0.02em] text-gray-900">
	                    {profileUsername}
	                  </h1>
	                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
	                    <span className="text-[12px] font-bold text-gray-700 bg-white/82 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/75 shadow-sm flex items-center gap-1.5">
	                      {profileRole === 'hiker' && <><span className="text-base">🥾</span> Hiker</>}
	                      {profileRole === 'guardian' && <><span className="text-base">👨‍⚖️</span> Guardian</>}
	                      {profileRole === 'ngo_admin' && <><span className="text-base">🏢</span> NGO Admin</>}
	                    </span>
	                    <span className="text-[12px] font-bold text-gray-700 bg-white/82 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/75 shadow-sm">
	                      {STATUS_PRESETS.find(s => s.value === profileStatus)?.label || STATUS_PRESETS[0].label}
	                    </span>
	                  </div>
	                </div>
	              </div>
	            </div>
	          </div>

	          <div className="flex-1 px-4 sm:px-6 space-y-5 pb-6">
            {/* Main Progress Card */}
	            <div className="bg-white rounded-[30px] p-7 sm:p-8 shadow-[0_10px_26px_rgba(15,23,42,0.05)] border border-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Activity size={80} className="text-hike-green" />
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.2em] font-black mb-3">This Month Distance</p>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-6xl sm:text-7xl font-black text-gray-900 tracking-tighter">
                    {stats.totalDistanceKm.toFixed(1)}
                  </span>
                  <span className="text-xl text-gray-400 font-bold">km</span>
                </div>
	                <div className="h-2 w-48 bg-gray-100 rounded-full mx-auto overflow-hidden">
	                   <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${Math.min(stats.totalDistanceKm * 2, 100)}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-4 font-medium italic">"Every step counts toward your next summit."</p>
            </div>

            {/* Quick Stats Grid */}
	            <div className="grid grid-cols-3 gap-3.5">
	              <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] border border-white flex flex-col items-center justify-center">
                  <div className="w-11 h-11 bg-[#FF9500]/10 rounded-2xl flex items-center justify-center mb-3">
                    <Zap className="text-[#FF9500]" size={22}/>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{stats.hikesCompleted}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">Hikes</span>
              </div>
	              <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] border border-white flex flex-col items-center justify-center">
                  <div className="w-11 h-11 bg-[#34C759]/10 rounded-2xl flex items-center justify-center mb-3">
                    <Activity className="text-[#34C759]" size={22}/>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{stats.totalDistanceKm.toFixed(1)}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">Distance</span>
              </div>
	              <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] border border-white flex flex-col items-center justify-center">
                  <div className="w-11 h-11 bg-[#007AFF]/10 rounded-2xl flex items-center justify-center mb-3">
                    <Mountain className="text-[#007AFF]" size={22}/>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{(stats.elevationGainedM / 1000).toFixed(1)}k</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">Elevation</span>
              </div>
            </div>

            {/* Sections using iOS Grouped List Style */}
            <div className="space-y-6">
              {/* My Teams Section */}
	              <div className="space-y-3">
	                <div className="flex justify-between items-center px-2">
                  <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">My Teams</h3>
                  <span className="text-[11px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{user.isGuest ? 0 : myGroupHikes.length} Total</span>
                </div>
	                <div className="bg-white rounded-[28px] shadow-[0_10px_24px_rgba(15,23,42,0.05)] border border-white overflow-hidden divide-y divide-gray-50/70">
                  {user.isGuest ? (
                  <div className="bg-white/50 p-4 rounded-2xl border border-dashed border-gray-200 flex items-center gap-3 opacity-60">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                      <Users size={22} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-400">Demo Team</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">Preview Only</div>
                    </div>
                  </div>
                ) : myGroupHikes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No teams yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create or join a team to start planning</p>
                  </div>
                ) : (
                  myGroupHikes.map(team => {
                    const statusMeta = getTeamStatusMeta(team.status);
                    return (
                    <div 
                      key={team.id} 
                      onClick={() => openTeamDetail(team.id)}
                      className="bg-white/50 hover:bg-white/80 cursor-pointer transition p-4 rounded-2xl border border-gray-100/50 backdrop-blur-sm flex items-start gap-3 group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:shadow-md transition">
                        <Users size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 select-text">
                          <h4 className="font-bold text-gray-900 truncate select-text">{team.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3 select-text">
                          <span className="flex items-center gap-1 select-text"><Users size={12} /> {team.currentMembers}/{team.maxMembers} members</span>
                          {team.date && <span className="flex items-center gap-1 select-text"><Clock size={12} /> {new Date(team.date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {getTeamStatusCode(team.status) === 'confirmed' && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (onGotoPlanning) onGotoPlanning(team.id); 
                            }}
                            className="p-2 text-hike-green hover:bg-green-50 rounded-lg transition" 
                          >
                            <Compass size={18} />
                          </button>
                        )}
                        {onDeleteGroupHike && (
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              const confirmMsg = team.isOrganizer 
                                ? 'Are you sure you want to delete this team?'
                                : 'Are you sure you want to leave this team?';
                              
                              if (window.confirm(confirmMsg)) {
                                try {
                                  await onDeleteGroupHike(team.id, !!team.isOrganizer); 
                                } catch (err) {
                                  console.error('Failed to delete/leave team:', err);
                                  alert('Action failed.');
                                }
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" 
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })
		                )}
		              </div>
			            </div>

	              {/* Track Library Section */}
		              <div className="space-y-3">
	                <div className="flex justify-between items-end px-2">
                  <div>
                    <h3 className="text-[14px] font-black text-gray-900 tracking-tight uppercase">Track Library</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Your recorded memories</p>
                  </div>
                  <span className="text-[11px] font-black text-hike-green bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider">
                    {user.isGuest ? 0 : myTracks.length} Saved
                  </span>
                </div>
                
	                <div className="bg-white rounded-[28px] shadow-[0_10px_24px_rgba(15,23,42,0.05)] border border-white overflow-hidden">
                {user.isGuest ? (
                  <div className="p-6 flex items-center gap-4 opacity-50">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-50">
                      <Map size={24} />
                    </div>
                    <div>
                      <div className="font-black text-gray-600">Demo Hike Track</div>
                      <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">Guest Preview Only</div>
                    </div>
                  </div>
                ) : myTracks.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-[20px] flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <Map className="text-gray-200" size={32} />
                    </div>
                    <p className="text-gray-400 font-bold text-sm uppercase tracking-wide">No recorded tracks</p>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Start recording your hikes to build your library</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100/50">
                  {myTracks.map(track => (
                    <div 
                      key={track.id} 
                      onClick={() => setSelectedTrack(track)}
                      className="group cursor-pointer active:bg-gray-50/50 transition-all duration-300 p-5 flex items-start gap-4"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center text-hike-green flex-shrink-0 group-hover:shadow-md transition">
                        <Map size={22} />
                      </div>
                      <div className="flex-1 min-w-0 select-text">
                        <div className="font-bold text-gray-800 text-sm truncate select-text">{track.name}</div>
                        <div className="text-xs text-gray-500 flex gap-3 mt-2 flex-wrap select-text">
                          <span className="flex items-center gap-1 select-text"><Clock size={12}/> {new Date(track.date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="flex items-center gap-1 select-text"><Activity size={12}/> {track.distance}</span>
                          <span className="flex items-center gap-1 select-text"><Map size={12}/> {track.duration}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            try {
                              await onPublishTrack(track);
                              alert('Track shared to community!');
                            } catch {
                              alert('Failed to share track. Please try again.');
                            }
                          }}
                          className="p-2 text-hike-green hover:bg-green-50 rounded-lg transition" 
                        >
                          <Share2 size={16} />
                        </button>
                        {onDeleteTrack && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm('Are you sure you want to delete this track?')) return;
                              try {
                                await onDeleteTrack(String(track.id));
                              } catch (err) {
                                console.error('Failed to delete track:', err);
                                alert('Failed to delete track. Please try again.');
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 pb-24 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl border border-white/20 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-900">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-light">✕</button>
            </div>
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-hike-green shadow-lg overflow-hidden" title="Choose avatar below">
                  <img src={profileAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-600 font-bold uppercase mb-2">System Avatars</label>
                <div className="grid grid-cols-5 gap-2">
                  {SYSTEM_AVATAR_PRESETS.map((avatar) => {
                    const selected = profileAvatarUrl === avatar.url;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setProfileAvatarUrl(avatar.url)}
                        className={`rounded-xl p-1.5 border transition ${selected ? 'border-hike-green bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        title={avatar.label}
                      >
                        <img src={avatar.url} alt={avatar.label} className="w-full h-auto rounded-lg" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">5 male + 5 female minimalist line avatars</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-bold uppercase mb-2">Display Name</label>
                <input
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  className="w-full border-b-2 border-gray-200 py-3 focus:border-hike-green outline-none"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-bold uppercase mb-2">Role</label>
                <select
                  value={profileRole}
                  onChange={e => setProfileRole(e.target.value as any)}
                  className="w-full border-b-2 border-gray-200 py-3 focus:border-hike-green outline-none bg-transparent"
                >
                  <option value="hiker">🥾 Hiker</option>
                  <option value="guardian">👨‍⚖️ Guardian</option>
                  <option value="ngo_admin">🏢 NGO Admin</option>
                  </select>
              </div>
              {!user.isGuest && (
                <div>
                  <label className="block text-xs text-gray-600 font-bold uppercase mb-2">Status</label>
                  <select
                    value={profileStatus}
                    onChange={e => setProfileStatus(e.target.value)}
                    className="w-full border-b-2 border-gray-200 py-3 focus:border-hike-green outline-none bg-transparent"
                  >
                    {STATUS_PRESETS.filter(s => s.value !== 'guest').map((statusOpt) => (
                      <option key={statusOpt.value} value={statusOpt.value}>{statusOpt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={handleUpdateProfile} className="flex-1 bg-gradient-to-r from-hike-green to-emerald-600 text-white py-3.5 rounded-2xl font-bold">Save</button>
              <button onClick={() => setShowEditProfile(false)} className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showTeamDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 pb-24 sm:p-4 animate-fade-in overflow-y-auto" onClick={() => setShowTeamDetail(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl border border-white/20 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black text-gray-900">Team Details</h3>
              <button onClick={() => setShowTeamDetail(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-light">✕</button>
            </div>

            {isLoadingTeamDetail ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-hike-green border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : teamDetail ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-gray-900">{teamDetail.name}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTeamStatusMeta(teamDetail.status).className}`}>
                      {getTeamStatusMeta(teamDetail.status).label}
                    </span>
                  </div>
                  {teamDetail.description && (
                    <p className="text-sm text-gray-600">{teamDetail.description}</p>
                  )}
                  <div className="text-xs text-gray-500 mt-2 flex gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Users size={12} /> {teamDetail.team_size}/{teamDetail.max_team_size} members</span>
                    {teamDetail.created_at && <span className="flex items-center gap-1"><Clock size={12} /> {new Date(teamDetail.created_at).toLocaleString()}</span>}
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Route Info</div>
                  <div className="font-bold text-gray-900">{teamDetail.target_route_name || 'Route not set'}</div>
                  <div className="text-xs text-gray-500 mt-1">{teamDetail.target_route_id || (teamDetail.target_route_data ? 'Snapshot available' : 'No route data')}</div>
                  {resolveSnapshotCoords(teamDetail.target_route_data).length > 0 && (
                    <div className="mt-3">
                      <div ref={teamRouteMapRef} className="h-44 rounded-xl overflow-hidden border border-gray-100" />
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Distance</div>
                          <div className="text-sm font-bold text-gray-900">{teamDetail.target_route_data?.distance || '-'}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Duration</div>
                          <div className="text-sm font-bold text-gray-900">{teamDetail.target_route_data?.duration || '-'}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Difficulty</div>
                          <div className="text-sm font-bold text-gray-900">{teamDetail.target_route_data?.difficulty ? `${teamDetail.target_route_data.difficulty}/5` : '-'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 font-black uppercase tracking-widest mb-3">Team Members & Preferences</div>
                  {Array.isArray(teamDetail.team_members) && teamDetail.team_members.length > 0 ? (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {teamDetail.team_members.map((m: any, idx: number) => {
                        const prefs = m?.user_preferences || {};
                        return (
                          <div key={`${m.user_id || idx}-${idx}`} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-sm text-gray-900">{m.user_name || 'Member'}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{m.role || 'member'}</span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.preferences_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {m.preferences_completed ? 'Done' : 'Pending'}
                                </span>
                              </div>
                            </div>
                            {m.preferences_completed && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {prefs.mood && <span className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Mood: {prefs.mood}</span>}
                                {prefs.difficulty && <span className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Diff: {prefs.difficulty}</span>}
                                {prefs.maxDistance && <span className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Max: {prefs.maxDistance}km</span>}
                                {prefs.availableTime && <span className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Time: {Math.round(Number(prefs.availableTime) / 60)}h</span>}
                              </div>
                            )}
                            {m.preferences_completed && prefs.condition && (
                              <p className="text-xs text-gray-600 mt-2">{prefs.condition}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No member info snapshot found.</div>
                  )}
                </div>

                {getTeamStatusCode(teamDetail.status) === 'planning' && (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (onGotoPlanning) onGotoPlanning(teamDetail.id);
                        setShowTeamDetail(false);
                      }}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all"
                    >
                      Confirm Route
                    </button>
                    <button
                      onClick={() => {
                        if (teamDetail.target_route_data || teamDetail.target_route_id) {
                          if (onPreviewTeamRoute) onPreviewTeamRoute(teamDetail.id);
                          setShowTeamDetail(false);
                        } else {
                          alert('Route not set yet. Please confirm a route first.');
                        }
                      }}
                      className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all"
                    >
                      Start Hike
                    </button>
                  </div>
                )}

                {getTeamStatusCode(teamDetail.status) === 'done' && (teamDetail.target_route_data || teamDetail.target_route_id) && (
                  <button
                    onClick={() => {
                      if (onPreviewTeamRoute) onPreviewTeamRoute(teamDetail.id);
                      setShowTeamDetail(false);
                    }}
                    className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all"
                  >
                    Preview Route
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">Failed to load team details.</div>
            )}
          </div>
        </div>
      )}

      {/* Track Detail Modal */}
      {selectedTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 pb-24 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-gray-900 leading-tight">{selectedTrack.name}</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{new Date(selectedTrack.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
              </div>
              <button 
                onClick={() => setSelectedTrack(null)} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              <div className="h-64 bg-gray-100 relative">
                <div ref={trackMapRef} className="absolute inset-0 z-0" />
                
                {/* 🆕 Info Button (Left Side) for consistency */}
                <button 
                  onClick={() => alert(`Track Info:\nName: ${selectedTrack.name}\nDist: ${selectedTrack.distance}\nTime: ${selectedTrack.duration}`)}
                  className="absolute top-4 left-4 z-10 p-2 bg-white/90 rounded-full shadow-lg text-hike-green border border-white/40 backdrop-blur-sm"
                >
                  <Info size={18} />
                </button>

                <div className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-hike-green shadow-lg border border-white/20">
                  RECORDED TRAJECTORY
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Distance</div>
                    <div className="text-2xl font-black text-gray-900 flex items-baseline gap-1">
                      {selectedTrack.distance.replace(/[^0-9.]/g, '')}
                      <span className="text-sm font-medium text-gray-500">km</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Time</div>
                    <div className="text-2xl font-black text-gray-900">
                      {selectedTrack.duration}
                    </div>
                  </div>
                </div>

                {getDisplayWaypoints(selectedTrack).length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-400 font-black uppercase tracking-widest mb-3">Waypoints Captured</h4>
                      <div className="max-h-80 overflow-y-auto">
                        {getDisplayWaypoints(selectedTrack).map((wp: any, idx: number) => (
                          <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                wp.type === 'photo' ? 'bg-blue-50 text-blue-500' : wp.type === 'emotion' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500'
                              }`}>
                                {wp.type === 'photo' ? '📷' : wp.type === 'emotion' ? '📝' : '📍'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-800 truncate">{wp.note || (wp.type === 'photo' ? 'Photo Spot' : wp.type === 'emotion' ? 'Emotion Note' : 'Waypoint')}</div>
                              </div>
                            </div>
                            {wp.imageUrl && (
                              <img src={wp.imageUrl} alt="Waypoint" className="w-full h-32 object-cover rounded-lg border border-gray-200 mt-2" />
                            )}
                          </div>
                        ))}
                      </div>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  {onReviewTrack && (
                    <button 
                      onClick={() => {
                        try {
                          onReviewTrack(selectedTrack);
                          setSelectedTrack(null);
                        } catch {
                          alert('Failed to open review mode. Please try again.');
                        }
                      }}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <HistoryIcon size={20} /> Review Hike on Map
                    </button>
                  )}
                  
                  <button 
                    onClick={async () => {
                      try {
                        await onPublishTrack(selectedTrack);
                        alert('Track shared to community!');
                      } catch {
                        alert('Failed to share track. Please try again.');
                      }
                    }}
                    className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={20} /> Share to Community
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
