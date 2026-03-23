import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calendar, MapPin, Users, Map, Info, Flag, ChevronUp, ChevronDown } from 'lucide-react';
import { HikingEvent } from '../services/segmentRoutingService';
import { Route } from '../types';

interface EventDetailsViewProps {
  event: HikingEvent;
  onBack: () => void;
  onStartActivity: (route: Route) => void;
}

const EventDetailsView: React.FC<EventDetailsViewProps> = ({ event, onBack, onStartActivity }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const anyWindow = window as any;
    const L = anyWindow.L;
    const container = mapRef.current;
    if (!container || !L || !event.routeData) return;
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {
        // Ignore stale-instance removal errors
      }
      mapInstanceRef.current = null;
    }

    (container as any)._leaflet_id = null;
    container.innerHTML = '';

    const map = L.map(container, {
      zoomControl: false, // Move zoom control or disable it since it's full screen
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    const coords = event.routeData.full_coordinates || [];
    if (coords.length > 0) {
      const polyline = L.polyline(coords, {
        color: '#2E7D32',
        weight: 5,
        opacity: 0.8
      }).addTo(map);
      
      // Adjust padding to account for the bottom sheet
      map.fitBounds(polyline.getBounds(), { paddingBottomRight: [0, 300], paddingTopLeft: [20, 20] });

      // Ensure view is stable
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(polyline.getBounds(), { paddingBottomRight: [0, 300], paddingTopLeft: [20, 20] });
      }, 400);

      // Start/End markers
      L.marker(coords[0], {
        icon: L.divIcon({
          className: 'start-marker',
          html: `<div style="background-color: #2E7D32; color: white; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);

      L.marker(coords[coords.length - 1], {
        icon: L.divIcon({
          className: 'end-marker',
          html: `<div style="background-color: #D32F2F; color: white; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    } else {
      map.setView([22.3193, 114.1694], 11);
    }

    requestAnimationFrame(() => {
      map.invalidateSize();
    });
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    mapInstanceRef.current = map;
    return () => {
      try {
        map.remove();
      } catch {
        // Ignore stale-instance removal errors
      }
      if (mapInstanceRef.current === map) {
        mapInstanceRef.current = null;
      }
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    };
  }, [event.routeData?.id]);

  const handleStartHike = () => {
    if (event.routeData) {
      const route: Route = {
        id: event.routeData.id,
        name: event.title,
        region: event.routeData.region || 'Hong Kong',
        description: event.description || event.routeData.description || '',
        distance: `${event.routeData.total_distance}km`,
        duration: `${Math.round(event.routeData.total_duration_minutes / 60)}h`,
        difficulty: event.routeData.difficulty_level,
        startPoint: '{}',
        endPoint: '{}',
        elevationGain: event.routeData.total_elevation_gain,
        coordinates: event.routeData.full_coordinates || [],
      } as any;
      onStartActivity(route);
    } else {
      alert('This event does not have route data.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative overflow-hidden">
      {/* Top Navigation */}
      <div className="absolute top-0 w-full z-20 px-4 py-4 flex items-center justify-between pointer-events-none">
        <button onClick={onBack} className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg pointer-events-auto transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-hike-green shadow-lg border border-white/20 pointer-events-auto">
          {event.type.toUpperCase()}
        </div>
      </div>

      {/* Map or Image Background */}
      <div className="absolute inset-0 z-0">
        {event.routeData ? (
          <div key={event.id} ref={mapRef} className="w-full h-full" />
        ) : (
          <img src={event.imageUrl} className="w-full h-full object-cover" alt={event.title} />
        )}
      </div>

      {/* Bottom Sheet Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-in-out flex flex-col ${isExpanded ? 'h-[85%]' : 'h-[35%] min-h-[250px]'}`}
      >
        {/* Drag Handle */}
        <div 
          className="w-full flex justify-center pt-4 pb-2 cursor-pointer touch-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Title and Start Button Header */}
        <div className="px-6 flex justify-between items-center pb-4 border-b border-gray-100 shrink-0">
          <h1 className="text-2xl font-black text-gray-900 truncate pr-4">{event.title}</h1>
          <button
            onClick={handleStartHike}
            className="pointer-events-auto bg-hike-green text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
            title="Start Activity"
          >
            <Map size={16} />
            Start
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3 text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date & Time</div>
                <div className="font-bold text-gray-900">{event.date}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm">
                <MapPin size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meeting Point</div>
                <div className="font-bold text-gray-900">{event.location}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-500 shadow-sm">
                <Users size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Participants</div>
                <div className="font-bold text-gray-900">{event.participants} people joined</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Info size={16} /> About this Activity
              </h3>
              <p className="text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-dashed border-gray-200">
                {event.description}
              </p>
            </div>
          )}

          {/* Trail Info if available */}
          {event.routeData && (
            <div className="space-y-4 pb-8">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Flag size={16} /> Trail Preview
              </h3>
              <div className="bg-gradient-to-br from-hike-green to-emerald-700 p-6 rounded-[32px] text-white shadow-xl shadow-hike-green/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="relative z-10">
                  <div className="text-lg font-black mb-4 truncate">{event.routeData.name}</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Distance</div>
                      <div className="font-black text-lg">{event.routeData.total_distance}km</div>
                    </div>
                    <div className="text-center border-x border-white/20 px-2">
                      <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Duration</div>
                      <div className="font-black text-lg">{Math.round(event.routeData.total_duration_minutes / 60)}h</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Difficulty</div>
                      <div className="font-black text-lg">{event.routeData.difficulty_level}/5</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailsView;
