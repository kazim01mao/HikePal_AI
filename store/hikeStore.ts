import { create } from 'zustand';

export type HikeMode = 'idle' | 'scrubbing' | 'live';

export interface Location {
  lng: number;
  lat: number;
}

// GeoJSON types for the route
export interface Position extends Array<number> {
  0: number; // lng
  1: number; // lat
  [key: number]: number; // elevation, etc.
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: Position[];
}

export interface RouteFeature {
  type: 'Feature';
  geometry: LineStringGeometry;
  properties?: Record<string, any>;
}

export interface RouteFeatureCollection {
  type: 'FeatureCollection';
  features: RouteFeature[];
}

// Ensure routeData can be a single Feature or FeatureCollection containing LineStrings
export type RouteData = RouteFeature | RouteFeatureCollection;

interface HikeState {
  hikeMode: HikeMode;
  currentLocation: Location | null;
  routeData: RouteData | null;
  isModalOpen: boolean;

  setMode: (mode: HikeMode) => void;
  updateLocation: (location: Location | null) => void;
  setRouteData: (route: RouteData | null) => void;
  setModalOpen: (isOpen: boolean) => void;
  reset: () => void;
}

export const useHikeStore = create<HikeState>((set) => ({
  hikeMode: 'idle',
  currentLocation: null,
  routeData: null,
  isModalOpen: false,

  setMode: (mode) => set({ hikeMode: mode }),
  updateLocation: (location) => set({ currentLocation: location }),
  setRouteData: (route) => set({ routeData: route }),
  setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
  reset: () => set({ hikeMode: 'idle', currentLocation: null, routeData: null, isModalOpen: false }),
}));
