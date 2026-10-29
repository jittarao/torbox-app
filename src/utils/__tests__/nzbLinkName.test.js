import { describe, expect, test } from 'bun:test';
import {
  ensureNzbFilename,
  filenameFromUrlPath,
  isPlaceholderNzbSlotName,
  parseContentDispositionFilename,
  resolveUsenetUploadNames,
  sanitizeDownloadBasename,
  stableNzbFallbackName,
} from '../nzbLinkName.js';

const NZBGEEK = 'https://api.nzbgeek.info/api?t=get&id=123456789&apikey=qwertyuiop';

describe('parseContentDispositionFilename', () => {
  test('prefers RFC 5987 filename* over a quoted filename', () => {
    const header =
      "attachment; filename=\"fallback.nzb\"; filename*=UTF-8''Movie%20Name.nzb";
    expect(parseContentDispositionFilename(header)).toBe('Movie Name.nzb');
  });

  test('decodes UTF-8 percent-encoding', () => {
    expect(parseContentDispositionFilename("attachment; filename*=utf-8''%E3%83%86%E3%82%B9%E3%83%88.nzb")).toBe(
      'テスト.nzb'
    );
  });

  test('reads a quoted filename', () => {
    expect(parseContentDispositionFilename('attachment; filename="My File.nzb"')).toBe('My File.nzb');
  });

  test('uses the next filename when an earlier one is unsafe', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="../.."; filename="Show.S01E01.nzb"')
    ).toBe('Show.S01E01.nzb');
  });

  test('does not concatenate duplicate filename parameters', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="a.nzb"; filename="b.nzb"')
    ).toBe('a.nzb');
  });

  test('drops an invalid header', () => {
    expect(parseContentDispositionFilename('attachment; filename=""')).toBeNull();
    expect(parseContentDispositionFilename('attachment')).toBeNull();
    expect(parseContentDispositionFilename('')).toBeNull();
  });
});

describe('sanitizeDownloadBasename', () => {
  test('keeps only the basename and strips query strings', () => {
    expect(sanitizeDownloadBasename('../../etc/Movie.nzb?apikey=secret')).toBe('Movie.nzb');
    expect(sanitizeDownloadBasename('C:\\temp\\Show.nzb')).toBe('Show.nzb');
    expect(sanitizeDownloadBasename('dir/sub/File.nzb')).toBe('File.nzb');
  });

  test('rejects empty, dot, and credential-looking names', () => {
    expect(sanitizeDownloadBasename('..')).toBeNull();
    expect(sanitizeDownloadBasename('.')).toBeNull();
    expect(sanitizeDownloadBasename('file.nzb?apikey=secret')).toBe('file.nzb');
    expect(sanitizeDownloadBasename('https://api.example/file.nzb')).toBe('file.nzb');
  });
});

describe('resolveUsenetUploadNames', () => {
  test('nzbgeek API links do not become httpsapi or leak the API key', () => {
    const names = resolveUsenetUploadNames({ sourceUrl: NZBGEEK });
    expect(names.slotName).not.toBe('httpsapi');
    expect(names.fileName).not.toContain('httpsapi');
    expect(names.slotName).not.toContain('qwertyuiop');
    expect(names.fileName).not.toContain('qwertyuiop');
    expect(names.slotName).not.toContain('?');
    expect(names.fileName).toMatch(/^nzb-[0-9a-f]{8}\.nzb$/);
    expect(filenameFromUrlPath(NZBGEEK)).toBeNull();
  });

  test('uses content-disposition after a redirect ahead of the original URL', () => {
    const names = resolveUsenetUploadNames({
      sourceUrl: NZBGEEK,
      finalUrl: 'https://cdn.example/dl/api',
      contentDisposition: "attachment; filename*=UTF-8''Movie.Name.2024.nzb",
      existingName: 'api.nzbgeek.info - NZB Download',
    });
    expect(names.slotName).toBe('Movie.Name.2024');
    expect(names.fileName).toBe('Movie.Name.2024.nzb');
  });

  test('uses the final URL basename when the header is missing', () => {
    const names = resolveUsenetUploadNames({
      sourceUrl: NZBGEEK,
      finalUrl: 'https://cdn.example/files/Real.Name.nzb',
    });
    expect(names.slotName).toBe('Real.Name');
    expect(names.fileName).toBe('Real.Name.nzb');
  });

  test('keeps a caller-supplied title and still names the file from the header', () => {
    const names = resolveUsenetUploadNames({
      sourceUrl: 'https://indexer.example/get/Other.nzb?apikey=secret',
      contentDisposition: 'attachment; filename="Real.Release.nzb"',
      existingName: 'Real Release Title',
    });
    expect(names.slotName).toBe('Real Release Title');
    expect(names.fileName).toBe('Real.Release.nzb');
    expect(names.fileName).not.toContain('secret');
  });

  test('is stable for the same link', () => {
    const first = resolveUsenetUploadNames({ sourceUrl: NZBGEEK });
    const second = resolveUsenetUploadNames({ sourceUrl: NZBGEEK });
    expect(second).toEqual(first);
    expect(stableNzbFallbackName(NZBGEEK)).toBe(stableNzbFallbackName(NZBGEEK));
  });

  test('treats generated and URL-derived names as placeholders', () => {
    expect(isPlaceholderNzbSlotName('Unknown')).toBe(true);
    expect(isPlaceholderNzbSlotName('httpsapi')).toBe(true);
    expect(isPlaceholderNzbSlotName('api.nzbgeek.info - NZB Download')).toBe(true);
    expect(isPlaceholderNzbSlotName(stableNzbFallbackName(NZBGEEK))).toBe(true);
    expect(isPlaceholderNzbSlotName('Real Release Title')).toBe(false);
  });
});

describe('ensureNzbFilename', () => {
  test('adds the nzb extension once', () => {
    expect(ensureNzbFilename('Movie.Name')).toBe('Movie.Name.nzb');
    expect(ensureNzbFilename('Movie.Name.nzb')).toBe('Movie.Name.nzb');
  });
});
