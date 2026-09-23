export const TAU = Math.PI * 2;
export const random = (min, max) => min + Math.random() * (max - min);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

export function hexagon(context, x, y, radius, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + TAU * index / 6;
    context[index ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
}
