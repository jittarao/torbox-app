import { describe, expect, test } from 'bun:test';
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
});
