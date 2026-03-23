import React, { useState, useEffect, useRef } from 'react';
import { Message, Route, Teammate, Track, Waypoint, User } from '../types';
import { generateHikingAdvice } from '../services/geminiService';
import { uploadRouteToCommunity, mergeSegmentCoordinates } from '../services/segmentRoutingService';
import { Mic, Send, Navigation, Camera, AlertCircle, Map as MapIcon, Users, Droplet, Tent, Cigarette, Info, MessageSquare, Play, Square, Save, Upload, Compass, MapPin, Thermometer, Wind, Phone, Bell, ShieldAlert, ArrowLeft, Star, Activity, Clock, X, Edit3, Check, ChevronRight, History as HistoryIcon, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { DRAGONS_BACK_COORDINATES } from '../utils/trailData';

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

function normalizePoint(p: any): [number, number] | null {
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
}

function isValidPoint(p: any): p is [number, number] {
  return normalizePoint(p) !== null;
}

function sanitizeRouteCoords(raw: any): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const cleaned: [number, number][] = [];
  raw.forEach((pt) => {
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
       return [g.coordinates[1], g.coordinates[0]];
    }
  }
  // Handle Hex/EWKB Point heuristic for standard HK coordinates
  if (typeof r.coordinates === 'string' && r.coordinates.startsWith('0101')) {
     console.warn('DEBUG: Binary coordinates detected, please ensure RPC is installed.');
  }
  
  // Fallback to parseGeographyPoint for legacy JSON coordinates
  if (!r.coordinates) return null;
  if (r.coordinates.type === 'Point' && Array.isArray(r.coordinates.coordinates)) return [r.coordinates.coordinates[1], r.coordinates.coordinates[0]];
  if (typeof r.coordinates === 'string') {
    try {
      const parsed = JSON.parse(r.coordinates);
      if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) return [parsed.coordinates[1], parsed.coordinates[0]];
    } catch(e) {}
  }
  return null;
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mode, setMode] = useState<'map' | 'chat'>('map'); 
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
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [hasStartedHike, setHasStartedHike] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [actualTeamSize, setActualTeamSize] = useState<number>(1);
  const [isRefreshingTeam, setIsRefreshingTeam] = useState(false);
  const [aiHighlights, setAiHighlights] = useState<string>('');
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teammateMarkersRef = useRef<{ [id: string]: any }>({});
  const reminderMarkersRef = useRef<any[]>([]);
  const recordedPolylineRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const isReviewMode = !!(activeRoute as any)?.isReview;

  // Handle auto-trigger for reminders prompt
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
    const mockWeather = { temp: 26, humidity: 72, condition: 'Clear Sky' };
    setRiskStats(mockWeather);
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
          waypoints: waypoints
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
    if (teamId) {
      loadTeamMembers();
      const interval = setInterval(loadTeamMembers, 5000);
      return () => clearInterval(interval);
    }
  }, [teamId]);

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
    if (!isRecording || !alertsEnabled || !activeRoute || !activeRoute.coordinates || isReviewMode || !userPos) return;
    const relatedReminders = reminderInfo.filter(r => {
      const coords = getCoords(r);
      return coords && isPointNearRoute(coords[0], coords[1], activeRoute.coordinates || [], 200);
    });
    relatedReminders.forEach(item => {
      if (alertedItemsRef.current.has(item.id)) return;
      const coords = getCoords(item);
      if (coords) {
        if (getDistanceFromLatLonInM(userPos[0], userPos[1], coords[0], coords[1]) < 100) {
          setMessages(prev => [...prev, { id: `reminder-${item.id}`, sender: 'ai', text: item.ai_prompt || `Near ${item.name}`, timestamp: new Date() }]);
          alertedItemsRef.current.add(item.id);
        }
      }
    });
  }, [userPos, reminderInfo, activeRoute, isRecording, alertsEnabled, isReviewMode]);

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
    if (!isRecording || isReviewMode) return;
    
    const geoId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const newPos: [number, number] = [lat, lng];
        setUserPos(newPos);
        setRecordedPath(prev => [...prev, newPos]);
        
        // Update live polyline on map
        if (recordedPolylineRef.current) {
          recordedPolylineRef.current.addLatLng(newPos);
          if (!activeRoute) {
            mapInstanceRef.current?.panTo(newPos);
          }
        }
        
        // Sync to database so teammates can see
        if (Date.now() - lastUploadRef.current > 10000 && teamId) { 
           lastUploadRef.current = Date.now();
           // In a real app we'd update a real-time table. Updating team_members last_lat/last_lng
           await supabase.from('team_members')
             .update({ last_lat: lat, last_lng: lng })
             .eq('team_id', teamId)
             .eq('user_id', userId);
             
           // Also log to locations for history
           await supabase.from('locations').insert({ session_id: sessionId, user_id: userId, latitude: lat, longitude: lng });
        }
      },
      (err) => console.error(err), { 
         enableHighAccuracy: true,
         timeout: 10000,
         maximumAge: 5000
      }
    );
    return () => navigator.geolocation.clearWatch(geoId);
  }, [isRecording, isReviewMode, sessionId, userId, teamId, activeRoute]);

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
          const userChar = (user?.user_metadata?.name || user?.email || 'Me').charAt(0).toUpperCase();
          const userIcon = L.divIcon({ 
            html: `<div style="background-color: #2563EB; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${userChar}</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          userMarkerRef.current = L.marker(initialView, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
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
      userMarkerRef.current.setLatLng(userPos);
    }
    if (recordedPolylineRef.current && isReviewMode) { /* Review mode line is static */ }
  }, [userPos, activeRoute, isReviewMode, reminderInfo]);

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
  }, [mode]);

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
        const char = (member.user_name || 'U').charAt(0).toUpperCase();
        const icon = L.divIcon({
          html: `<div style="background-color: #EA580C; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${char}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        if (teammateMarkersRef.current[member.user_id]) {
          teammateMarkersRef.current[member.user_id].setLatLng([teammateLat, teammateLng]);
        } else {
          teammateMarkersRef.current[member.user_id] = L.marker([teammateLat, teammateLng], { icon }).addTo(map).bindPopup(member.user_name);
        }
      }
    });
  }, [teamMembers, userId, isReviewMode]);

  // --- Handlers ---
  const handleStartRecording = () => {
    setIsRecording(true);
    setHasStartedHike(true);
    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    
    // Show toast notification
    setToast({ message: 'Started recording your hike!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: cardPos.x,
      cardY: cardPos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setCardPos({
        x: dragStartRef.current.cardX + dx,
        y: dragStartRef.current.cardY + dy
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setIsNoteSubmitting(true);
    try {
      const { error } = await supabase.from('team_member_emotions').insert({
        team_id: teamId,
        user_id: userId,
        content: noteContent,
        latitude: userPos ? userPos[0] : 0,
        longitude: userPos ? userPos[1] : 0,
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      
      setMessages(prev => [...prev, {
        id: `note-${Date.now()}`,
        sender: 'user',
        text: `📍 Saved a note: "${noteContent}"`,
        timestamp: new Date()
      }]);
      
      setNoteContent('');
      setShowAddNote(false);
    } catch (e) {
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
    <div className="flex flex-col h-full bg-gray-50 relative overflow-hidden">
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
          className={`absolute ${mode === 'chat' ? 'bottom-[64%]' : 'bottom-[35%]'} left-4 z-[500] bg-hike-green text-white px-6 py-4 rounded-[24px] shadow-2xl active:scale-95 transition-all flex items-center gap-3 border-2 border-white/30 animate-fade-in`}
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
                            waypoints: waypoints 
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
      <div className={`relative transition-all duration-300 ${mode === 'map' ? 'h-[68%]' : 'h-[38%]'}`}>
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
             <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-2xl border border-white/40 max-w-[280px]">
                <div 
                   onMouseDown={handleMouseDown}
                   className="cursor-move flex flex-col items-center mb-4 bg-gray-50/50 -m-5 p-4 rounded-t-3xl border-b border-gray-100"
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

                            const snapshotCoords = (activeRoute.coordinates && activeRoute.coordinates.length > 0)
                              ? activeRoute.coordinates
                              : mergeSegmentCoordinates((activeRoute as any).segments || []);
                            
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
                              segments: (activeRoute as any).segments || []
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
             </div>
          </div>
        )}

        {/* Side Controls */}
        {!isReviewMode && (
          <div className={`absolute right-4 z-[400] flex flex-col origin-top-right ${mode === 'chat' ? 'top-4 gap-2 scale-90' : 'top-24 gap-3'}`}>
             <button onClick={() => setShowSOS(true)} className={`bg-red-600 text-white rounded-full shadow-2xl font-black border-2 border-white/30 ${mode === 'chat' ? 'p-3 text-[10px]' : 'p-4 text-[11px]'}`}>SOS</button>
             {isLeader && <button onClick={() => setShowSaveDialog(true)} className={`bg-blue-600 text-white rounded-full shadow-lg border border-white/30 ${mode === 'chat' ? 'p-3' : 'p-3.5'}`}><Upload size={mode === 'chat' ? 18 : 20}/></button>}
             <button onClick={() => setShowAddNote(true)} className={`bg-white rounded-full shadow-lg text-orange-500 border border-white/30 ${mode === 'chat' ? 'p-3' : 'p-3.5'}`}><Star size={mode === 'chat' ? 18 : 20}/></button>
             <button
               onClick={() => {
                 if (!hasStartedHike) return;
                 setIsRecording(false);
                 setShowSaveDialog(true);
               }}
               className={`${mode === 'chat' ? 'p-3' : 'p-3.5'} rounded-full shadow-lg border border-white/30 ${hasStartedHike ? 'bg-green-600 text-white' : 'bg-green-200 text-white/70 cursor-not-allowed'}`}
               disabled={!hasStartedHike}
             >
               <Check size={mode === 'chat' ? 18 : 20}/>
             </button>
             <button onClick={() => { if(window.confirm('Quit?')) onBack && onBack(); }} className={`bg-white rounded-full shadow-lg text-gray-500 border border-white/30 ${mode === 'chat' ? 'p-3' : 'p-3.5'}`}><X size={mode === 'chat' ? 18 : 20}/></button>
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
                 </div>
                 
                 <div className="flex gap-2">
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
      <div className="flex-1 bg-white flex flex-col pb-20 overflow-hidden relative">
         {/* Drag Handle to collapse */}
         {mode === 'chat' && (
            <div 
               onClick={() => setMode('map')} 
               className="w-full h-6 flex items-center justify-center cursor-pointer bg-gray-50 border-b border-gray-200"
               title="Collapse Panel"
            >
               <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>
         )}
         <div className="flex border-b border-gray-100">
            <button onClick={() => {setChatType('ai'); setMode('chat');}} className={`flex-1 py-4 text-sm font-bold ${chatType === 'ai' ? 'text-hike-green border-b-2 border-hike-green' : 'text-gray-400'}`}>AI Guide</button>
            <button onClick={() => {setChatType('team'); setMode('chat');}} className={`flex-1 py-4 text-sm font-bold ${chatType === 'team' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
               <span className={isRefreshingTeam ? 'animate-pulse' : ''}>Team ({teamId ? actualTeamSize : (activeRoute ? 1 : 0)})</span>
            </button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 bg-gray-50 select-text">
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
                  {messages.length < 2 && (
                     <div className="grid grid-cols-4 gap-2 mb-4">
                        <button onClick={() => handleSendMessage("Where is water?")} className="flex flex-col items-center bg-white p-2 rounded-xl border shadow-sm"><Droplet size={18} className="text-blue-500 mb-1"/><span className="text-[9px]">Water</span></button>
                        <button onClick={() => handleSendMessage("Rest points?")} className="flex flex-col items-center bg-white p-2 rounded-xl border shadow-sm"><Tent size={18} className="text-green-500 mb-1"/><span className="text-[9px]">Rest</span></button>
                        <button onClick={() => handleSendMessage("Help!")} className="flex flex-col items-center bg-white p-2 rounded-xl border shadow-sm"><AlertCircle size={18} className="text-red-500 mb-1"/><span className="text-[9px]">Help</span></button>
                        <button onClick={() => handleSendMessage("Trail Info")} className="flex flex-col items-center bg-white p-2 rounded-xl border shadow-sm"><Info size={18} className="text-gray-400 mb-1"/><span className="text-[9px]">Info</span></button>
                     </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} select-text`}>
                       <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap select-text ${m.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none shadow-sm'}`}>
                         {renderMarkdown(m.text)}
                       </div>
                    </div>
                  ))}
               </div>
            )}
         </div>
         {!isReviewMode && (
           <div className="p-3 bg-white border-t flex items-center gap-2">
              <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask AI..." className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" />
              <button onClick={() => handleSendMessage()} className="p-2 bg-hike-green text-white rounded-full shadow-sm"><Send size={18} /></button>
           </div>
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
                 <button onClick={handleConfirmUpload} disabled={isUploadingRoute} className="w-full bg-hike-green text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50">{isUploadingRoute ? 'Uploading...' : 'Confirm & Share'}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CompanionView;
