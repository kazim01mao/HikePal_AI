import React, { useState, useEffect, useRef } from 'react';
import { Message, Route, Teammate, Track, Waypoint } from '../types';
import { generateHikingAdvice } from '../services/geminiService';
import { Mic, Send, Navigation, Camera, AlertCircle, Map as MapIcon, Users, Droplet, Tent, Cigarette, Info, MessageSquare, Play, Square, Save, MapPin, Thermometer, Wind, Mountain, Heart, Battery, Flame, Zap, Phone, Bell, ShieldAlert } from 'lucide-react';
// --- 📍 修改 1：引入 supabase 客户端 ---
// 请确保你之前已经在 src/utils/supabaseClient.js 创建好了这个文件
import { supabase } from '../utils/supabaseClient';

const L = (window as any).L;
// --- 📍 修改 2：添加距离计算函数 (Haversine 公式) ---
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371e3; // 地球半径，单位：米
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface CompanionViewProps {
  activeRoute: Route | null;
  onSaveTrack: (track: Track) => void;
    // --- 📍 修改 3：新增 ID 参数 ---
  userId: string;     // 当前用户的 ID
  sessionId: string;  // 当前徒步活动的 ID
}

const MOCK_TEAMMATES_INIT: Teammate[] = [
  { id: 't1', name: 'Alice', lat: 22.228, lng: 114.242, status: 'active', avatar: 'https://picsum.photos/40/40?random=1' },
  { id: 't2', name: 'Bob', lat: 22.227, lng: 114.2415, status: 'active', avatar: 'https://picsum.photos/40/40?random=2' },
];

const USER_START_POS: [number, number] = [22.2285, 114.2425];

