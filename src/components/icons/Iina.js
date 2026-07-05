/** IINA app icon (play + pause marks). */
const IinaIcon = ({ className = 'h-5 w-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 512 512"
    role="img"
    aria-label="IINA"
  >
    <defs>
      <linearGradient id="iina-play" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2B7BFF" />
        <stop offset="100%" stopColor="#29E0D6" />
      </linearGradient>
      <linearGradient id="iina-pause" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B03EFF" />
        <stop offset="100%" stopColor="#5448FF" />
      </linearGradient>
    </defs>
    <path
      fill="url(#iina-play)"
      d="M214 112c0-14 11-22 25-14l191 142c8 6 8 26 0 32L239 414c-14 8-25 0-25-14Z"
    />
    <rect x="104" y="182" width="36" height="128" rx="18" fill="url(#iina-pause)" />
    <rect x="154" y="150" width="46" height="192" rx="23" fill="url(#iina-pause)" />
  </svg>
);

export default IinaIcon;
