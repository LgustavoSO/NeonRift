const KEY = 'neon-rift-best';

export function loadBestScore() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}

export function saveBestScore(score) {
  try { localStorage.setItem(KEY, String(score)); } catch { /* storage is optional */ }
}
