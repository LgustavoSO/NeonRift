import { pickChoices, POWERS } from '../data/upgrades.js';

export class UIController {
  constructor() {
    this.menu = document.querySelector('#menu-screen');
    this.choiceScreen = document.querySelector('#choice-screen');
    this.endScreen = document.querySelector('#end-screen');
    this.choiceGrid = document.querySelector('#choice-grid');
    this.choiceEyebrow = document.querySelector('#choice-eyebrow');
    this.choiceTitle = document.querySelector('#choice-title');
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

  renderChoices(choices, onChoice) {
    this.choiceGrid.replaceChildren();
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.innerHTML = `<span class="choice__icon">${choice.icon}</span><span class="choice__name">${index + 1}. ${choice.name}</span><span class="choice__description">${choice.description}</span>`;
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
