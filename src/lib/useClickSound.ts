import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays a click sound effect unless disabled by user preferences.
 *
 * Sound is muted when the user prefers reduced motion or when a
 * `mute` flag is present in localStorage.
 */
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

  if (typeof window !== 'undefined' && !audioRef.current) {
    const audio = new Audio('/sounds/gacha.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;
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

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (readMuted()) return;

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
