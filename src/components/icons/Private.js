const PrivateIcon = ({ className = 'h-4 w-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 11h20" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 18a2 2 0 0 0-4 0" />
    <circle cx="7" cy="18" r="3" strokeWidth={2} />
    <circle cx="17" cy="18" r="3" strokeWidth={2} />
  </svg>
);

export default PrivateIcon;
