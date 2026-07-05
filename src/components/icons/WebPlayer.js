/** Browser window with play — web player option. */
const WebPlayerIcon = ({ className = 'h-5 w-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label="Web Player"
  >
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 8h18" />
    <circle cx="6" cy="6" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="6" r="0.75" fill="currentColor" stroke="none" />
    <polygon points="11.5,11 11.5,15 15.5,13" fill="currentColor" stroke="none" />
  </svg>
);

export default WebPlayerIcon;
