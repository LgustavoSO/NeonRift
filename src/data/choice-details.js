import { POWERS } from './upgrades.js';
import { MAX_COMPANION_LEVEL, MAX_RUN_POWER_LEVEL } from './hangar.js';

const format = (value, digits = 1) => Number(value.toFixed(digits)).toLocaleString('pt-BR', { maximumFractionDigits: digits });
const points = value => `${format(value * 100)} p.p.`;

export function powerLevelsAdded(power, state) {
  const current = state.powers[power.key] ?? 0;
  const requested = 1 + (state.powerBonuses?.[power.key] ?? 0);
  const cap = powerRunMaxLevel(power, state);
  return Math.max(0, cap == null ? requested : Math.min(requested, cap - current));
}

export function powerRunMaxLevel(power, state) {
  if (power.runMaxLevel == null) return null;
  const permanentLevels = state.powerBonuses?.[power.key] ?? 0;
  return Math.min(MAX_RUN_POWER_LEVEL, power.runMaxLevel + permanentLevels);
}

export function getChoiceProgress(choice, state) {
  if (choice.targetId != null) {
    const companion = state.companions.find(item => item.id === choice.targetId);
    const current = companion?.level ?? 0;
    const next = Math.min(MAX_COMPANION_LEVEL, current + (choice.companionGainLevels ?? 1));
    return { current, next, max: MAX_COMPANION_LEVEL, label: 'ALIADO' };
  }
  if (choice.modelId) return { current: null, next: Math.min(MAX_COMPANION_LEVEL, choice.companionGainLevels ?? 1), max: MAX_COMPANION_LEVEL, label: 'NOVO ALIADO' };

  const current = choice.apply ? state.upgradeLevels[choice.key] ?? 0 : state.powers[choice.key] ?? 0;
  const power = POWERS.find(item => item.key === choice.key);
  const increase = choice.apply ? 1 : power ? powerLevelsAdded(power, state) : 1;
  return { current, next: current + increase, max: choice.apply ? choice.maxLevel : power ? powerRunMaxLevel(power, state) : null, label: 'HABILIDADE' };
}

