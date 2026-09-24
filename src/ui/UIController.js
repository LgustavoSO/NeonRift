import { pickChoices, PERMANENT_POWER_UPGRADES, POWERS } from '../data/upgrades.js';
import { getChoiceNextEffect, getChoiceProgress } from '../data/choice-details.js';
import { COMPANION_MODELS, MAX_COMPANION_LEVEL, MAX_RUN_COMPANIONS, MAX_RUN_LEVEL, SHIP_UPGRADES, SKILL_UNLOCKS, TOTAL_BOSSES } from '../data/hangar.js';
import { upgradeCost } from '../core/profile.js';

export class UIController {
  constructor() {
    this.menu = document.querySelector('#menu-screen');
    this.choiceScreen = document.querySelector('#choice-screen');
    this.hangarScreen = document.querySelector('#hangar-screen');
    this.endScreen = document.querySelector('#end-screen');
    this.choiceGrid = document.querySelector('#choice-grid');
    this.choiceEyebrow = document.querySelector('#choice-eyebrow');
    this.choiceTitle = document.querySelector('#choice-title');
    this.choiceHint = this.choiceScreen.querySelector('.hint');
    this.choiceHandler = null;
    this.profile = null;
    document.querySelector('#play-button').addEventListener('click', () => this.onStart?.());
    document.querySelector('#hangar-start').addEventListener('click', () => this.onStart?.());
    document.querySelector('#again-button').addEventListener('click', () => this.onStart?.());
    document.querySelector('#hangar-button').addEventListener('click', () => this.onOpenHangar?.());
    document.querySelector('#end-hangar-button').addEventListener('click', () => this.onOpenHangar?.());
    document.querySelector('#hangar-back').addEventListener('click', () => this.showMenu(this.profile));
  }

  onStart = null;
  onOpenHangar = null;

  showMenu(profile = this.profile) {
    this.profile = profile;
    this.menu.classList.remove('is-hidden');
    this.choiceScreen.classList.add('is-hidden');
    this.hangarScreen.classList.add('is-hidden');
    this.endScreen.classList.add('is-hidden');
    const meta = document.querySelector('#menu-meta');
    if (profile) meta.innerHTML = `<span>◈ ${profile.credits} CRÉDITOS</span><span>MAIOR NÍVEL ${profile.bestLevel}/${MAX_RUN_LEVEL}</span><span>${profile.runs} EXPEDIÇÕES</span>`;
  }

  showHangar(profile, actions) {
    this.profile = profile;
    this.menu.classList.add('is-hidden');
    this.choiceScreen.classList.add('is-hidden');
    this.endScreen.classList.add('is-hidden');
    this.hangarScreen.classList.remove('is-hidden');
    document.querySelector('#hangar-meta').innerHTML = `<span>◈ ${profile.credits} CRÉDITOS</span><span>CARREIRA NÍVEL ${profile.careerLevel}/${MAX_RUN_LEVEL}</span><span>RECORDE NÍVEL ${profile.bestLevel}</span>`;
    const upgradeRoot = document.querySelector('#ship-upgrades');
    upgradeRoot.replaceChildren();
    for (const item of SHIP_UPGRADES) {
      const level = profile.shipUpgrades[item.key];
      const cost = upgradeCost(item, level);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hangar-card';
      button.disabled = level >= item.maxLevel || profile.credits < cost;
      button.innerHTML = `<span class="hangar-card__icon">${item.icon}</span><b>${item.name}</b><small>NÍVEL ${level}/${item.maxLevel}</small><span>${item.description}</span><strong>${level >= item.maxLevel ? 'MÁXIMO' : `◈ ${cost} CR`}</strong>`;
      button.addEventListener('click', () => actions.buyUpgrade(item.key));
      upgradeRoot.append(button);
    }
    const powerRoot = document.querySelector('#superpower-upgrades');
    powerRoot.replaceChildren();
    for (const item of PERMANENT_POWER_UPGRADES) {
      const unlocked = profile.unlockedSkills.includes(item.key);
      const level = profile.superpowerUpgrades[item.key] ?? 0;
      const cost = upgradeCost(item, level);
      const button = document.createElement('button');
      button.type = 'button'; button.className = `hangar-card${unlocked ? '' : ' is-locked'}`;
      button.disabled = !unlocked || level >= item.maxLevel || profile.credits < cost;
      button.innerHTML = `<span class="hangar-card__icon">${item.icon}</span><b>${item.name}</b><small>${unlocked ? `NÍVEL ${level}/${item.maxLevel}` : 'DESBLOQUEIA NA CARREIRA'}</small><span>${item.description}</span>${item.tradeoff ? `<small class="choice__tradeoff">${item.tradeoff}</small>` : ''}<strong>${!unlocked ? `CARREIRA ${SKILL_UNLOCKS.find(skill => skill.key === item.key)?.level ?? '—'}` : level >= item.maxLevel ? 'MÁXIMO' : `◈ ${cost} CR`}</strong>`;
      button.addEventListener('click', () => actions.buyPowerUpgrade(item.key));
      powerRoot.append(button);
    }
    const skills = document.querySelector('#skill-unlocks');
    skills.replaceChildren();
    for (const skill of SKILL_UNLOCKS) {
      const unlocked = profile.unlockedSkills.includes(skill.key);
      const row = document.createElement('div'); row.className = `skill-row${unlocked ? ' is-unlocked' : ''}`;
      row.innerHTML = `<span>${skill.icon}</span><b>${skill.name}</b><small>${unlocked ? 'DESBLOQUEADA' : `LIBERA NO NÍVEL ${skill.level}`}</small>`;
      skills.append(row);
    }
  }

