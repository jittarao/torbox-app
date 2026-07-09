'use client';

import { useState, useRef, useEffect } from 'react';
import Spinner from './Spinner';

const CIRCLE_RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const CircularProgress = ({ duration }) => (
  <div className="absolute inset-0 w-full h-full">
    <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
      <circle
        className="text-red-200 dark:text-red-900"
        strokeWidth="2"
        stroke="currentColor"
        fill="transparent"
        r={CIRCLE_RADIUS}
        cx="12"
        cy="12"
      />
      <circle
        className="text-red-500 dark:text-red-400"
        strokeWidth="2"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={CIRCLE_RADIUS}
        cx="12"
        cy="12"
      >
        <animate
          attributeName="stroke-dashoffset"
          from={CIRCUMFERENCE}
          to="0"
          dur={`${duration}ms`}
          fill="freeze"
        />
      </circle>
    </svg>
  </div>
);

export default function ConfirmButton({
  onClick,
  isLoading = false,
  disabled = false,
  confirmIcon,
  defaultIcon,
  className = '',
  title,
  timeout = 2000,
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isConfirming) return;

    timeoutRef.current = setTimeout(() => {
      setIsConfirming(false);
    }, timeout);

    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [isConfirming, timeout]);

  useEffect(() => {
    const timer = timeoutRef.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleConfirmClick = async (e) => {
    e.stopPropagation();

    if (disabled) return;

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    clearTimeout(timeoutRef.current);
    setIsConfirming(false);
    onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleConfirmClick}
      disabled={isLoading || disabled}
      className={`${className} ${isConfirming ? 'scale-110' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isConfirming ? 'Click again to confirm' : title}
    >
      <div className="relative size-6 flex items-center justify-center">
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {isConfirming && <CircularProgress duration={timeout} />}
            <div
              className={`relative z-10 transition-transform duration-200 ${
                isConfirming ? 'scale-90' : ''
              }`}
            >
              {isConfirming ? confirmIcon : defaultIcon}
            </div>
          </>
        )}
      </div>
    </button>
  );
}