export function getChoiceNextEffect(choice, state) {
  if (choice.targetId != null) {
    const companion = state.companions.find(item => item.id === choice.targetId);
    const currentLevel = companion?.level ?? 1;
    const nextLevel = Math.min(MAX_COMPANION_LEVEL, currentLevel + (choice.companionGainLevels ?? 1));
    const increase = nextLevel - currentLevel;
    const currentDamage = Math.min(.9, .42 + Math.max(0, currentLevel - 1) * .09);
    const nextDamage = Math.min(.9, .42 + Math.max(0, nextLevel - 1) * .09);
    const interception = companion && currentLevel < companion.interceptLevel && nextLevel >= companion.interceptLevel && companion.interceptLevel < 99
      ? ' Desbloqueia a interceptação de projéteis.'
      : '';
    return `+${points(nextDamage - currentDamage)} do dano da nave por tiro, +${format((1 / (.86 ** increase) - 1) * 100)}% de cadência e +${format((1.05 ** increase - 1) * 100)}% de bônus de dano para este aliado.${interception}`;
  }
  if (choice.modelId) return `Recruta no nível ${Math.min(MAX_COMPANION_LEVEL, choice.companionGainLevels ?? 1)} de ${MAX_COMPANION_LEVEL}. ${choice.description}`;

  const player = state.player;
  const level = choice.apply ? state.upgradeLevels[choice.key] ?? 0 : state.powers[choice.key] ?? 0;
  const power = POWERS.find(item => item.key === choice.key);
  const increase = choice.apply ? 1 : power ? powerLevelsAdded(power, state) : 1;
  const next = level + increase;
  if (choice.apply) {
    switch (choice.key) {
      case 'cadence': return 'Tiros cerca de 22% mais frequentes.';
      case 'damage': return '+30% de dano por tiro.';
      case 'move': return '+16% de velocidade de movimento.';
      case 'hull': return '+30 de casco máximo.';
      case 'shots': return '+1 projétil por rajada.';
      case 'pierce': return '+1 inimigo atravessado por projétil.';
      case 'magnet': return '+80 px de alcance para coletar XP.';
      case 'slow': return `+${points(Math.min(.65, player.slow + .22) - player.slow)} de lentidão aplicada pelos tiros (limite 65%).`;
      case 'critical': return `+${points(Math.min(.6, player.crit + .12) - player.crit)} de chance crítica (limite 60%).`;
      case 'dash': {
        const nextCooldown = Math.max(1.25, player.dashCooldown * .82);
        return `Recarga do impulso: ${format(player.dashCooldown)}s → ${format(nextCooldown)}s.`;
      }
      case 'armor': return `+${points(Math.min(.35, player.armor + .07) - player.armor)} de redução de dano (limite 35%).`;
      case 'projectile': return '+18% de velocidade dos projéteis.';
      case 'ricochet': return `+1 perfuração e +${points(Math.min(.6, player.crit + .04) - player.crit)} de chance crítica.`;
      case 'firewheel': {
        const before = state.firewheelLevel ?? 0;
        return `Anel: raio +15 px, dano +${format(.22)}× e intervalo ${format(Math.max(.65, 1.65 - before * .2))}s → ${format(Math.max(.65, 1.65 - (before + 1) * .2))}s.`;
      }
      default: return choice.description;
    }
  }

  switch (choice.key) {
    case 'companion': return `Adiciona um aliado no nível ${increase} ou avança ${increase} nível(is) no drone escolhido; cada nível melhora dano e cadência.`;
    case 'shield': return `Escudo: duração ${format(2.4 + level * .8)}s → ${format(2.4 + next * .8)}s; recarga ${format(Math.max(7, 16 - level * 2))}s → ${format(Math.max(7, 16 - next * 2))}s; cadência −${format((1 - 1 / (1 + .05 * increase)) * 100)}%.`;
    case 'charged': return `Tiro carregado: +${format(increase)}× dano base; recarga ${format(Math.max(2.8, 7 - level * .7))}s → ${format(Math.max(2.8, 7 - next * .7))}s.`;
    case 'nova': return `Pulso: raio +${25 * increase} px e +${increase}× dano; custa ${5 * increase} de vida máxima.`;
    case 'aimbot': return `+${Math.min(MAX_RUN_POWER_LEVEL, next) - Math.min(MAX_RUN_POWER_LEVEL, level)} tiro(s) reto(s) de apoio (até ${MAX_RUN_POWER_LEVEL}); cadência −${format((1 - 1 / (1 + .04 * increase)) * 100)}%.`;
    case 'overdrive': return `+${format((1.12 ** increase - 1) * 100)}% de dano e +${format((1 / (.86 ** increase) - 1) * 100)}% de cadência; velocidade −${points(1 - .97 ** increase)}.`;
    case 'singularity': return `Raio +${24 * increase} px, dano +${format(.2 * increase)}× e −${3 * increase} de vida máxima.`;
    case 'ionStorm': return `+${Math.min(MAX_RUN_POWER_LEVEL, next + 2) - Math.min(MAX_RUN_POWER_LEVEL, level + 2)} alvo(s), +${format(.28 * increase)}× dano; blindagem −${points(.02 * increase)}.`;
    case 'activeShield': return `Barreira: duração +${format(.45 * increase)}s; recarga ${format(Math.max(5.5, 15 - level * 1.4))}s → ${format(Math.max(5.5, 15 - next * 1.4))}s.`;
    case 'teleport': return `Salto: alcance +${24 * increase} px; recarga ${format(Math.max(4, 9 - level * .8))}s → ${format(Math.max(4, 9 - next * .8))}s.`;
    case 'minefield': return `Minas: dano +${format(.5 * increase)}×; intervalo ${format(Math.max(2.2, 5.4 - level * .55))}s → ${format(Math.max(2.2, 5.4 - next * .55))}s.`;
    case 'riftLance': return `Lança: +${Math.min(MAX_RUN_POWER_LEVEL, next + 1) - Math.min(MAX_RUN_POWER_LEVEL, level + 1)} alvo(s), +${format(.55 * increase)}× dano; intervalo −${format(.45 * increase)}s.`;
    default: return choice.description;
  }
}
