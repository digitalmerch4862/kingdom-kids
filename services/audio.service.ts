/**
 * Professional Audio Synthesis Service
 * Uses Web Audio API to generate "techy" UI sounds without external assets.
 */

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Subtle high-frequency tick for hovering
   */
  playHover() {
    try {
      this.init();
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx!.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx!.currentTime + 0.02);

      gain.gain.setValueAtTime(0.02, this.ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start();
      osc.stop(this.ctx!.currentTime + 0.02);
    } catch (e) { /* Audio blocked or failed */ }
  }

  /**
   * Snappy electronic chirp for clicking
   */
  playClick() {
    try {
      this.init();
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(400, this.ctx!.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, this.ctx!.currentTime + 0.05);

      gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start();
      osc.stop(this.ctx!.currentTime + 0.05);
    } catch (e) { /* Audio blocked or failed */ }
  }

  /**
   * Celebratory rising success chord (Yehey!)
   */
  playYehey() {
    try {
      this.init();
      const now = this.ctx!.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const startTime = now + (i * 0.05);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) { /* Audio blocked or failed */ }
  }
}

export const audio = new AudioService();