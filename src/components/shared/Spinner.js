export default function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <progress
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent appearance-none [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-transparent [&::-moz-progress-bar]:bg-transparent ${sizeClasses[size]} ${className}`}
      aria-label="Loading…"
    />
  );
}