  showPlaying() {
    this.menu.classList.add('is-hidden'); this.choiceScreen.classList.add('is-hidden'); this.hangarScreen.classList.add('is-hidden'); this.endScreen.classList.add('is-hidden');
  }

  showUpgrade(state, upgrades, onChoice) {
    this.choiceHandler = onChoice;
    this.choiceEyebrow.textContent = `NÍVEL ${state.level} · ESCOLHAS DA EXPEDIÇÃO`;
    this.choiceTitle.textContent = 'Escolha uma melhoria';
    this.renderChoices(upgrades, state, choice => onChoice(choice));
    this.choiceScreen.classList.remove('is-hidden');
  }

  showBossReward(state, onChoice, availablePowers = []) {
    this.choiceHandler = onChoice;
    this.choiceEyebrow.textContent = `CHEFES ${state.bossesDefeated}/${TOTAL_BOSSES} · RECOMPENSA DA EXPEDIÇÃO`;
    this.choiceTitle.textContent = 'Escolha um superpoder';
    this.renderChoices(pickChoices(availablePowers, 3), state, choice => onChoice(choice));
    this.choiceScreen.classList.remove('is-hidden');
  }

  showCompanionUpgrade(state, onChoice) {
    this.choiceEyebrow.textContent = `ESQUADRÃO · ${state.companions.length} COMPANHEIROS`;
    this.choiceTitle.textContent = 'Quem recebe a melhoria?';
    const companionPower = 1 + (state.powerBonuses?.companion ?? 0);
    const choices = state.companions
      .filter(companion => companion.level < MAX_COMPANION_LEVEL)
      .map((companion, index) => ({ icon: companion.icon ?? '🛸', name: `${companion.name ?? `Companheiro ${index + 1}`} · NÍVEL ${companion.level}/${MAX_COMPANION_LEVEL}`, description: 'A melhoria afeta apenas este aliado; os demais mantêm seus níveis.', targetId: companion.id, companionGainLevels: Math.min(companionPower, MAX_COMPANION_LEVEL - companion.level) }));
    if (state.companions.length < MAX_RUN_COMPANIONS) {
      const companionGainLevels = Math.min(companionPower, MAX_COMPANION_LEVEL);
      for (const model of COMPANION_MODELS.filter(item => !state.companions.some(companion => companion.modelId === item.id))) choices.push({ icon: model.icon, name: `Adicionar ${model.name} · ${model.role}`, description: model.description, modelId: model.id, color: model.color, companionGainLevels });
    }
    this.renderChoices(choices, state, onChoice); this.choiceScreen.classList.remove('is-hidden');
  }

  renderChoices(choices, state, onChoice) {
    const shortcuts = choices.slice(0, 9).map((_, index) => `<kbd>${index + 1}</kbd>`).join('');
    this.choiceHint.innerHTML = `<span>${choices.length > 3 ? 'Escolha uma opção · atalhos' : 'Atalhos do teclado'}</span><span class="choice-shortcuts">${shortcuts}</span>`;
    this.choiceGrid.replaceChildren();
    choices.forEach((choice, index) => {
      const isCompanion = choice.targetId != null || Boolean(choice.modelId);
      const isSuperpower = !isCompanion && !choice.apply && POWERS.some(power => power.key === choice.key);
      const type = isCompanion ? 'COMPANHEIRO' : isSuperpower ? 'SUPERPODER' : 'HABILIDADE';
      const typeClass = isCompanion ? 'companion' : isSuperpower ? 'superpower' : 'skill';
      const progress = getChoiceProgress(choice, state);
      const nextEffect = getChoiceNextEffect(choice, state);
      const progressMarkup = progress.current == null
        ? `<span class="choice__progress choice__progress--new"><span>${progress.label}</span><b>NÍVEL ${progress.next}${progress.max == null ? '' : ` / ${progress.max}`}</b></span>`
        : `<span class="choice__progress"><span><small>ATUAL</small><b>NÍVEL ${progress.current}</b></span><i aria-hidden="true">→</i><span><small>APÓS ESCOLHA</small><b>NÍVEL ${progress.next}${progress.max == null ? '' : ` / ${progress.max}`}</b></span></span>`;
      const button = document.createElement('button'); button.type = 'button'; button.className = `choice choice--${typeClass}`;
      const accessibleProgress = progress.current == null ? `${progress.label}, nível ${progress.next}` : `nível atual ${progress.current}, após a escolha nível ${progress.next}${progress.max == null ? '' : ` de ${progress.max}`}`;
      button.setAttribute('aria-label', `${type}: ${choice.name}. ${accessibleProgress}. Próximo nível: ${nextEffect}.`);
      button.innerHTML = `<span class="choice__type">${type}</span><span class="choice__icon">${choice.icon}</span><span class="choice__name">${index + 1}. ${choice.name}</span>${progressMarkup}<span class="choice__next"><small>O QUE O PRÓXIMO NÍVEL ADICIONA</small><span>${nextEffect}</span></span><span class="choice__description">${choice.description}</span>${choice.tradeoff ? `<span class="choice__tradeoff">${choice.tradeoff}</span>` : ''}`;
      button.addEventListener('click', () => onChoice(choice)); this.choiceGrid.append(button);
    });
  }

