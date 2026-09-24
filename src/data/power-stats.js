// Recharge starts after protection ends, guaranteeing a vulnerable window.
export function shieldStats(rank, manual = false) {
  return manual
    ? { duration: 1.8 + rank * .45, cooldown: Math.max(5.5, 15 - rank * 1.4) }
    : { duration: 2.4 + rank * .8, cooldown: Math.max(7, 16 - rank * 2) };
}

export function advanceShield(state, timeKey, cooldownKey, delta) {
  const unprotectedTime = Math.max(0, delta - state[timeKey]);
  state[timeKey] = Math.max(0, state[timeKey] - delta);
  state[cooldownKey] = Math.max(0, state[cooldownKey] - unprotectedTime);
}
