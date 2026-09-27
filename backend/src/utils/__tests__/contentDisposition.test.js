import { describe, expect, test } from 'bun:test';
import {
  buildAttachmentContentDisposition,
  default as defaultExport,
} from '../contentDisposition.js';

describe('buildAttachmentContentDisposition', () => {
  test('keeps ASCII filenames intact', () => {
    expect(buildAttachmentContentDisposition('Example.torrent')).toBe(
      `attachment; filename="Example.torrent"; filename*=UTF-8''Example.torrent`
    );
  });

  test('encodes non-ASCII filenames without leaking invalid header chars', () => {
    const header = buildAttachmentContentDisposition('Thu Phương - Top Hits - 2022 (WAV).torrent');

    // Header value must be ASCII-safe (Node rejects non-latin1 header content).
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]*$/.test(header)).toBe(true);
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent('Thu Phương').replace(/'/g, '%27'));
  });

  test('strips CR/LF to prevent header injection', () => {
    const header = buildAttachmentContentDisposition('bad\r\nSet-Cookie: x=1.torrent');
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });

  test('falls back when filename is empty', () => {
    expect(buildAttachmentContentDisposition('')).toContain('filename="download"');
    expect(defaultExport).toBe(buildAttachmentContentDisposition);
  });
});
