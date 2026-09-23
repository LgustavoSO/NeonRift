import { pickChoices, POWERS } from '../data/upgrades.js';

export class UIController {
  constructor() {
    this.menu = document.querySelector('#menu-screen');
    this.choiceScreen = document.querySelector('#choice-screen');
    this.endScreen = document.querySelector('#end-screen');
    this.choiceGrid = document.querySelector('#choice-grid');
    this.choiceEyebrow = document.querySelector('#choice-eyebrow');
    this.choiceTitle = document.querySelector('#choice-title');
    this.choiceHint = this.choiceScreen.querySelector('.hint');
    this.choiceHandler = null;
    document.querySelector('#play-button').addEventListener('click', () => this.onStart?.());
    document.querySelector('#again-button').addEventListener('click', () => this.onStart?.());
  }

  onStart = null;

  showPlaying() {
    this.menu.classList.add('is-hidden');
    this.choiceScreen.classList.add('is-hidden');
    this.endScreen.classList.add('is-hidden');
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
    this.choiceEyebrow.textContent = 'GUARDIÃO DERROTADO · PODER ESPECIAL';
    this.choiceTitle.textContent = 'Escolha um superpoder';
    this.renderChoices(pickChoices(POWERS, 3), choice => onChoice(choice));
    this.choiceScreen.classList.remove('is-hidden');
  }

  showCompanionUpgrade(state, onChoice) {
    this.choiceEyebrow.textContent = `ESQUADRÃO · ${state.companions.length} DRONES`;
    this.choiceTitle.textContent = 'Quem recebe a melhoria?';
    const choices = state.companions.map((companion, index) => ({
      icon: '🛸',
      name: `Companheiro ${index + 1} · NÍVEL ${companion.level}`,
      description: `Ele sobe para o nível ${companion.level + 1}; só este drone ganha mais dano e cadência. ${companion.level === 2 ? 'No nível 3, libera interceptação de projéteis.' : ''}`,
      targetId: companion.id,
    }));
    if (state.companions.length < 4) {
      choices.push({
        icon: '➕',
        name: 'Novo companheiro',
        description: 'Adiciona um drone de nível 1 ao esquadrão, sem alterar os companheiros atuais.',
        addNew: true,
      });
    }
    this.renderChoices(choices, onChoice);
    this.choiceScreen.classList.remove('is-hidden');
  }

  renderChoices(choices, onChoice) {
    this.choiceHint.textContent = choices.length <= 3 ? 'Teclas 1, 2 ou 3 também funcionam' : 'Clique em um companheiro para escolher onde aplicar a melhoria';
    this.choiceGrid.replaceChildren();
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.innerHTML = `<span class="choice__icon">${choice.icon}</span><span class="choice__name">${index + 1}. ${choice.name}</span><span class="choice__description">${choice.description}</span>${choice.tradeoff ? `<span class="choice__tradeoff">${choice.tradeoff}</span>` : ''}`;
      button.addEventListener('click', () => onChoice(choice));
      this.choiceGrid.append(button);
    });
  }

  chooseByIndex(index) {
    this.choiceGrid.children[index]?.click();
  }

  showGameOver(state, bestScore) {
    document.querySelector('#end-title').textContent = state.level >= 5 ? `Você chegou ao nível ${state.level}` : 'A arena venceu desta vez';
    document.querySelector('#end-stats').innerHTML = `Pontuação: <b>${state.score}</b> · Abates: <b>${state.kills}</b> · Tempo: <b>${Math.floor(state.time)}s</b><br>Recorde: <b>${bestScore}</b>`;
    this.endScreen.classList.remove('is-hidden');
  }
}
