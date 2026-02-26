"use client";

import { useEffect, useRef } from "react";

export default function CanvasParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const prefersReducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ua = navigator.userAgent;
    const isSafari =
      /Safari/i.test(ua) &&
      !/(Chrome|CriOS|Chromium|Edg|OPR|OPiOS|FxiOS|Firefox)/i.test(ua);

    const shouldAnimate = !prefersReducedMotion && !isSafari;
    const lowPowerMode = !shouldAnimate;
    const getViewportSize = () => {
      const vv = window.visualViewport;
      if (vv && vv.width > 0 && vv.height > 0) {
        return {
          width: Math.max(1, Math.round(vv.width)),
          height: Math.max(1, Math.round(vv.height)),
        };
      }
      return {
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
      };
    };
    let { width, height } = getViewportSize();
    const computeDpr = () => {
      const compact = window.innerWidth < 768;
      const baseDpr = window.devicePixelRatio || 1;
      return Math.min(baseDpr, lowPowerMode ? 1 : compact ? 1.25 : 2);
    };
    const applyCanvasSize = () => {
      const dpr = computeDpr();
      el.width = Math.max(1, Math.floor(width * dpr));
      el.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyCanvasSize();

    const shouldDrawConnections = !prefersReducedMotion;
    type Particle = { x: number; y: number; vx: number; vy: number };
    let particles: Particle[] = [];
    let maxDist = isSafari ? 75 : 100;
    let maxDistSq = maxDist * maxDist;
    let compactMode = window.innerWidth < 768;
    let frame: number | null = null;
    let resizeSettledTimer: number | null = null;
    let isResizing = false;
    let pausedForResize = false;
    let running = true;
    let lastTs = 0;
    let minFrameGap = lowPowerMode ? 1000 / 20 : 1000 / 60;
    const randomVelocity = () =>
      lowPowerMode ? 0 : (Math.random() - 0.5) * (compactMode ? 0.22 : 0.3);
    const targetParticleCount = () => {
      const particleDivider = isSafari ? 18 : compactMode ? 12 : 9;
      const minParticles = isSafari ? 20 : 28;
      const maxParticles = compactMode ? 80 : 120;
      return Math.min(
        maxParticles,
        Math.max(minParticles, Math.floor(Math.min(width, height) / particleDivider))
      );
    };

    const rebuildParticles = () => {
      compactMode = window.innerWidth < 768;
      const particleCount = targetParticleCount();
      maxDist = isSafari ? 75 : compactMode ? 64 : 100;
      maxDistSq = maxDist * maxDist;
      minFrameGap = lowPowerMode
        ? 1000 / 20
        : compactMode
          ? 1000 / 30
          : 1000 / 45;
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: randomVelocity(),
        vy: randomVelocity(),
      }));
    };

    const remapParticlesForResize = (prevWidth: number, prevHeight: number) => {
      const sx = prevWidth > 0 ? width / prevWidth : 1;
      const sy = prevHeight > 0 ? height / prevHeight : 1;
      compactMode = window.innerWidth < 768;
      maxDist = isSafari ? 75 : compactMode ? 64 : 100;
      maxDistSq = maxDist * maxDist;
      minFrameGap = lowPowerMode
        ? 1000 / 20
        : compactMode
          ? 1000 / 30
          : 1000 / 45;
      const needed = targetParticleCount();
      for (const p of particles) {
        p.x = Math.min(width, Math.max(0, p.x * sx));
        p.y = Math.min(height, Math.max(0, p.y * sy));
        if (!lowPowerMode) {
          // Keep velocity stable across breakpoint changes.
          p.vx = Math.max(-0.35, Math.min(0.35, p.vx));
          p.vy = Math.max(-0.35, Math.min(0.35, p.vy));
        }
      }
      if (particles.length > needed) {
        particles.length = needed;
      } else if (particles.length < needed) {
        const extra = needed - particles.length;
        for (let i = 0; i < extra; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: randomVelocity(),
            vy: randomVelocity(),
          });
        }
      }
    };
    rebuildParticles();

    function step(ts: number) {
      if (!running || pausedForResize) return;
      const resizeStressMode = !isSafari && isResizing;
      const activeFrameGap = resizeStressMode
        ? Math.max(minFrameGap, 1000 / 20)
        : minFrameGap;
      if (shouldAnimate && ts - lastTs < activeFrameGap) {
        frame = requestAnimationFrame(step);
        return;
      }
      lastTs = ts;
      ctx.clearRect(0, 0, width, height);
      if (shouldAnimate) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) {
            p.x = 0;
            p.vx = Math.abs(p.vx);
          } else if (p.x > width) {
            p.x = width;
            p.vx = -Math.abs(p.vx);
          }
          if (p.y < 0) {
            p.y = 0;
            p.vy = Math.abs(p.vy);
          } else if (p.y > height) {
            p.y = height;
            p.vy = -Math.abs(p.vy);
          }
        }
      }

      const particleStride = resizeStressMode ? 2 : 1;
      const drawConnections = shouldDrawConnections && !resizeStressMode;
      ctx.fillStyle = "#8cdaf3";
      for (let i = 0; i < particles.length; i += particleStride) {
        const p1 = particles[i];
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, compactMode ? 1.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (drawConnections) {
        const cellSize = maxDist;
        const buckets = new Map<string, number[]>();
        for (let i = 0; i < particles.length; i += particleStride) {
          const p = particles[i];
          const cx = Math.floor(p.x / cellSize);
          const cy = Math.floor(p.y / cellSize);
          const key = `${cx},${cy}`;
          const list = buckets.get(key);
          if (list) list.push(i);
          else buckets.set(key, [i]);
        }

        for (let i = 0; i < particles.length; i += particleStride) {
          const p1 = particles[i];
          const cx = Math.floor(p1.x / cellSize);
          const cy = Math.floor(p1.y / cellSize);
          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const neighbor = buckets.get(`${cx + ox},${cy + oy}`);
              if (!neighbor) continue;
              for (const j of neighbor) {
                if (j <= i) continue;
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                if (distSq >= maxDistSq) continue;
                const dist = Math.sqrt(distSq);
                const lineAlphaBase = isSafari ? 0.75 : compactMode ? 0.35 : 0.6;
                ctx.strokeStyle = `rgba(140,218,243,${(1 - dist / maxDist) * lineAlphaBase})`;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }
        }
      }
      frame = shouldAnimate ? requestAnimationFrame(step) : null;
    }

    function onVisibility() {
      running = document.visibilityState === "visible";
      if (running && frame === null) {
        if (shouldAnimate) {
          frame = requestAnimationFrame(step);
        } else {
          step(performance.now());
        }
      } else if (!running && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    }

    function onResize() {
      if (!isSafari) {
        pausedForResize = true;
        isResizing = true;
        if (frame !== null) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        if (resizeSettledTimer !== null) {
          window.clearTimeout(resizeSettledTimer);
        }
        resizeSettledTimer = window.setTimeout(() => {
          const prevWidth = width;
          const prevHeight = height;
          ({ width, height } = getViewportSize());
          applyCanvasSize();
          remapParticlesForResize(prevWidth, prevHeight);
          pausedForResize = false;
          isResizing = false;
          lastTs = 0;
          if (running && shouldAnimate && frame === null) {
            frame = requestAnimationFrame(step);
          } else if (!shouldAnimate) {
            step(performance.now());
          }
        }, 220);
      } else {
        // Safari/fixed-mode: keep static rendering, but re-spread particles after resize settles.
        if (resizeSettledTimer !== null) {
          window.clearTimeout(resizeSettledTimer);
        }
        resizeSettledTimer = window.setTimeout(() => {
          const prevWidth = width;
          const prevHeight = height;
          ({ width, height } = getViewportSize());
          applyCanvasSize();
          remapParticlesForResize(prevWidth, prevHeight);
          step(performance.now());
        }, 120);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    if (shouldAnimate) {
      frame = requestAnimationFrame(step);
    } else {
      step(performance.now());
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (resizeSettledTimer !== null) window.clearTimeout(resizeSettledTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none bg-transparent"
    />
  );
}
