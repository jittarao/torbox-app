import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

mock.module('next-intl', () => ({
  useTranslations: (scope) => (key, params) => {
    let str = scope ? `${scope}.${key}` : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  },
}));

mock.module('@/components/shared/Tooltip', () => ({
  __esModule: true,
  default: ({ children }) => children ?? null,
}));

mock.module('@/components/shared/OverlayPortal', () => ({
  __esModule: true,
  default: ({ children, open }) => (open ? (children ?? null) : null),
}));

mock.module('@/components/shared/ModalSheetHandle', () => ({
  __esModule: true,
  default: () => <div data-testid="sheet-handle" />,
}));

const { default: DownloadPanel } = await import('../DownloadPanel');

const clipboardWriteText = mock(() => Promise.resolve());

function DownloadPanelHarness({
  initialOpen = false,
  downloadLinks = [],
  isDownloading = false,
  downloadProgress = { current: 0, total: 0 },
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [toast, setToast] = useState(null);

  return (
    <>
      <DownloadPanel
        downloadLinks={downloadLinks}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onDismiss={() => {}}
        setToast={setToast}
        isDownloadPanelOpen={isOpen}
        setIsDownloadPanelOpen={setIsOpen}
      />
      {toast && <div data-testid="toast">{toast.message}</div>}
    </>
  );
}

describe('DownloadPanel', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--download-panel-peek-height', '0px');
    clipboardWriteText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
    document.documentElement.style.setProperty('--download-panel-peek-height', '0px');
  });

  it('renders null when no links and not downloading', () => {
    render(<DownloadPanelHarness />);
    expect(screen.queryByRole('button', { name: 'DownloadPanel.aria.expand' })).toBeNull();
  });

  it('expands and collapses on header click', () => {
    render(
      <DownloadPanelHarness
        downloadLinks={[{ id: '1', url: 'https://example.com/file.mkv', name: 'file.mkv' }]}
      />
    );

    const header = screen.getByRole('button', { name: 'DownloadPanel.aria.expand' });
    expect(header.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(header);
    expect(screen.getByRole('button', { expanded: true }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    expect(screen.getByText('file.mkv')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(
      screen
        .getByRole('button', { name: 'DownloadPanel.aria.expand' })
        .getAttribute('aria-expanded')
    ).toBe('false');
  });

  it('collapses on Escape when open', () => {
    render(
      <DownloadPanelHarness
        initialOpen
        downloadLinks={[{ id: '1', url: 'https://example.com/file.mkv', name: 'file.mkv' }]}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows inline copied state for per-row copy without success toast', async () => {
    render(
      <DownloadPanelHarness
        initialOpen
        downloadLinks={[{ id: 'link-1', url: 'https://example.com/a.mkv', name: 'a.mkv' }]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'DownloadPanel.actions.copyLinkWithIndex' })
    );

    expect(
      await screen.findByRole('button', { name: 'DownloadPanel.actions.copied' })
    ).toBeTruthy();
    expect(screen.queryByTestId('toast')).toBeNull();
    expect(clipboardWriteText).toHaveBeenCalledWith('https://example.com/a.mkv');
  });

  it('copy all invokes clipboard and shows success toast', async () => {
    const setToast = mock(() => {});

    function PanelWithToast() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <DownloadPanel
          downloadLinks={[
            { id: '1', url: 'https://example.com/a.mkv', name: 'a.mkv' },
            { id: '2', url: 'https://example.com/b.mkv', name: 'b.mkv' },
          ]}
          isDownloading={false}
          downloadProgress={{ current: 2, total: 2 }}
          onDismiss={() => {}}
          setToast={setToast}
          isDownloadPanelOpen={isOpen}
          setIsDownloadPanelOpen={setIsOpen}
        />
      );
    }

    render(<PanelWithToast />);

    fireEvent.click(screen.getByRole('button', { name: 'DownloadPanel.actions.copyAll' }));

    await Promise.resolve();
    expect(clipboardWriteText).toHaveBeenCalledWith(
      'https://example.com/a.mkv\nhttps://example.com/b.mkv'
    );
    expect(setToast).toHaveBeenCalledWith({
      message: 'DownloadPanel.toast.linksCopied',
      type: 'success',
    });
  });

  it('sets peek height CSS variable while visible', () => {
    const { unmount } = render(
      <DownloadPanelHarness
        downloadLinks={[{ id: '1', url: 'https://example.com/file.mkv', name: 'file.mkv' }]}
      />
    );

    expect(document.documentElement.style.getPropertyValue('--download-panel-peek-height')).toBe(
      '4.5rem'
    );

    unmount();
    expect(document.documentElement.style.getPropertyValue('--download-panel-peek-height')).toBe(
      '0px'
    );
  });

  it('shows extension badge from URL filename when item name has no extension', () => {
    render(
      <DownloadPanelHarness
        initialOpen
        downloadLinks={[
          {
            id: '1',
            url: 'https://cdn.example.com/dl/abc?token=xyz&filename=My%20Movie.zip',
            name: 'My Movie',
          },
        ]}
      />
    );

    expect(screen.getByTitle('zip').textContent).toBe('ZIP');
  });

  it('shows extension badge from nested file path in name', () => {
    render(
      <DownloadPanelHarness
        initialOpen
        downloadLinks={[
          {
            id: '1',
            url: 'https://example.com/dl?id=1&filename=Season%201%2FEpisode.mkv',
            name: 'Season 1/Episode.mkv',
          },
        ]}
      />
    );

    expect(screen.getByTitle('mkv').textContent).toBe('MKV');
  });

  it('shows abbreviated compound extension badge for tar.gz files', () => {
    render(
      <DownloadPanelHarness
        initialOpen
        downloadLinks={[
          {
            id: '1',
            url: 'https://example.com/archive.tar.gz',
            name: 'archive.tar.gz',
          },
        ]}
      />
    );

    expect(screen.getByTitle('tar.gz').textContent).toBe('GZ');
  });
});
