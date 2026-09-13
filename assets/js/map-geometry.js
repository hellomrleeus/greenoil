// Display-only simplification. Never use this geometry for geographic filtering.
const cache = new WeakMap();
export function displayGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return geometry;
  if (cache.has(geometry)) return cache.get(geometry);
  const simplify = ring => {
    if (ring.length < 5) return ring;
    const keep = new Set([0, ring.length - 1]);
    const stack = [[0, ring.length - 1]];
    // About two metres in latitude; below a pixel at typical city zooms.
    const toleranceSquared = 0.00002 ** 2;
    while (stack.length) {
      const [start, end] = stack.pop();
      const [ax, ay] = ring[start], [bx, by] = ring[end];
      const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
      let maximum = toleranceSquared, index = -1;
      for (let i = start + 1; i < end; i++) {
        const [x, y] = ring[i];
        const t = length ? Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/length)) : 0;
        const distance = (x-ax-t*dx)**2 + (y-ay-t*dy)**2;
        if (distance > maximum) { maximum = distance; index = i; }
      }
      if (index !== -1) { keep.add(index); stack.push([start,index], [index,end]); }
    }
    const result = [...keep].sort((a,b) => a-b).map(i => ring[i]);
    return result.length >= 4 ? result : ring;
  };
  const coordinates = geometry.type === 'Polygon' ? geometry.coordinates.map(simplify) :
    geometry.coordinates.map(polygon => polygon.map(simplify));
  const result = {...geometry, coordinates};
  cache.set(geometry, result);
  return result;
}
