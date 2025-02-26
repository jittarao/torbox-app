'use client';

export default function AssetTypeTabs({ activeType, onTypeChange }) {
  const tabs = [
    {
      id: 'torrents',
      label: 'Torrents',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="rotate-[135deg]"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" />
          <path d="m5 8 4 4" />
          <path d="m12 15 4 4" />
        </svg>
      ),
    },
    {
      id: 'usenet',
      label: 'Usenet',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="4.5" r="2.5" />
          <path d="m10.2 6.3-3.9 3.9" />
          <circle cx="4.5" cy="12" r="2.5" />
          <path d="M7 12h10" />
          <circle cx="19.5" cy="12" r="2.5" />
          <path d="m13.8 17.7 3.9-3.9" />
          <circle cx="12" cy="19.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: 'webdl',
      label: 'Web Downloads',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 13v8l-4-4" />
          <path d="m12 21 4-4" />
          <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
        </svg>
      ),
    },
  ];

  return (
    <div className="border-b border-border dark:border-border-dark">
      <nav className="-mb-px flex justify-center space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTypeChange(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1
              ${
                activeType === tab.id
                  ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                  : 'border-transparent text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:border-border dark:hover:border-border-dark'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
