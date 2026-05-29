import { describe, expect, test } from 'bun:test';
import {
  buildTorboxSignupReferralUrl,
  buildTorboxSubscriptionReferralUrl,
} from '@/utils/referralLinks';

const CODE = '7908ea44-023c-45f5-86ce-564bc6edaf34';

describe('referralLinks', () => {
  test('buildTorboxSubscriptionReferralUrl encodes referral query param', () => {
    const url = buildTorboxSubscriptionReferralUrl(CODE);
    expect(url).toBe(`https://torbox.app/subscription?referral=${encodeURIComponent(CODE)}`);
    expect(new URL(url).searchParams.get('referral')).toBe(CODE);
  });

  test('buildTorboxSignupReferralUrl preserves referral in next redirect', () => {
    const url = buildTorboxSignupReferralUrl(CODE);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/login');
    expect(parsed.searchParams.get('next')).toBe(`/subscription?referral=${CODE}`);
  });
});
