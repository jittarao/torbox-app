const ShieldIcon = ({ className = 'h-4 w-4' }) => (
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
      d="M12 3l7 3v5c0 4.5-2.9 8.7-7 10-4.1-1.3-7-5.5-7-10V6l7-3z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
  </svg>
);

export default ShieldIcon;
