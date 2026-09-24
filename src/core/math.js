export const TAU = Math.PI * 2;
export const random = (min, max) => min + Math.random() * (max - min);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const angleTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

// Earliest contact along a projectile's path, including stationary overlaps.
export function segmentCircleEntry(x, y, endX, endY, circle, radius) {
  const dx = endX - x; const dy = endY - y;
  const ox = x - circle.x; const oy = y - circle.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (!a) return null;
  const b = ox * dx + oy * dy;
  const discriminant = b * b - a * c;
  if (b >= 0 || discriminant < 0) return null;
  const entry = (-b - Math.sqrt(discriminant)) / a;
  return entry >= 0 && entry <= 1 ? entry : null;
}

export function hexagon(context, x, y, radius, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + TAU * index / 6;
    context[index ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
}
