import { useEffect, useRef, useState } from 'react';

type SnakeMascotProps = {
  biting?: boolean;
};

export default function SnakeMascot({ biting = false }: SnakeMascotProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    let target = { x: 0, y: 0 };

    const updateTarget = (event: MouseEvent) => {
      const box = shellRef.current?.getBoundingClientRect();
      if (!box) return;
      const centerX = box.left + box.width / 2;
      const centerY = box.top + box.height / 2;
      target = {
        x: Math.max(-1, Math.min(1, (event.clientX - centerX) / (box.width * 0.42))),
        y: Math.max(-1, Math.min(1, (event.clientY - centerY) / (box.height * 0.42)))
      };
    };

    const animate = () => {
      setLook((current) => ({
        x: current.x + (target.x - current.x) * 0.14,
        y: current.y + (target.y - current.y) * 0.14
      }));
      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', updateTarget, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', updateTarget);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={shellRef} className={`snake-stage ${biting ? 'snake-stage-bite' : ''}`} aria-hidden="true">
      <div className="snake-glow" />
      <div
        className="snake-image-wrap"
        style={{
          transform: `translate3d(${look.x * 14}px, ${look.y * 10}px, 0) rotateX(${-look.y * 4}deg) rotateY(${look.x * 6}deg)`
        }}
      >
        <img className="snake-image" src="/login-snake.png" alt="" />
        <div
          className="snake-eye-glow snake-eye-glow-left"
          style={{ transform: `translate(${look.x * 10}px, ${look.y * 8}px)` }}
        />
        <div
          className="snake-eye-glow snake-eye-glow-right"
          style={{ transform: `translate(${look.x * 10}px, ${look.y * 8}px)` }}
        />
      </div>
      <div className="snake-bite-flash">Access granted</div>
    </div>
  );
}
