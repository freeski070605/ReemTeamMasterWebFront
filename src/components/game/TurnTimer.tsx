import React, { useEffect, useMemo, useRef, useState } from "react";

interface TurnTimerProps {
  duration: number;
  timeRemaining: number;
  isActive: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const TIMER_VISUAL_REFRESH_MS = 100;

const TurnTimer: React.FC<TurnTimerProps> = ({
  duration,
  timeRemaining,
  isActive,
  size = 56,
  strokeWidth = 4,
  className,
}) => {
  const safeDuration = Math.max(1, duration);
  const [localRemaining, setLocalRemaining] = useState(Math.max(0, timeRemaining));
  const expiresAtRef = useRef(Date.now() + Math.max(0, timeRemaining));
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const remaining = Math.max(0, timeRemaining);
    setLocalRemaining(remaining);
    expiresAtRef.current = Date.now() + remaining;
  }, [timeRemaining, duration, isActive]);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isActive) {
      return;
    }

    const tick = () => {
      const next = Math.max(0, expiresAtRef.current - Date.now());
      setLocalRemaining(next);
      if (next <= 0 && intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, TIMER_VISUAL_REFRESH_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const progress = clamp(localRemaining / safeDuration, 0, 1);
  const dashOffset = circumference * (1 - progress);
  const strokeColor = !isActive
    ? "rgba(255,255,255,0.22)"
    : progress <= 0.2
      ? "rgba(251, 113, 133, 0.96)"
      : progress <= 0.45
        ? "rgba(250, 204, 21, 0.96)"
        : "rgba(52, 211, 153, 0.94)";

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
        className ?? ""
      }`}
      aria-hidden
    >
      <svg width={size} height={size} className="overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={isActive ? "transition-[stroke] duration-300" : ""}
        />
      </svg>
    </div>
  );
};

export default TurnTimer;
