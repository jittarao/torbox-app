import { describe, it, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

mock.module('@/components/shared/OverlayPortal', () => ({
  __esModule: true,
  default: ({ children, open }) => (open ? (children ?? null) : null),
}));

const { default: ModalSheet } = await import('../ModalSheet');

describe('ModalSheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses a portaled div dialog (not native <dialog>/showModal) so WKWebView/Tauri can paint content', () => {
    render(
      <ModalSheet open onClose={() => {}} aria-labelledby="modal-sheet-title">
        <h2 id="modal-sheet-title">Manage tags</h2>
        <p>Delete confirmation copy</p>
        <button type="button">Delete</button>
      </ModalSheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'Manage tags' });
    expect(dialog.tagName).toBe('DIV');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('dialog')).toBeNull();
    expect(screen.getByText('Delete confirmation copy')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    render(
      <ModalSheet open={false} onClose={() => {}}>
        <p>Hidden</p>
      </ModalSheet>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});
