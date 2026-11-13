// Shared landmark math
export function angleDeg(a, b, c) {
  // angle at point b, in degrees
  const abx = a.x - b.x, aby = a.y - b.y, abz = (a.z || 0) - (b.z || 0);
  const cbx = c.x - b.x, cby = c.y - b.y, cbz = (c.z || 0) - (b.z || 0);
  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAB = Math.hypot(abx, aby, abz);
  const magCB = Math.hypot(cbx, cby, cbz);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 };
}
