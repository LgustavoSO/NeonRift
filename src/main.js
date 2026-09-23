import { Renderer } from './render/Renderer.js';
import { InputController } from './input/InputController.js';
import { UIController } from './ui/UIController.js';
import { Game } from './game/Game.js';

const canvas = document.querySelector('#game-canvas');
const renderer = new Renderer(canvas);
const input = new InputController(
  canvas,
  document.querySelector('#dash-touch'),
  document.querySelector('#joystick'),
  document.querySelector('#joystick-nub'),
);
const ui = new UIController();

new Game({ renderer, input, ui });
