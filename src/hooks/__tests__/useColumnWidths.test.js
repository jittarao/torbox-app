import { describe, expect, test } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useColumnWidths } from '../useColumnWidths.js';
import { DEFAULT_COLUMN_WIDTHS } from '@/components/downloads/utils/tableColumnLayout';

describe('useColumnWidths', () => {
  test('reloads widths when activeType changes instead of keeping prior tab', () => {
    const { result, rerender } = renderHook(({ activeType }) => useColumnWidths(activeType), {
      initialProps: { activeType: 'torrents' },
    });

    act(() => {
      result.current.updateColumnWidth('progress', 220);
    });

    expect(result.current.columnWidths.progress).toBe(220);

    rerender({ activeType: 'usenet' });

    expect(result.current.columnWidths.progress).toBe(DEFAULT_COLUMN_WIDTHS.progress);
  });

  test('applies successive width updates without losing prior column changes', () => {
    const { result } = renderHook(() => useColumnWidths('torrents'));

    act(() => {
      result.current.updateColumnWidth('progress', 220);
      result.current.updateColumnWidth('name', 300);
    });

    expect(result.current.columnWidths.progress).toBe(220);
    expect(result.current.columnWidths.name).toBe(300);
  });
});
