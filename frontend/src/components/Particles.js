import React, { useEffect, useRef } from 'react';

/**
 * Slow-motion pastel particles floating in a container.
 * Reacts to the "caret" — i.e. the last mouse/touch coordinate —
 * so particles drift gently toward or away from the cursor.
 */
const COLORS = ['#FFB6C1', '#ADD8E6', '#DDA0DD', '#FFE4E1', '#B0E0E6'];

const Particles = ({ density = 28 }) => {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: -9999, y: -9999, moved: false });
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particlesRef.current = Array.from({ length: density }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2, // slow motion
        vy: (Math.random() - 0.5) * 0.2,
        r: 3 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.35 + Math.random() * 0.35
      }));
    };

    resize();
    seed();

    const handlePointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0];
      const cx = (touch ? touch.clientX : e.clientX) - rect.left;
      const cy = (touch ? touch.clientY : e.clientY) - rect.top;
      pointerRef.current = { x: cx, y: cy, moved: true };
    };

    const parent = canvas.parentElement;
    parent?.addEventListener('mousemove', handlePointer);
    parent?.addEventListener('touchmove', handlePointer, { passive: true });
    window.addEventListener('resize', resize);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      const p = pointerRef.current;
      for (const particle of particlesRef.current) {
        // gentle drift
        particle.x += particle.vx;
        particle.y += particle.vy;

        // react to caret (cursor) — very slow attraction
        if (p.moved) {
          const dx = p.x - particle.x;
          const dy = p.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          if (dist < 160) {
            const pull = (160 - dist) / 160 * 0.02; // slow-motion pull
            particle.vx += (dx / dist) * pull;
            particle.vy += (dy / dist) * pull;
          }
        }

        // damping — keep motion smooth and slow
        particle.vx *= 0.96;
        particle.vy *= 0.96;

        // soft idle drift
        particle.vx += (Math.random() - 0.5) * 0.008;
        particle.vy += (Math.random() - 0.5) * 0.008;

        // wrap edges
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        ctx.beginPath();
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      parent?.removeEventListener('mousemove', handlePointer);
      parent?.removeEventListener('touchmove', handlePointer);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="particles-canvas" />;
};

export default Particles;
