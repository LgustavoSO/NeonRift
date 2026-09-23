import { pickChoices, POWERS } from '../data/upgrades.js';
import { COMPANION_MODELS, MAX_EQUIPPED_COMPANIONS, SHIP_UPGRADES, SKILL_UNLOCKS } from '../data/hangar.js';
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
    if (profile) meta.innerHTML = `<span>◈ ${profile.credits} CRÉDITOS</span><span>MAIOR NÍVEL ${profile.bestLevel}/20</span><span>${profile.equippedCompanions.length}/2 COMPANHEIROS</span>`;
  }

  showHangar(profile, actions) {
    this.profile = profile;
    this.menu.classList.add('is-hidden');
    this.choiceScreen.classList.add('is-hidden');
    this.endScreen.classList.add('is-hidden');
    this.hangarScreen.classList.remove('is-hidden');
    document.querySelector('#hangar-meta').innerHTML = `<span>◈ ${profile.credits} CRÉDITOS</span><span>CARREIRA NÍVEL ${profile.careerLevel}/20</span><span>RECORDE NÍVEL ${profile.bestLevel}</span>`;
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
    const companionRoot = document.querySelector('#companion-shop');
    companionRoot.replaceChildren();
    for (const item of COMPANION_MODELS) {
      const owned = profile.ownedCompanions.includes(item.id);
      const equipped = profile.equippedCompanions.includes(item.id);
      const level = profile.companionLevels[item.id] ?? 1;
      const upgradeCost = Math.ceil(item.upgradeCost * 1.55 ** (level - 1));
      const card = document.createElement('div'); card.className = `hangar-card companion-card${equipped ? ' is-equipped' : ''}`;
      card.innerHTML = `<span class="hangar-card__icon" style="color:${item.color}">${item.icon}</span><b>${item.name} <small>· ${item.role}</small></b><span>${item.description}</span><small>${owned ? `NÍVEL ${level}/${item.maxLevel} · DANO ×${item.damageMultiplier} · CADÊNCIA ×${item.cadenceMultiplier}` : `DANO ×${item.damageMultiplier} · CADÊNCIA ×${item.cadenceMultiplier}`}</small>`;
      const actionsRow = document.createElement('div'); actionsRow.className = 'companion-actions';
      const equipButton = document.createElement('button'); equipButton.type = 'button'; equipButton.className = 'secondary-button';
      equipButton.disabled = owned ? !equipped && profile.equippedCompanions.length >= MAX_EQUIPPED_COMPANIONS : profile.credits < item.cost;
      equipButton.textContent = owned ? equipped ? '✓ EQUIPADO · GUARDAR' : 'EQUIPAR' : `◈ ${item.cost} CR · CONTRATAR`;
      equipButton.addEventListener('click', () => owned ? actions.toggleCompanion(item.id) : actions.buyCompanion(item.id)); actionsRow.append(equipButton);
      if (owned) {
        const upgradeButton = document.createElement('button'); upgradeButton.type = 'button'; upgradeButton.className = 'companion-upgrade';
        upgradeButton.disabled = level >= item.maxLevel || profile.credits < upgradeCost;
        upgradeButton.textContent = level >= item.maxLevel ? 'NÍVEL MÁXIMO' : `MELHORAR · ◈ ${upgradeCost} CR`;
        upgradeButton.addEventListener('click', () => actions.upgradeCompanion(item.id)); actionsRow.append(upgradeButton);
      }
      card.append(actionsRow); companionRoot.append(card);
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
    this.choiceEyebrow.textContent = `NÍVEL ${state.level} · EVOLUÇÃO`;
    this.choiceTitle.textContent = 'Escolha uma melhoria';
    this.renderChoices(upgrades, choice => onChoice(choice));
    this.choiceScreen.classList.remove('is-hidden');
  }

  showBossReward(state, onChoice) {
    this.choiceHandler = onChoice;
    this.choiceEyebrow.textContent = `GUARDIÃO ${state.bossesDefeated}/4 · PODER ESPECIAL`;
    this.choiceTitle.textContent = 'Escolha um superpoder';
    const available = POWERS.filter(power => this.profile?.unlockedSkills?.includes(power.key));
    this.renderChoices(pickChoices(available.length ? available : POWERS, 3), choice => onChoice(choice));
    this.choiceScreen.classList.remove('is-hidden');
  }

  showCompanionUpgrade(state, onChoice) {
    this.choiceEyebrow.textContent = `ESQUADRÃO · ${state.companions.length} COMPANHEIROS`;
    this.choiceTitle.textContent = 'Quem recebe a melhoria?';
    const choices = state.companions.map((companion, index) => ({ icon: companion.icon ?? '🛸', name: `${companion.name ?? `Companheiro ${index + 1}`} · NÍVEL ${companion.level}`, description: `Ele sobe para o nível ${companion.level + 1}; só este companheiro ganha mais dano e cadência.`, targetId: companion.id }));
    if (state.companions.length < 4) choices.push({ icon: '➕', name: 'Novo companheiro de reserva', description: 'Adiciona um aliado temporário à equipe desta expedição.', addNew: true });
    this.renderChoices(choices, onChoice); this.choiceScreen.classList.remove('is-hidden');
  }

  renderChoices(choices, onChoice) {
    this.choiceHint.textContent = choices.length <= 3 ? 'Teclas 1, 2 ou 3 também funcionam' : 'Escolha em qual companheiro aplicar a melhoria';
    this.choiceGrid.replaceChildren();
    choices.forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'choice';
      button.innerHTML = `<span class="choice__icon">${choice.icon}</span><span class="choice__name">${index + 1}. ${choice.name}</span><span class="choice__description">${choice.description}</span>${choice.tradeoff ? `<span class="choice__tradeoff">${choice.tradeoff}</span>` : ''}`;
      button.addEventListener('click', () => onChoice(choice)); this.choiceGrid.append(button);
    });
  }

  chooseByIndex(index) { this.choiceGrid.children[index]?.click(); }

  showGameOver(state, bestScore) {
    const completed = state.outcome === 'stage-complete';
    const victory = state.outcome === 'victory';
    const powerNames = { companion: 'Companheiros', shield: 'Escudo', charged: 'Tiro carregado', nova: 'Pulso', aimbot: 'Mira automática', overdrive: 'Sobrecarga', singularity: 'Singularidade', ionStorm: 'Tempestade iônica' };
    const build = Object.entries(state.powers).filter(([, level]) => level > 0).map(([key, level]) => `${powerNames[key]} ${level}`).join(' · ') || 'Canhão de série';
    document.querySelector('#end-eyebrow').textContent = completed ? 'ETAPA 1 CONCLUÍDA · RUN ENCERRADA' : victory ? 'MISSÃO CONCLUÍDA' : 'TRANSMISSÃO ENCERRADA';
    document.querySelector('#end-title').textContent = completed ? 'Você conquistou o nível 20' : victory ? 'O Rift foi selado' : `A arena venceu · nível ${state.level}`;
    document.querySelector('#end-stats').innerHTML = `Pontuação: <b>${state.score}</b> · Abates: <b>${state.kills}</b> · Tempo: <b>${Math.floor(state.time)}s</b><br>Guardiões: <b>${state.bossesDefeated}/4</b> · Maior nível: <b>${state.level}/20</b> · Recorde: <b>${bestScore}</b><br>Créditos desta run: <b>◈ ${state.creditsEarned}</b><br>Build: <b>${build}</b>`;
    document.querySelector('#again-button').innerHTML = 'TENTAR NOVAMENTE <span>→</span>';
    this.endScreen.classList.remove('is-hidden');
  }
}
