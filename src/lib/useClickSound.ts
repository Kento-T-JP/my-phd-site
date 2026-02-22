import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays a click sound effect unless disabled by user preferences.
 *
 * Sound is muted when the user prefers reduced motion or when a
 * `mute` flag is present in localStorage.
 */

let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let sharedAudioBuffer: AudioBuffer | null = null;
let sharedAudioBufferPromise: Promise<AudioBuffer | null> | null = null;
let sharedAudioInitialized = false;
let lastPlayAt = 0;
const MIN_PLAY_INTERVAL_MS = 90;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;
  sharedAudioContext = new AudioContextCtor();
  return sharedAudioContext;
}

async function ensureAudioBuffer(): Promise<AudioBuffer | null> {
  if (typeof window === 'undefined') return null;
  const context = getAudioContext();
  if (!context) return null;
  if (sharedAudioBuffer) return sharedAudioBuffer;
  if (sharedAudioBufferPromise) return sharedAudioBufferPromise;

  sharedAudioBufferPromise = (async () => {
    try {
      const response = await fetch('/sounds/gacha.mp3', { cache: 'force-cache' });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(arrayBuffer);
      sharedAudioBuffer = buffer;
      return buffer;
    } catch {
      return null;
    } finally {
      sharedAudioBufferPromise = null;
    }
  })();

  return sharedAudioBufferPromise;
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudio) return sharedAudio;
  const audio = new Audio('/sounds/gacha.mp3');
  audio.preload = 'auto';
  audio.volume = 1;
  sharedAudio = audio;
  return sharedAudio;
}

export default function useClickSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  const readMuted = useCallback(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return true;
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('mute') === 'true';
    } catch {
      return true;
    }
  }, []);

  if (!audioRef.current) {
    audioRef.current = getSharedAudio();
  }

  useEffect(() => {
    setMuted(readMuted());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mute') {
        setMuted(readMuted());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [readMuted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sharedAudioInitialized) return;
    sharedAudioInitialized = true;

    const warmup = () => {
      const context = getAudioContext();
      if (context) {
        void context.resume();
        void ensureAudioBuffer();
      }
      const audio = getSharedAudio();
      if (audio) {
        try {
          const result = audio.play();
          if (result && typeof result.then === 'function') {
            void result
              .then(() => {
                audio.pause();
                audio.currentTime = 0;
              })
              .catch(() => {});
          }
        } catch {
          // ignore warmup failures
        }
      }
      window.removeEventListener('pointerdown', warmup, true);
      window.removeEventListener('touchstart', warmup, true);
      window.removeEventListener('keydown', warmup, true);
    };

    window.addEventListener('pointerdown', warmup, true);
    window.addEventListener('touchstart', warmup, true);
    window.addEventListener('keydown', warmup, true);
    return () => {
      window.removeEventListener('pointerdown', warmup, true);
      window.removeEventListener('touchstart', warmup, true);
      window.removeEventListener('keydown', warmup, true);
    };
  }, []);

  const play = useCallback(() => {
    if (readMuted()) return;
    const now = performance.now();
    if (now - lastPlayAt < MIN_PLAY_INTERVAL_MS) return;
    lastPlayAt = now;

    const context = getAudioContext();
    const buffer = sharedAudioBuffer;
    if (context && buffer && context.state === 'running') {
      try {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
        return;
      } catch {
        // fall through to HTMLAudio fallback
      }
    }

    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (typeof audio.play !== 'function') return;
      audio.currentTime = 0;
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
    } catch {
      // ignore play errors
    }
  }, [readMuted]);

  const toggleMuted = useCallback(() => {
    if (typeof window === 'undefined') return;
    const next = !readMuted();
    try {
      localStorage.setItem('mute', next ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
    setMuted(next);
  }, [readMuted]);

  return { play, muted, toggleMuted };
}