  chooseByIndex(index) { this.choiceGrid.children[index]?.click(); }

  showGameOver(state, bestScore) {
    const victory = state.outcome === 'victory';
    const powerNames = { companion: 'Reforço de esquadrão', shield: 'Escudo reativo', charged: 'Tiro carregado', nova: 'Pulso gravitacional', aimbot: 'Mira automática', overdrive: 'Sobrecarga', singularity: 'Singularidade', ionStorm: 'Tempestade iônica', activeShield: 'Barreira manual', teleport: 'Salto de fase', minefield: 'Campo de minas', riftLance: 'Lança do Rift' };
    const powerIcons = { companion: '🛸', shield: '🛡️', charged: '☄️', nova: '🌌', aimbot: '🎯', overdrive: '⚡', singularity: '🕳️', ionStorm: '🌩️', activeShield: '🔰', teleport: '🌀', minefield: '💣', riftLance: '⚔️' };
    const buildItems = Object.entries(state.powers).filter(([, level]) => level > 0).map(([key, level]) => `<span class="build-chip"><span>${powerIcons[key] ?? '✦'}</span>${powerNames[key] ?? key} <b>×${level}</b></span>`);
    for (const companion of state.companions) buildItems.push(`<span class="build-chip build-chip--companion"><span>${companion.icon ?? '🛸'}</span>${companion.name} <b>N${companion.level}/${MAX_COMPANION_LEVEL}</b></span>`);
    if (!buildItems.length) buildItems.push('<span class="build-chip">Canhão de série</span>');
    const levelPercent = Math.min(100, state.level / MAX_RUN_LEVEL * 100);
    const bossPercent = Math.min(100, state.bossesDefeated / TOTAL_BOSSES * 100);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    this.endScreen.dataset.outcome = victory ? 'victory' : 'defeat';
    document.querySelector('#end-eyebrow').textContent = victory ? 'ETAPA 1 · NÚCLEO DO RIFT DESTRUÍDO' : 'TRANSMISSÃO ENCERRADA';
    document.querySelector('#end-title').textContent = victory ? `Você conquistou o nível ${MAX_RUN_LEVEL}` : `A arena venceu · nível ${state.level}`;
    document.querySelector('#end-stats').innerHTML = `
      <div class="end-metrics" aria-label="Resumo da partida">
        <article class="end-metric end-metric--score"><span>Pontuação</span><strong>${state.score.toLocaleString('pt-BR')}</strong></article>
        <article class="end-metric"><span>Abates</span><strong>${state.kills.toLocaleString('pt-BR')}</strong></article>
        <article class="end-metric"><span>Tempo na arena</span><strong>${minutes}:${seconds}</strong></article>
        <article class="end-metric"><span>Recorde pessoal</span><strong>${bestScore.toLocaleString('pt-BR')}</strong></article>
      </div>
      <section class="end-section end-progress">
        <div class="end-section__heading"><h3>Progresso da etapa</h3><strong>Nível ${state.level} <span>/ ${MAX_RUN_LEVEL}</span></strong></div>
        <div class="end-progress__track" role="progressbar" aria-label="Nível da campanha" aria-valuemin="1" aria-valuemax="${MAX_RUN_LEVEL}" aria-valuenow="${state.level}"><span style="width:${levelPercent}%"></span></div>
        <div class="end-progress__bosses"><span>Chefes derrotados</span><strong>${state.bossesDefeated} <small>/ ${TOTAL_BOSSES}</small></strong><span class="end-credit">◈ ${state.creditsEarned} créditos ganhos</span></div>
        <div class="end-progress__track end-progress__track--boss" role="progressbar" aria-label="Chefes derrotados" aria-valuemin="0" aria-valuemax="${TOTAL_BOSSES}" aria-valuenow="${state.bossesDefeated}"><span style="width:${bossPercent}%"></span></div>
      </section>
      <section class="end-section end-build"><div class="end-section__heading"><h3>Configuração da nave</h3><span>${state.companions.length} companheiros</span></div><div class="build-chips">${buildItems.join('')}</div></section>`;
    document.querySelector('#again-button').innerHTML = 'TENTAR NOVAMENTE <span>→</span>';
    this.endScreen.classList.remove('is-hidden');
  }
}
