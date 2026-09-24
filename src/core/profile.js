import { MAX_RUN_LEVEL, SHIP_UPGRADES, SKILL_UNLOCKS } from '../data/hangar.js';
import { POWERS } from '../data/upgrades.js';

const PROFILE_KEY = 'neon-rift-profile-v1';

export function createDefaultProfile() {
  return {
    version: 2,
    credits: 0,
    careerLevel: 1,
    bestLevel: 1,
    runs: 0,
    shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key }) => [key, 0])),
    superpowerUpgrades: Object.fromEntries(POWERS.map(({ key }) => [key, 0])),
    unlockedSkills: ['shield'],
  };
}

export function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile();
  const careerLevel = Math.max(1, Math.min(MAX_RUN_LEVEL, Number(profile.careerLevel) || 1));
  const unlockedSkills = new Set(Array.isArray(profile.unlockedSkills) ? profile.unlockedSkills : defaults.unlockedSkills);
  for (const skill of SKILL_UNLOCKS) if (skill.level <= careerLevel) unlockedSkills.add(skill.key);
  return {
    version: 2,
    credits: Math.max(0, Math.floor(Number(profile.credits) || 0)),
    careerLevel,
    bestLevel: Math.max(careerLevel, Math.min(MAX_RUN_LEVEL, Number(profile.bestLevel) || 1)),
    runs: Math.max(0, Math.floor(Number(profile.runs) || 0)),
    shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key, maxLevel }) => [key, Math.max(0, Math.min(maxLevel, Number(profile.shipUpgrades?.[key]) || 0))])),
    superpowerUpgrades: Object.fromEntries(POWERS.map(({ key, maxLevel }) => [key, Math.max(0, Math.min(maxLevel, Number(profile.superpowerUpgrades?.[key]) || 0))])),
    unlockedSkills: [...unlockedSkills],
  };
}

export function loadProfile() {
  try { return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch { return createDefaultProfile(); }
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized)); } catch { /* local progression is best-effort */ }
  return normalized;
}

export function upgradeCost(definition, level) {
  return Math.ceil(definition.baseCost * 1.55 ** level);
}

function buyUpgrade(profile, key, definitions, field, canBuy = () => true) {
  const next = normalizeProfile(profile);
  const definition = definitions.find(item => item.key === key);
  const level = next[field][key] ?? 0;
  if (!definition || level >= definition.maxLevel || !canBuy(next, key)) return { profile: next, ok: false };
  const cost = upgradeCost(definition, level);
  if (next.credits < cost) return { profile: next, ok: false };
  next.credits -= cost;
  next[field][key] = level + 1;
  return { profile: next, ok: true };
}

export function buyShipUpgrade(profile, key) {
  return buyUpgrade(profile, key, SHIP_UPGRADES, 'shipUpgrades');
}

export function buySuperpowerUpgrade(profile, key) {
  return buyUpgrade(profile, key, POWERS, 'superpowerUpgrades', (next, powerKey) => next.unlockedSkills.includes(powerKey));
}

export function rewardLevel(profile, level) {
  const next = normalizeProfile(profile);
  const clampedLevel = Math.max(1, Math.min(MAX_RUN_LEVEL, Number(level) || 1));
  const unlocked = [];
  for (const skill of SKILL_UNLOCKS) {
    if (skill.level === clampedLevel && !next.unlockedSkills.includes(skill.key)) {
      next.unlockedSkills.push(skill.key);
      unlocked.push(skill);
    }
  }
  const credits = clampedLevel > 1 ? 10 + clampedLevel * 3 : 0;
  next.credits += credits;
  next.careerLevel = Math.max(next.careerLevel, clampedLevel);
  next.bestLevel = Math.max(next.bestLevel, clampedLevel);
  return { profile: next, credits, unlocked };
}
