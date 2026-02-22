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

    const isCompact = window.innerWidth < 768;
    const shouldAnimate = !prefersReducedMotion && !isSafari;
    const lowPowerMode = !shouldAnimate;
    let width = el.offsetWidth;
    let height = el.offsetHeight;
    const baseDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(baseDpr, lowPowerMode ? 1 : isCompact ? 1.25 : 2);

    const applyCanvasSize = () => {
      el.width = Math.max(1, Math.floor(width * dpr));
      el.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyCanvasSize();

    const particleDivider = isSafari ? 18 : isCompact ? 12 : 7;
    const particleCount = Math.max(
      isSafari ? 20 : 30,
      Math.floor(Math.min(width, height) / particleDivider)
    );
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: lowPowerMode ? 0 : (Math.random() - 0.5) * (isCompact ? 0.22 : 0.3),
        vy: lowPowerMode ? 0 : (Math.random() - 0.5) * (isCompact ? 0.22 : 0.3),
      });
    }

    const shouldDrawConnections = !prefersReducedMotion;
    const maxDist = isSafari ? 56 : isCompact ? 64 : 100;
    let frame: number | null = null;
    let running = true;
    let lastTs = 0;
    const minFrameGap = lowPowerMode
      ? 1000 / 20
      : isCompact
        ? 1000 / 24
        : 1000 / 60;

    function step(ts: number) {
      if (!running) return;
      if (shouldAnimate && ts - lastTs < minFrameGap) {
        frame = requestAnimationFrame(step);
        return;
      }
      lastTs = ts;
      ctx.clearRect(0, 0, width, height);
      if (shouldAnimate) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }
      }

      ctx.fillStyle = "#8cdaf3";
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, isCompact ? 1.5 : 2, 0, Math.PI * 2);
        ctx.fill();
        if (shouldDrawConnections) {
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              ctx.strokeStyle = `rgba(140,218,243,${(1 - dist / maxDist) * (isCompact ? 0.35 : 0.6)})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
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
      width = el.offsetWidth;
      height = el.offsetHeight;
      applyCanvasSize();
      if (!shouldAnimate) {
        step(performance.now());
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    if (shouldAnimate) {
      frame = requestAnimationFrame(step);
    } else {
      step(performance.now());
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none bg-transparent"
    />
  );
}
