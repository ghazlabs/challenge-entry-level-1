export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmAudio: HTMLAudioElement | null = null;

  private constructor() {
    // Initialize standard Audio if available (for BGM)
    if (typeof window !== 'undefined') {
      this.bgmAudio = new Audio('/music/background.mp3');
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.5;
    }
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = muted;
    }
    // If we're unmuting and context exists but suspended, resume it
    if (!muted && this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public getMuteStatus(): boolean {
    return this.isMuted;
  }

  public startBGM() {
    if (!this.bgmAudio) return;
    // User interaction is usually required to play audio
    this.bgmAudio.play().catch((e) => {
      console.log(
        'Background music start prevented (waiting for interaction)',
        e
      );
    });
  }

  public stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  /**
   * Resume audio context if it was suspended (browser policy)
   */
  public async resumeContext() {
    this.initContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    // Also try to start BGM if it failed before
    if (!this.isMuted && this.bgmAudio && this.bgmAudio.paused) {
      this.bgmAudio.play().catch(() => {});
    }
  }

  public playJumpSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        600,
        this.audioContext.currentTime + 0.1
      );

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.1
      );

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (e) {
      console.error('Error playing jump sound', e);
    }
  }

  public playScoreSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);

      // Double beep effect
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (e) {
      console.error('Error playing score sound', e);
    }
  }

  public playGameOverSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        10,
        this.audioContext.currentTime + 0.3
      );

      gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + 0.3
      );

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (e) {
      console.error('Error playing game over sound', e);
    }
  }
}