const CompanionView: React.FC<CompanionViewProps> = ({ activeRoute, onSaveTrack, userId, sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: 'Hello! HikePal AI here. I see you are near the peak. I am tracking your location. How can I assist?', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mode, setMode] = useState<'map' | 'chat'>('map'); 
  const [chatType, setChatType] = useState<'ai' | 'team'>('ai');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [trackName, setTrackName] = useState(activeRoute?.name || 'My Hike');
  const [showSOS, setShowSOS] = useState(false);
  // --- 📍 修改 5：新增状态 ---
  const [riskZones, setRiskZones] = useState<any[]>([]); // 存风险点
  const lastUploadRef = useRef<number>(0); // 记录上次上传时间，防止刷屏

  // Risk Shield State
  const [deviceConnected, setDeviceConnected] = useState(true);
  const [riskStats, setRiskStats] = useState({
      temp: 24,
      humidity: 78,
      altitude: 284,
      heartRate: 110,
      battery: 85,
      calories: 320
  });

  // Tracking State
  const [userPos, setUserPos] = useState<[number, number]>(USER_START_POS);
  const [teammates, setTeammates] = useState<Teammate[]>(MOCK_TEAMMATES_INIT);
  const [recordedPath, setRecordedPath] = useState<[number, number][]>([USER_START_POS]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teammateMarkersRef = useRef<{ [id: string]: any }>({});
  const polylineRef = useRef<any>(null);
  const recordedPolylineRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // --- Real-time Simulation & Recording Logic ---
  // --- 📍 修改 6：核心逻辑 - 加载风险点 ---
  useEffect(() => {
    const fetchRiskZones = async () => {
      // 从 Supabase 获取风险点
      const { data } = await supabase.from('risk_zones').select('*');
      if (data) setRiskZones(data);
    };
    fetchRiskZones();
  }, []);

  // --- 📍 修改 7：核心逻辑 - 真实 GPS 追踪 & 电子围栏 & 上传 ---
  useEffect(() => {
    if (!isRecording) return; // 如果没按开始键，就不追踪

    // 开启 GPS 监听
    const geoId = navigator.geolocation.watchPosition(
      async (position) => {
        // 1. 获取真实坐标
        const { latitude, longitude } = position.coords;
        const newPos: [number, number] = [latitude, longitude];

        // 2. 更新地图显示 (React State)
        setUserPos(newPos);
        setRecordedPath(prev => [...prev, newPos]);

        // 3. 🛡️ 电子围栏检测 (每收到一个坐标就算一次)
        if (riskZones.length > 0) {
            riskZones.forEach(zone => {
                const dist = getDistanceFromLatLonInM(latitude, longitude, zone.latitude, zone.longitude);
                // 如果距离小于设定半径 (例如 50米)
                if (dist < (zone.radius || 50)) {
                    // 触发红色警告
                    alert(`⚠️ 进入风险区域：${zone.type}！\n${zone.message}`);
                    // 你也可以在这里调用 setShowSOS(true) 自动弹窗
                }
            });
        }

        // 4. ☁️ 上传到 Supabase (每 10 秒传一次)
        const now = Date.now();
        if (now - lastUploadRef.current > 10000) { 
           lastUploadRef.current = now;
           
           console.log("正在上传位置...", latitude, longitude);
           await supabase.from('locations').insert({
             session_id: sessionId, 
             user_id: userId,       
             latitude: latitude,
             longitude: longitude
           });
        }
      },
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true } // 要求高精度 GPS
    );

    // 清理函数：组件卸载或停止录制时，关闭 GPS
    return () => navigator.geolocation.clearWatch(geoId);
  }, [isRecording, riskZones, sessionId, userId]);

  // --- 📍 修改 8：核心逻辑 - 实时看队友 ---
  useEffect(() => {
      // 订阅数据库变化
      const channel = supabase
        .channel('teammate-tracker')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'locations', filter: `session_id=eq.${sessionId}` },
            (payload) => {
                const newLoc = payload.new;
                // 如果是自己传的数据，不管它
                if (newLoc.user_id === userId) return;

                // 更新队友位置状态
                setTeammates(prev => {
                    // 如果队友已在列表中，更新坐标
                    const exists = prev.find(t => t.id === newLoc.user_id);
                    if (exists) {
                        return prev.map(t => t.id === newLoc.user_id ? { ...t, lat: newLoc.latitude, lng: newLoc.longitude } : t);
                    }
                    // 如果是新队友，加进来 (这里名字暂时写死，以后可以查表)
                    return [...prev, {
                        id: newLoc.user_id,
                        name: 'New Teammate',
                        lat: newLoc.latitude,
                        lng: newLoc.longitude,
                        status: 'active',
                        avatar: 'https://picsum.photos/40/40'
                    }];
                });
            }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [sessionId, userId]);

  useEffect(() => {
    // Simulate User & Teammate Movement every 1s
    const interval = setInterval(() => {
        // 1. Move User randomly slightly
        if (isRecording) {
            setUserPos(prev => {
                const newLat = prev[0] + (Math.random() - 0.3) * 0.0001; // Bias slightly north
                const newLng = prev[1] + (Math.random() - 0.4) * 0.0001;
                const newPos: [number, number] = [newLat, newLng];
                setRecordedPath(path => [...path, newPos]);
                return newPos;
            });
        }

        // 2. Move Teammates (even if not recording, they move)
        setTeammates(prev => prev.map(t => ({
            ...t,
            lat: t.lat + (Math.random() - 0.5) * 0.00015,
            lng: t.lng + (Math.random() - 0.5) * 0.00015
        })));

    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // --- Map Effect ---
  useEffect(() => {
    if (!mapContainerRef.current || !L) return;
    if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView(USER_START_POS, 15);

        // Revert to CartoDB Light for a cleaner look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        // Active Route Line (Static reference)
        L.polyline([
          [22.2195, 114.2405], [22.2220, 114.2410], [22.2250, 114.2425],
          [22.2285, 114.2425], [22.2350, 114.2440], [22.2400, 114.2430]
        ], { color: '#BDBDBD', weight: 4, dashArray: '5, 10' }).addTo(map);

        // Recorded Path Line (Dynamic)
        recordedPolylineRef.current = L.polyline([], { color: '#2E7D32', weight: 5 }).addTo(map);

        // User Marker
        const userIcon = L.divIcon({
            className: 'custom-user-marker',
            html: `<div style="background-color: #2563EB; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14]
        });
        userMarkerRef.current = L.marker(USER_START_POS, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

        mapInstanceRef.current = map;
    }

    // Update User Marker
    if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userPos);
        if (mode === 'map' && isRecording) {
            mapInstanceRef.current.panTo(userPos);
        }
    }

    // Update Recorded Polyline
    if (recordedPolylineRef.current) {
        recordedPolylineRef.current.setLatLngs(recordedPath);
    }

    // Update Teammates
    teammates.forEach(t => {
        let marker = teammateMarkersRef.current[t.id];
        if (!marker) {
            const teamIcon = L.divIcon({
                className: 'custom-team-marker',
                html: `<div style="background-color: #FF6F00; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            marker = L.marker([t.lat, t.lng], { icon: teamIcon }).addTo(mapInstanceRef.current).bindPopup(t.name);
            teammateMarkersRef.current[t.id] = marker;
        } else {
            marker.setLatLng([t.lat, t.lng]);
        }
    });

  }, [userPos, teammates, recordedPath, waypoints, isRecording, mode]);


  // Handle adding markers dynamically
  const addMapMarker = (type: 'photo' | 'marker') => {
      if (!mapInstanceRef.current) return;
      
      const newWaypoint: Waypoint = {
          id: Date.now().toString(),
          lat: userPos[0],
          lng: userPos[1],
          type: type,
          note: type === 'photo' ? 'Photo taken here' : 'Marked location'
      };

      setWaypoints(prev => [...prev, newWaypoint]);

      const iconHtml = type === 'photo' 
          ? `<div class="bg-blue-500 text-white p-1.5 rounded-lg shadow-lg"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`
          : `<div class="bg-red-500 text-white p-1 rounded-full shadow-lg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;

      const icon = L.divIcon({
          className: 'custom-wp-marker',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
      });

      L.marker(userPos, { icon }).addTo(mapInstanceRef.current).bindPopup(newWaypoint.note || '');
  };


  const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinishRecording = () => {
      setIsRecording(false);
      setShowSaveDialog(true);
  };

  const confirmSave = () => {
      const newTrack: Track = {
          id: Date.now().toString(),
          name: trackName,
          date: new Date(),
          duration: formatTime(elapsedTime),
          distance: (recordedPath.length * 0.005).toFixed(2) + ' km', // Mock calculation
          coordinates: recordedPath,
          waypoints: waypoints
      };
      onSaveTrack(newTrack);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');

    if (chatType === 'team') {
        setTimeout(() => {
            const teamMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'teammate',
                senderName: 'Alice',
                text: "We are taking a break at the pavilion.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, teamMsg]);
        }, 1500);
    } else {
        try {
            const context = {
                location: `Lat: ${userPos[0].toFixed(4)}, Lng: ${userPos[1].toFixed(4)}`,
                route: activeRoute?.name || 'Dragon\'s Back',
                teammates: teammates.map(t => t.name)
            };
            const loadingId = 'loading-' + Date.now();
            setMessages(prev => [...prev, { id: loadingId, sender: 'ai', text: 'Thinking...', timestamp: new Date() }]);
            const responseText = await generateHikingAdvice(newUserMsg.text, context);
            setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: responseText,
                timestamp: new Date()
            }));
        } catch (error) { console.error(error); }
    }
  };

  const handleSOS = () => {
      setShowSOS(true);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      {/* SOS Overlay */}
      {showSOS && (
          <div className="absolute inset-0 z-[2000] bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in">
            <ShieldAlert size={64} className="mb-4 animate-bounce" />
            <h2 className="text-4xl font-black mb-2 tracking-tighter">SOS ACTIVE</h2>
            <p className="mb-6 opacity-90">Emergency Mode Engaged</p>
            
            <div className="bg-white/20 p-6 rounded-2xl w-full mb-6 border border-white/30 backdrop-blur-md">
                <div className="text-xs uppercase opacity-70 mb-1 font-bold">Your Current Location</div>
                <div className="font-mono text-3xl font-bold tracking-widest flex flex-col items-center justify-center">
                    <span>{userPos[0].toFixed(5)} N</span>
                    <span>{userPos[1].toFixed(5)} E</span>
                </div>
                <div className="text-sm mt-3 flex items-center justify-center gap-1 opacity-80 border-t border-white/20 pt-2">
                    <MapPin size={14} /> Altitude: {riskStats.altitude}m
                </div>
            </div>

            <div className="w-full space-y-3">
                <a href="tel:999" className="block w-full bg-white text-red-600 py-4 rounded-xl font-bold text-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Phone size={24} /> Call Emergency (999)
                </a>
                <button 
                    onClick={() => {
                        const sosMsg: Message = {
                            id: Date.now().toString(),
                            sender: 'user',
                            text: `🚨 SOS! Emergency at ${userPos[0].toFixed(5)}, ${userPos[1].toFixed(5)}. Altitude: ${riskStats.altitude}m.`,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, sosMsg]);
                        alert("Emergency alert sent to teammates and emergency contacts!");
                        setChatType('team'); // Switch to team chat to see context
                        setMode('chat'); // Switch to chat mode
                        setShowSOS(false);
                    }}
                    className="block w-full bg-black/40 hover:bg-black/50 text-white py-4 rounded-xl font-bold text-lg border border-white/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                     <Bell size={20} /> Notify Teammates
                </button>
                <button 
                    onClick={() => setShowSOS(false)} 
                    className="block w-full py-4 text-white/80 font-bold text-sm mt-4"
                >
                    Cancel Alert
                </button>
            </div>
          </div>
      )}

      {/* Save Dialog Overlay */}
      {showSaveDialog && (
          <div className="absolute inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Save Hike</h3>
                  <div className="mb-4">
                      <label className="text-xs text-gray-500 font-bold uppercase">Track Name</label>
                      <input 
                        value={trackName} 
                        onChange={e => setTrackName(e.target.value)}
                        className="w-full border-b-2 border-hike-green py-2 text-lg focus:outline-none"
                      />
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 mb-6">
                      <div className="flex-1 bg-gray-50 p-2 rounded">
                          <div className="text-xs">Duration</div>
                          <div className="font-mono font-bold">{formatTime(elapsedTime)}</div>
                      </div>
                      <div className="flex-1 bg-gray-50 p-2 rounded">
                          <div className="text-xs">Points</div>
                          <div className="font-mono font-bold">{waypoints.length}</div>
                      </div>
                  </div>
                  <button onClick={confirmSave} className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg">
                      Save to Library
                  </button>
                  <button onClick={() => setShowSaveDialog(false)} className="w-full mt-3 text-gray-500 py-2 text-sm">
                      Discard
                  </button>
              </div>
          </div>
      )}

      {/* Map Area */}
      <div className={`relative transition-all duration-300 ${mode === 'map' ? 'h-[75%]' : 'h-[40%]'}`}>
        <div ref={mapContainerRef} className="absolute inset-0 bg-gray-200 z-0" />
        
        {/* Risk Shield Dashboard */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] flex flex-col items-center">
            <div className={`bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-2 transition-all duration-300 ${deviceConnected ? 'w-[90vw] max-w-xs' : 'w-auto'}`}>
                <div className="flex items-center justify-around gap-2 text-xs font-bold text-gray-700">
                    <div className="flex flex-col items-center">
                        <Thermometer size={14} className="text-orange-500 mb-0.5" />
                        <span>{riskStats.temp}°C</span>
                    </div>
                     <div className="flex flex-col items-center">
                        <Wind size={14} className="text-blue-500 mb-0.5" />
                        <span>{riskStats.humidity}%</span>
                    </div>
                     <div className="flex flex-col items-center">
                        <Mountain size={14} className="text-gray-600 mb-0.5" />
                        <span>{riskStats.altitude}m</span>
                    </div>
                    {/* Device Toggle */}
                    <button 
                        onClick={() => setDeviceConnected(!deviceConnected)}
                        className={`p-1 rounded bg-gray-100 ${deviceConnected ? 'text-hike-green' : 'text-gray-400'}`}
                    >
                        <Zap size={14} fill={deviceConnected ? "currentColor" : "none"} />
                    </button>
                </div>

                {/* Extended Stats (Device) */}
                {deviceConnected && (
                    <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 animate-fade-in">
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-red-500">
                                <Heart size={12} fill="currentColor" className="animate-pulse" />
                                <span className="font-bold text-sm">{riskStats.heartRate}</span>
                             </div>
                             <span className="text-[9px] text-gray-400">BPM</span>
                        </div>
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-green-600">
                                <Battery size={12} />
                                <span className="font-bold text-sm">{riskStats.battery}%</span>
                             </div>
                             <span className="text-[9px] text-gray-400">Device</span>
                        </div>
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-orange-600">
                                <Flame size={12} />
                                <span className="font-bold text-sm">{Math.floor(riskStats.calories)}</span>
                             </div>
                             <span className="text-[9px] text-gray-400">Kcal</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Recording Status (Moved below risk shield) */}
        {isRecording && (
            <div className="absolute top-24 left-4 z-[400]">
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow animate-pulse flex items-center gap-1">
                   <div className="w-2 h-2 bg-white rounded-full"></div> REC {formatTime(elapsedTime)}
                </div>
            </div>
        )}

        {/* Map Controls */}
        <div className="absolute top-20 right-4 z-[400] flex flex-col gap-2">
            {/* SOS Button - Positioned prominently */}
            <button 
                onClick={handleSOS}
                className="bg-red-600 text-white p-3 rounded-full shadow-lg font-bold flex items-center justify-center animate-pulse active:scale-95 transition-transform border-2 border-white"
            >
                <span className="font-black text-[10px] leading-tight">SOS</span>
            </button>
        </div>

        <div className="absolute bottom-10 right-4 z-[400] flex flex-col gap-2">
             {/* Record Toggle */}
            <button 
                onClick={() => isRecording ? handleFinishRecording() : setIsRecording(true)}
                className={`p-3 rounded-full shadow-lg text-white font-bold transition-all active:scale-95 ${isRecording ? 'bg-red-500' : 'bg-hike-green'}`}
            >
                {isRecording ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            {/* Tools */}
            {isRecording && (
                <>
                <button onClick={() => addMapMarker('marker')} className="bg-white/90 p-2.5 rounded-full shadow text-gray-700 hover:bg-white active:scale-95">
                    <MapPin size={20} className="text-red-500" />
                </button>
                <button onClick={() => addMapMarker('photo')} className="bg-white/90 p-2.5 rounded-full shadow text-gray-700 hover:bg-white active:scale-95">
                    <Camera size={20} className="text-blue-500" />
                </button>
                </>
            )}
        </div>
        
        {/* Resize Handle */}
        <div 
          onClick={() => setMode(mode === 'map' ? 'chat' : 'map')}
          className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl flex items-center justify-center cursor-pointer shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[401]"
        >
           <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white flex flex-col pb-20 overflow-hidden">
         <div className="flex border-b border-gray-100 shrink-0">
            <button 
               onClick={() => setChatType('ai')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${chatType === 'ai' ? 'text-hike-green border-b-2 border-hike-green' : 'text-gray-400'}`}
            >
               <div className="bg-green-100 p-1 rounded text-hike-green"><MessageSquare size={14}/></div>
               AI Guide
            </button>
            <button 
               onClick={() => setChatType('team')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${chatType === 'team' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
            >
               <div className="bg-blue-100 p-1 rounded text-blue-600"><Users size={14}/></div>
               Team (2)
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
             {/* Chat messages ... same as before */}
             {chatType === 'ai' && messages.length < 2 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {/* Reusing prompt buttons logic inline for brevity */}
                    <button onClick={() => { setInputText("Where is water?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Droplet size={18} className="text-blue-500 mb-1"/><span className="text-[10px]">Water</span></button>
                    <button onClick={() => { setInputText("Rest points?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Tent size={18} className="text-green-500 mb-1"/><span className="text-[10px]">Rest</span></button>
                    <button onClick={() => { setInputText("Emergency exit?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><AlertCircle size={18} className="text-red-500 mb-1"/><span className="text-[10px]">Help</span></button>
                    <button onClick={() => { setInputText("Toilet?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Info size={18} className="text-gray-500 mb-1"/><span className="text-[10px]">Info</span></button>
                </div>
             )}
             <div className="space-y-4">
                {messages.filter(m => chatType === 'ai' ? m.sender !== 'teammate' : m.sender !== 'ai').map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender !== 'user' && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 shrink-0 ${msg.sender === 'ai' ? 'bg-hike-green text-white' : 'bg-orange-500 text-white'}`}>
                                {msg.sender === 'ai' ? <MapIcon size={14} /> : msg.senderName?.[0]}
                            </div>
                        )}
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                            msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
         </div>

         <div className="p-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full px-2">
               <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setMode('chat')}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={chatType === 'ai' ? "Ask AI..." : "Message team..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2"
               />
               <button onClick={handleSendMessage} className="p-2 bg-hike-green text-white rounded-full shadow-sm">
                  <Send size={16} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CompanionView;