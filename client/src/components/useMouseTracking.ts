import { RefObject, useEffect, useState } from 'react';

type TrackingPoint = {
  x: number;
  y: number;
  speed: number;
  alert: boolean;
  active: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceToRect(x: number, y: number, rect: DOMRect) {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

export function useMouseTracking(stageRef: RefObject<HTMLElement>, alertSelector = '[data-login-action="primary"]') {
  const [tracking, setTracking] = useState<TrackingPoint>({ x: 0, y: 0, speed: 0, alert: false, active: false });

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let frame = 0;
    let lastMoveAt = 0;
    let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let current = { x: 0, y: 0, speed: 0, alert: false, active: false };
    let target = current;

    const updateTarget = (clientX: number, clientY: number) => {
      const box = stageRef.current?.getBoundingClientRect();
      if (!box) return;
      const centerX = box.left + box.width * 0.5;
      const centerY = box.top + box.height * 0.46;
      const movement = Math.hypot(clientX - lastPointer.x, clientY - lastPointer.y);
      lastPointer = { x: clientX, y: clientY };
      lastMoveAt = Date.now();
      const alertTarget = document.querySelector(alertSelector);
      const alertRect = alertTarget?.getBoundingClientRect();
      const isAlert = alertRect ? distanceToRect(clientX, clientY, alertRect) < 150 : false;
      target = {
        x: clamp((clientX - centerX) / (box.width * 0.36), -1, 1),
        y: clamp((clientY - centerY) / (box.height * 0.32), -1, 1),
        speed: clamp(movement / 42, 0, 1),
        alert: isAlert,
        active: true
      };
    };

    const onMouseMove = (event: MouseEvent) => updateTarget(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updateTarget(touch.clientX, touch.clientY);
    };

    const animate = () => {
      const idle = Date.now() - lastMoveAt > 1800;
      const ease = target.alert ? 0.22 : 0.15;
      current = {
        x: current.x + (target.x - current.x) * ease,
        y: current.y + (target.y - current.y) * ease,
        speed: current.speed + ((idle ? 0 : target.speed) - current.speed) * 0.12,
        alert: target.alert,
        active: !idle
      };
      setTracking(current);
      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.cancelAnimationFrame(frame);
    };
  }, [alertSelector, stageRef]);

  return tracking;
}
