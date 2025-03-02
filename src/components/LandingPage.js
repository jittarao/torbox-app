import ApiKeyInput from './downloads/ApiKeyInput';

export default function LandingPage({ onKeyChange }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
            TorBox Manager
          </h1>
          <p className="text-2xl mb-12 text-gray-300 font-light">
            The power user's alternative to TorBox UI. Built for speed and
            efficiency.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="p-8 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl">
              <div className="w-12 h-12 mb-4 mx-auto text-blue-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zm6.905 9.97a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72V18a.75.75 0 001.5 0v-5.19l1.72 1.72a.75.75 0 101.06-1.06l-3-3z"
                    clipRule="evenodd"
                  />
                  <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-blue-400">
                Batch Upload
              </h3>
              <p className="text-gray-300">
                Upload multiple torrents with a single click
              </p>
            </div>
            <div className="p-8 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl">
              <div className="w-12 h-12 mb-4 mx-auto text-violet-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-violet-400">
                Smart Downloads
              </h3>
              <p className="text-gray-300">
                Cherry-pick specific files across multiple torrents
              </p>
            </div>
            <div className="p-8 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl">
              <div className="w-12 h-12 mb-4 mx-auto text-indigo-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 00-3.471 2.987 10.04 10.04 0 014.815 4.815 18.748 18.748 0 002.987-3.471l3.386-5.08A1.902 1.902 0 0020.599 1.5zm-8.3 14.025a18.76 18.76 0 001.896-1.207 8.026 8.026 0 00-4.513-4.513A18.75 18.75 0 008.475 11.7l-.278.5a5.26 5.26 0 013.601 3.602l.502-.278zM6.75 13.5A3.75 3.75 0 003 17.25a1.5 1.5 0 01-1.601 1.497.75.75 0 00-.7 1.123 5.25 5.25 0 009.8-2.62 3.75 3.75 0 00-3.75-3.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-indigo-400">
                Your Workflow
              </h3>
              <p className="text-gray-300">
                Customize the interface to match your needs
              </p>
            </div>
          </div>

          <div className="max-w-md mx-auto p-8 bg-gray-800/30 backdrop-blur border border-gray-700/50 rounded-xl">
            <h2 className="text-2xl font-bold mb-6 text-white">
              Enter your API key to begin
            </h2>
            <ApiKeyInput onKeyChange={onKeyChange} />
            <p className="mt-4 text-sm text-gray-400">
              Find your API key at{' '}
              <a
                href="https://torbox.app/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                torbox.app/settings
              </a>
            </p>
          </div>

          <footer className="mt-12 text-sm text-gray-400">
            <p>
              We don't store any of your information. This app is fully open
              source on{' '}
              <a
                href="https://github.com/jittarao/torbox-app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                GitHub
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
