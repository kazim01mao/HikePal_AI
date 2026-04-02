export enum Tab {
  PLANNING = 'PLANNING',
  COMPANION = 'COMPANION',
  HOME = 'HOME'
}

export enum AuthMode {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'hiker' | 'guide' | 'admin';
  isGuest?: boolean;
}

export interface Route {
  id: string;
  name: string;
  region: string;
  distance: string;
  duration: string;
  difficulty: number; // 1-5
  description: string;
  startPoint: string;
  endPoint: string;
  elevationGain: number;
  imageUrl?: string;
  isUserPublished?: boolean; // To highlight user uploads
  coordinates?: [number, number][]; // Full route path
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  type: 'photo' | 'marker' | 'emotion' | 'reminder';
  emoji?: string;
  note?: string;
  imageUrl?: string;
  uploadedRouteImageId?: string; // New field to link waypoints to uploaded_route_images
}

export interface Track {
  id: string;
  name: string;
  date: Date;
  duration: string;
  distance: string;
  difficulty: number;
  coordinates: [number, number][];
  waypoints: Waypoint[];
  routeId?: string | null;
  routeName?: string | null;
  routeShape?: [number, number][];
  relatedReminders?: Array<{
    id: string | number;
    name?: string;
    type?: string;
    category?: string;
    ai_prompt?: string;
    coordinates?: [number, number];
  }>;
  aiGenerated?: boolean;
  aiUserMood?: string | null;
  aiUserDifficulty?: string | null;
  aiUserCondition?: string | null;
  aiMatchedRoutes?: Array<Record<string, any>>;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'teammate';
  senderName?: string;
  text: string;
  timestamp: Date;
}

export interface Teammate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'active' | 'inactive';
  avatar: string;
}

export interface UserStats {
  totalDistanceKm: number;
  hikesCompleted: number;
  elevationGainedM: number;
  status: string;
}

export interface HikingEvent {
  id: string;
  title: string;
  type: 'cleanup' | 'maintenance' | 'guide' | 'hike';
  date: string;
  location: string;
  participants: number;
  imageUrl: string;
}

export interface GroupHike {
  id: string;
  title: string;
  date: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  isOrganizer: boolean;
  // Optional list of member display names for UI (not required by core logic)
  members?: string[];
  // Optional planning fields for pre-hike details
  meetingPoint?: string;
  startTime?: string;
  companionCount?: number;
  status?: 'draft' | 'confirmed';
  routeId?: string; // Link to a specific route
  planned_duration?: string; // From hike_sessions
  experience_level?: 'first_time' | 'occasional' | 'advanced'; // From hike_sessions
  initial_mood?: string; // From hike_sessions
}

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

export interface ReminderInfo {
  id: string;
  route_id: string;
  type: string;
  name: string;
  description: string;
  ai_prompt: string;
  coordinates: [number, number];
}
