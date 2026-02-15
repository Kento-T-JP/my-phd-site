import { useCallback, useRef } from 'react';

/**
 * Plays a click sound effect unless disabled by user preferences.
 *
 * Sound is muted when the user prefers reduced motion or when a
 * `mute` flag is present in localStorage.
 */
export default function useClickSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (typeof window !== 'undefined' && !audioRef.current) {
    const audio = new Audio('/sounds/gacha.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let muted = prefersReducedMotion;
    if (!muted && typeof window !== 'undefined') {
      try {
        muted = localStorage.getItem('mute') === 'true';
      } catch {
        muted = true;
      }
    }
    if (muted) return;

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
  }, []);

  return { play };
}
