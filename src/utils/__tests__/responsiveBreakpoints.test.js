import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MOBILE_MEDIA_QUERY, DESKTOP_MD_MEDIA_QUERY } from '@/utils/responsiveBreakpoints';

describe('responsiveBreakpoints', () => {
  test('exports stable mobile and desktop md query strings', () => {
    expect(MOBILE_MEDIA_QUERY).toBe(
      '(max-width: 767px), (max-height: 500px) and (orientation: landscape)'
    );
    expect(DESKTOP_MD_MEDIA_QUERY).toBe(
      '(min-width: 768px) and ((min-height: 501px) or (orientation: portrait))'
    );
  });

  test('globals.css md variant matches DESKTOP_MD_MEDIA_QUERY', () => {
    const globalsPath = join(process.cwd(), 'src/app/globals.css');
    const css = readFileSync(globalsPath, 'utf8');
    expect(css).toContain(`@media ${DESKTOP_MD_MEDIA_QUERY}`);
  });
});
