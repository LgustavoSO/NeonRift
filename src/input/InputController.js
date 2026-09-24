export class InputController {
  keys = new Set();
  pointer = { x: 0, y: 0, active: false };
  joystick = { x: 0, y: 0 };
  onDash = () => {};
  onTeleport = () => {};
  onActiveShield = () => {};
  onChargedShot = () => {};
  onPointerMove = () => {};
  onPause = () => {};
  onBlur = () => {};
  onChoice = () => {};

  constructor(canvas, dashButton, joystick, nub, teleportButton, shieldButton) {
    this.canvas = canvas;
    this.joystickElement = joystick;
    this.nub = nub;
    addEventListener('keydown', event => this.keyDown(event));
    addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
    const loseFocus = () => { this.keys.clear(); this.resetJoystick(); this.onBlur(); };
    addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); });
    canvas.addEventListener('pointermove', event => this.updatePointer(event));
    canvas.addEventListener('pointerdown', event => {
      this.updatePointer(event);
      if (event.button === 0 || event.pointerType === 'touch') this.onChargedShot();
    });
    dashButton.addEventListener('click', () => this.onDash());
    teleportButton?.addEventListener('click', () => this.onTeleport());
    shieldButton?.addEventListener('click', () => this.onActiveShield());
    joystick.addEventListener('pointerdown', event => { joystick.setPointerCapture(event.pointerId); this.moveJoystick(event); });
    joystick.addEventListener('pointermove', event => { if (joystick.hasPointerCapture(event.pointerId)) this.moveJoystick(event); });
    joystick.addEventListener('pointerup', () => this.resetJoystick());
    joystick.addEventListener('pointercancel', () => this.resetJoystick());
  }

  updatePointer(event) {
    this.pointer = { x: event.clientX, y: event.clientY, active: true };
    this.onPointerMove(this.pointer);
  }

  keyDown(event) {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    this.keys.add(key);
    if (event.repeat) return;
    if (key === ' ') this.onDash();
    if (key === 'q') this.onTeleport();
    if (key === 'e') this.onActiveShield();
    if (key === 'p') this.onPause();
    if (/^[1-9]$/.test(key)) this.onChoice(Number(key) - 1);
  }

  moveJoystick(event) {
    const rect = this.joystickElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const distance = Math.max(1, Math.hypot(x, y));
    const magnitude = Math.min(1, distance / 38);
    this.joystick = { x: x / distance * magnitude, y: y / distance * magnitude };
    this.nub.style.left = `${34 + this.joystick.x * 34}px`;
    this.nub.style.top = `${34 + this.joystick.y * 34}px`;
  }

  resetJoystick() {
    this.joystick = { x: 0, y: 0 };
    this.nub.style.left = '34px';
    this.nub.style.top = '34px';
  }

  movement() {
    const x = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) + this.joystick.x;
    const y = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) + this.joystick.y;
    const magnitude = Math.hypot(x, y);
    return magnitude ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
  }
}
