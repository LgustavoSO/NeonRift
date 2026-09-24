import { MAX_RUN_LEVEL, SHIP_UPGRADES, SKILL_UNLOCKS } from '../data/hangar.js';
import { PERMANENT_POWER_UPGRADES } from '../data/upgrades.js';

const PROFILE_KEY = 'neon-rift-profile-v1';
const integer = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
};

export function createDefaultProfile() {
  return {
    version: 2,
    credits: 0,
    careerLevel: 1,
    bestLevel: 1,
    runs: 0,
    shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key }) => [key, 0])),
    superpowerUpgrades: Object.fromEntries(PERMANENT_POWER_UPGRADES.map(({ key }) => [key, 0])),
    unlockedSkills: ['shield'],
  };
}

export function normalizeProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') profile = {};
  const defaults = createDefaultProfile();
  const careerLevel = integer(profile.careerLevel, 1, 1, MAX_RUN_LEVEL);
  const validSkills = new Set(SKILL_UNLOCKS.map(skill => skill.key));
  const unlockedSkills = new Set((Array.isArray(profile.unlockedSkills) ? profile.unlockedSkills : defaults.unlockedSkills).filter(key => validSkills.has(key)));
  for (const skill of SKILL_UNLOCKS) if (skill.level <= careerLevel) unlockedSkills.add(skill.key);
  return {
    version: 2,
    credits: integer(profile.credits),
    careerLevel,
    bestLevel: Math.max(careerLevel, integer(profile.bestLevel, 1, 1, MAX_RUN_LEVEL)),
    runs: integer(profile.runs),
    shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key, maxLevel }) => [key, integer(profile.shipUpgrades?.[key], 0, 0, maxLevel)])),
    superpowerUpgrades: Object.fromEntries(PERMANENT_POWER_UPGRADES.map(({ key, maxLevel }) => [key, integer(profile.superpowerUpgrades?.[key], 0, 0, maxLevel)])),
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
  return buyUpgrade(profile, key, PERMANENT_POWER_UPGRADES, 'superpowerUpgrades', (next, powerKey) => next.unlockedSkills.includes(powerKey));
}

export function rewardLevel(profile, level) {
  const next = normalizeProfile(profile);
  const clampedLevel = integer(level, 1, 1, MAX_RUN_LEVEL);
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
