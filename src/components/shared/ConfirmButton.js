import { useState, useRef, useEffect } from 'react';
import Spinner from './Spinner';

const CircularProgress = ({ progress }) => (
  <div className="absolute inset-0 w-full h-full">
    <svg className="w-full h-full -rotate-90">
      <circle
        className="text-red-200 dark:text-red-900"
        strokeWidth="2"
        stroke="currentColor"
        fill="transparent"
        r="8"
        cx="12"
        cy="12"
      />
      <circle
        className="text-red-500 dark:text-red-400 transition-all duration-100"
        strokeWidth="2"
        strokeDasharray={50}
        strokeDashoffset={50 * (1 - progress)}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r="8"
        cx="12"
        cy="12"
      />
    </svg>
  </div>
);

export default function ConfirmButton({
  onClick,
  isLoading = false,
  confirmIcon,
  defaultIcon,
  className = '',
  title,
  timeout = 2000,
  isMobile = false,
  mobileText = '',
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isConfirming) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const currentProgress = (Date.now() - startTime) / timeout;
        if (currentProgress >= 1) {
          clearInterval(interval);
          setIsConfirming(false);
        } else {
          setProgress(currentProgress);
        }
      }, 16);

      timeoutRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, timeout);

      return () => {
        clearInterval(interval);
        clearTimeout(timeoutRef.current);
        setProgress(0);
      };
    }
  }, [isConfirming, timeout]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = async (e) => {
    e.stopPropagation();

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
      onClick={handleClick}
      disabled={isLoading}
      className={`${className} ${isConfirming ? 'scale-110' : ''}`}
      title={isConfirming ? 'Click again to confirm' : title}
    >
      <div className="relative w-6 h-6 flex items-center justify-center">
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {isConfirming && <CircularProgress progress={progress} />}
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
      {isMobile && <span className="ml-2 text-xs">{mobileText}</span>}
    </button>
  );
}
