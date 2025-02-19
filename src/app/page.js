'use client';
import { useState } from 'react';
import ApiKeyInput from '../components/ApiKeyInput';
import TorrentTable from '../components/TorrentTable';
import TorrentUploader from '../components/TorrentUploader';

export default function Home() {
  const [apiKey, setApiKey] = useState('');

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl mb-4">Torbox Manager</h1>
      <ApiKeyInput onKeyChange={setApiKey} />
      {apiKey && (
        <>
          <TorrentUploader apiKey={apiKey} />
          <TorrentTable apiKey={apiKey} />
        </>
      )}
    </main>
  );
}
