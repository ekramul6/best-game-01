// WebAudio sound effects, all synthesised with oscillators — no audio files.
// The context is created lazily on the first user gesture (browsers block
// audio before one), and every call is a no-op until then, so the title
// screen's attract mode stays silent.

export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** A short tone that slides from `fromHz` to `toHz` over `seconds`. */
  function blip(fromHz, toHz, seconds, type, volume) {
    if (!ensure() || context.state === 'suspended') return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(fromHz, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + seconds);
    } catch {
      // Sound is garnish: a failed blip never breaks the game.
    }
  }

  return {
    /** Call from any gesture handler so later sounds are allowed. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    shoot() {
      blip(880, 220, 0.08, 'square', 0.25);
    },
    enemyHit() {
      blip(320, 140, 0.07, 'triangle', 0.3);
    },
    explode() {
      blip(220, 40, 0.35, 'sawtooth', 0.5);
    },
    playerHit() {
      blip(160, 50, 0.3, 'sawtooth', 0.6);
    },
    pickup() {
      blip(660, 990, 0.12, 'sine', 0.4);
      blip(990, 1320, 0.12, 'sine', 0.3);
    },
    wave() {
      blip(440, 880, 0.25, 'sine', 0.4);
    },
    gameOver() {
      blip(392, 98, 0.8, 'triangle', 0.5);
    },
  };
}
