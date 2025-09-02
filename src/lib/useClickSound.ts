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
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const muted =
      (typeof window !== 'undefined' && localStorage.getItem('mute') === 'true') ||
      prefersReducedMotion;
    if (muted) return;

    try {
      audio.currentTime = 0;
      void audio.play();
    } catch {
      // ignore play errors
    }
  }, []);

  return { play };
}
