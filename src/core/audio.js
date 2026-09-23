export class AudioManager {
  context = null;

  play(frequency = 440, duration = .09, type = 'sine', gain = .035) {
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = this.context.createOscillator();
      const volume = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * .6), this.context.currentTime + duration);
      volume.gain.setValueAtTime(gain, this.context.currentTime);
      volume.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
      oscillator.connect(volume).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch { /* audio is a progressive enhancement */ }
  }
}
