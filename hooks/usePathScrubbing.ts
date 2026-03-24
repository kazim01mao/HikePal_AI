import { useCallback } from 'react';
import * as turf from '@turf/turf';
import { RouteData, Location } from '../store/hikeStore';

export const usePathScrubbing = () => {
  const handleScrubbing = useCallback((inputLngLat: Location, routeData: RouteData | null): Location => {
    if (!routeData) {
      return inputLngLat;
    }

    try {
      const pt = turf.point([inputLngLat.lng, inputLngLat.lat]);
      let lines: any[] = [];

      if (routeData.type === 'FeatureCollection') {
        routeData.features.forEach((feature) => {
          if (feature.geometry.type === 'LineString') {
            lines.push(turf.lineString(feature.geometry.coordinates as number[][]));
          } else if (feature.geometry.type === 'MultiLineString') {
            (feature.geometry.coordinates as unknown as number[][][]).forEach((lineCoords) => {
              lines.push(turf.lineString(lineCoords));
            });
          }
        });
      } else if (routeData.type === 'Feature') {
        if (routeData.geometry.type === 'LineString') {
          lines.push(turf.lineString(routeData.geometry.coordinates as number[][]));
        } else if (routeData.geometry.type === 'MultiLineString') {
          (routeData.geometry.coordinates as unknown as number[][][]).forEach((lineCoords) => {
            lines.push(turf.lineString(lineCoords));
          });
        }
      }

      if (lines.length === 0) {
        return inputLngLat;
      }

      let closestPoint: any = null;
      let minDistance = Infinity;

      for (const line of lines) {
        const snapped = turf.nearestPointOnLine(line, pt);
        const dist = turf.distance(pt, snapped);
        if (dist < minDistance) {
          minDistance = dist;
          closestPoint = snapped;
        }
      }

      if (closestPoint) {
        const [lng, lat] = closestPoint.geometry.coordinates;
        return { lng, lat };
      }
    } catch (e) {
      console.error('Error during path snapping:', e);
    }

    return inputLngLat;
  }, []);

  return { handleScrubbing };
};
