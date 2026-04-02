import React from 'react';
export const MiniRouteMap = ({ coordinates, waypoints }: { coordinates: [number, number][], waypoints: any[] }) => {
  if (!coordinates || coordinates.length === 0) {
    return <div className="w-12 h-12 bg-gray-100 rounded-xl"></div>;
  }
  
  // lat is y, lng is x
  const xs = coordinates.map(c => c[1]);
  const ys = coordinates.map(c => c[0]);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  const padding = Math.max(width, height) * 0.2 || 0.01;
  
  const viewBox = \`\${minX - padding} \${minY - padding} \${width + padding * 2} \${height + padding * 2}\`;
  
  // y needs to be inverted for svg
  // wait, standard viewBox is min-x, min-y, width, height. But for maps, lat increases upwards, y increases downwards.
  // We'll just invert y during mapping, or use a transform.
};
