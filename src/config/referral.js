import {
  buildTorboxSignupReferralUrl,
  buildTorboxSubscriptionReferralUrl,
} from '@/utils/referralLinks';

const DEFAULT_REFERRAL_CODE = '7908ea44-023c-45f5-86ce-564bc6edaf34';

export const REFERRAL_CODE = (
  process.env.NEXT_PUBLIC_TORBOX_REFERRAL_CODE || DEFAULT_REFERRAL_CODE
).trim();

export const REFERRAL_LINK = buildTorboxSubscriptionReferralUrl(REFERRAL_CODE);
export const REFERRAL_SIGNUP_LINK = buildTorboxSignupReferralUrl(REFERRAL_CODE);
