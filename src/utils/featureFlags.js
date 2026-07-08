import { NextResponse } from 'next/server';

function isTruthyEnv(value) {
  const v = value?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Whether the dedicated search page and nav entry should be hidden (self-host opt-out).
 * Set SEARCH_PAGE_DISABLED=true in the environment.
 */
export function isSearchPageDisabled() {
  return isTruthyEnv(process.env.SEARCH_PAGE_DISABLED);
}

export function isOnboardingAuxActive() {
  return isTruthyEnv(process.env.ONBOARDING_AUX);
}

export function getSearchPageDisabledResponse(
  message = 'Search page is disabled on this instance'
) {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}
