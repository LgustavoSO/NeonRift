import { COMPANION_MODELS, MAX_EQUIPPED_COMPANIONS, SHIP_UPGRADES, SKILL_UNLOCKS } from '../data/hangar.js';

const PROFILE_KEY = 'neon-rift-profile-v1';

export function createDefaultProfile() {
  return { version: 1, credits: 0, careerLevel: 1, bestLevel: 1, runs: 0, shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key }) => [key, 0])), ownedCompanions: [], companionLevels: Object.fromEntries(COMPANION_MODELS.map(({ id }) => [id, 1])), equippedCompanions: [], unlockedSkills: ['shield'] };
}

export function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile();
  const validCompanions = new Set(COMPANION_MODELS.map(({ id }) => id));
  const ownedCompanions = [...new Set((Array.isArray(profile.ownedCompanions) ? profile.ownedCompanions : []).filter(id => validCompanions.has(id)))];
  const equippedCompanions = [...new Set((Array.isArray(profile.equippedCompanions) ? profile.equippedCompanions : []).filter(id => ownedCompanions.includes(id)))].slice(0, MAX_EQUIPPED_COMPANIONS);
  const careerLevel = Math.max(1, Math.min(20, Number(profile.careerLevel) || 1));
  const unlockedSkills = new Set(Array.isArray(profile.unlockedSkills) ? profile.unlockedSkills : defaults.unlockedSkills);
  for (const skill of SKILL_UNLOCKS) if (skill.level <= careerLevel) unlockedSkills.add(skill.key);
  return {
    ...defaults, ...profile, version: 1,
    credits: Math.max(0, Math.floor(Number(profile.credits) || 0)), careerLevel,
    bestLevel: Math.max(careerLevel, Math.min(20, Number(profile.bestLevel) || 1)),
    runs: Math.max(0, Math.floor(Number(profile.runs) || 0)),
    shipUpgrades: Object.fromEntries(SHIP_UPGRADES.map(({ key, maxLevel }) => [key, Math.max(0, Math.min(maxLevel, Number(profile.shipUpgrades?.[key]) || 0))])),
    companionLevels: Object.fromEntries(COMPANION_MODELS.map(({ id, maxLevel = 5 }) => [id, Math.max(1, Math.min(maxLevel, Number(profile.companionLevels?.[id]) || 1))])),
    ownedCompanions, equippedCompanions, unlockedSkills: [...unlockedSkills],
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

export function buyShipUpgrade(profile, key) {
  const next = normalizeProfile(profile);
  const definition = SHIP_UPGRADES.find(item => item.key === key);
  const level = next.shipUpgrades[key] ?? 0;
  if (!definition || level >= definition.maxLevel) return { profile: next, ok: false };
  const cost = upgradeCost(definition, level);
  if (next.credits < cost) return { profile: next, ok: false };
  next.credits -= cost;
  next.shipUpgrades[key] = level + 1;
  return { profile: next, ok: true };
}

export function buyCompanion(profile, id) {
  const next = normalizeProfile(profile);
  const companion = COMPANION_MODELS.find(item => item.id === id);
  if (!companion || next.ownedCompanions.includes(id) || next.credits < companion.cost) return { profile: next, ok: false };
  next.credits -= companion.cost;
  next.ownedCompanions.push(id);
  if (next.equippedCompanions.length < MAX_EQUIPPED_COMPANIONS) next.equippedCompanions.push(id);
  return { profile: next, ok: true };
}

export function upgradeCompanion(profile, id) {
  const next = normalizeProfile(profile);
  const companion = COMPANION_MODELS.find(item => item.id === id);
  const level = next.companionLevels[id] ?? 1;
  if (!companion || !next.ownedCompanions.includes(id) || level >= companion.maxLevel) return { profile: next, ok: false };
  const cost = Math.ceil(companion.upgradeCost * 1.55 ** (level - 1));
  if (next.credits < cost) return { profile: next, ok: false };
  next.credits -= cost;
  next.companionLevels[id] = level + 1;
  return { profile: next, ok: true };
}

export function toggleCompanion(profile, id) {
  const next = normalizeProfile(profile);
  if (!next.ownedCompanions.includes(id)) return { profile: next, ok: false };
  if (next.equippedCompanions.includes(id)) next.equippedCompanions = next.equippedCompanions.filter(item => item !== id);
  else if (next.equippedCompanions.length < MAX_EQUIPPED_COMPANIONS) next.equippedCompanions.push(id);
  else return { profile: next, ok: false };
  return { profile: next, ok: true };
}

export function rewardLevel(profile, level) {
  const next = normalizeProfile(profile);
  const clampedLevel = Math.max(1, Math.min(20, level));
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
