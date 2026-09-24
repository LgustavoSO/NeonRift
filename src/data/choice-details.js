import { POWERS } from './upgrades.js';
import { collectorReturnDelay, MAX_COMPANION_LEVEL, MAX_POWER_TARGETS } from './hangar.js';
import { shieldStats } from './power-stats.js';

const format = (value, digits = 1) => Number(value.toFixed(digits)).toLocaleString('pt-BR', { maximumFractionDigits: digits });
const points = value => `${format(value * 100)} p.p.`;

export function powerLevelsAdded(power, state) {
  const current = state.powers[power.key] ?? 0;
  if (power.key !== 'companion' && current > 0) return 0;
  return 1 + (state.powerBonuses?.[power.key] ?? 0);
}

export function getChoiceProgress(choice, state) {
  if (choice.targetId != null) {
    const companion = state.companions.find(item => item.id === choice.targetId);
    const current = companion?.level ?? 0;
    const next = Math.min(MAX_COMPANION_LEVEL, current + (choice.companionGainLevels ?? 1));
    return { current, next, max: MAX_COMPANION_LEVEL, label: 'ALIADO' };
  }
  if (choice.modelId) return { current: null, next: Math.min(MAX_COMPANION_LEVEL, choice.companionGainLevels ?? 1), max: MAX_COMPANION_LEVEL, label: 'NOVO ALIADO' };
  if (choice.key === 'companion') return { current: null, next: null, max: null, label: 'REFORÇO DE ESQUADRÃO' };

  const power = POWERS.find(item => item.key === choice.key);
  if (!choice.apply && power) return { current: null, next: null, max: null, label: 'ATIVAÇÃO ÚNICA' };
  const current = choice.apply ? state.upgradeLevels[choice.key] ?? 0 : state.powers[choice.key] ?? 0;
  return { current, next: current + 1, max: choice.maxLevel ?? null, label: 'HABILIDADE' };
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
    const collection = companion?.collects
      ? ` Retorna para entregar ${format(collectorReturnDelay(currentLevel))}s → ${format(collectorReturnDelay(nextLevel))}s após o primeiro fragmento.`
      : '';
    return `+${points(nextDamage - currentDamage)} do dano da nave por tiro, +${format((1 / (.86 ** increase) - 1) * 100)}% de cadência e +${format((1.05 ** increase - 1) * 100)}% de bônus de dano para este aliado.${interception}${collection}`;
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
    case 'shield': { const stats = shieldStats(next); return `Proteção por ${format(stats.duration)}s; recarga de ${format(stats.cooldown)}s após terminar. Cadência −${format((1 - 1 / (1 + .05 * (state.powerBonuses?.shield ?? 0))) * 100)}% pelo Hangar.`; }
    case 'charged': return `Tiro carregado: ${format((3 + next) * 3)}× dano base (crítico incluso); recarga ${format(Math.max(2.8, 7 - next * .7))}s. Clique para disparar.`;
    case 'nova': return `Pulso: raio ${155 + 25 * next} px e ${2 + next}× dano a cada ${format(Math.max(4.5, 10 - next))}s; custa ${Math.min(Math.max(0, player.maxHp - 60), 5 * (state.powerBonuses?.nova ?? 0))} de vida máxima pelo Hangar.`;
    case 'aimbot': return `Mantém o primeiro dos ${player.shots} tiros na mira normal e guia até ${Math.min(MAX_POWER_TARGETS, next, Math.max(0, player.shots - 1))} dos restantes ao alvo mais próximo, sem tiros extras nem perda de dano; cadência −${format((1 - 1 / (1 + .04 * (state.powerBonuses?.aimbot ?? 0))) * 100)}% pelo nível do Hangar.`;
    case 'overdrive': return `+${format((1.12 ** increase - 1) * 100)}% de dano e +${format((player.rate / Math.min(player.rate, Math.max(.07, player.rate * .86 ** increase)) - 1) * 100)}% de cadência; velocidade −${format((1 - Math.max(120, player.move * .97 ** (state.powerBonuses?.overdrive ?? 0)) / player.move) * 100)}% pelo Hangar.`;
    case 'singularity': return `Marca a mira; após 1,5s, atrai XP e projéteis hostis de toda a arena para o núcleo. Inimigos em ${230 + 24 * next} px sofrem ${format(.7 + .2 * next)}× dano e lentidão a cada ${format(Math.max(4.2, 8 - next * .7))}s; custa ${Math.min(Math.max(0, player.maxHp - 60), 3 * (state.powerBonuses?.singularity ?? 0))} de vida máxima.`;
    case 'ionStorm': return `Atinge até ${Math.min(MAX_POWER_TARGETS, next + 2)} alvos com ${format(1.15 + .28 * next)}× dano a cada ${format(Math.max(2.4, 5 - next * .45))}s; blindagem −${points(.02 * (state.powerBonuses?.ionStorm ?? 0))} pelo Hangar.`;
    case 'activeShield': { const stats = shieldStats(next, true); return `Tecla E: proteção por ${format(stats.duration)}s; recarga de ${format(stats.cooldown)}s após terminar.`; }
    case 'teleport': return `Tecla Q: salto de até ${190 + 24 * next} px, ${format(.45)}s de invulnerabilidade; recarga ${format(Math.max(4, 9 - next * .8))}s.`;
    case 'minefield': return `Instala uma mina a cada ${format(Math.max(2.2, 5.4 - next * .55))}s: explosão de ${format((1.8 + .5 * next) * 2)}× dano em raio de 112 px.`;
    case 'riftLance': return `Atinge até ${Math.min(MAX_POWER_TARGETS, next + 1)} alvos com ${format(1.4 + .55 * next)}× dano a cada ${format(Math.max(1.5, 3.8 - next * .45))}s.`;
    default: return choice.description;
  }
}
