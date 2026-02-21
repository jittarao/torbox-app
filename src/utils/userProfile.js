/**
 * User Profile Utilities
 * Functions for fetching and checking user profile information
 */

/**
 * Fetch user profile from API
 * @param {string} apiKey - User's API key
 * @returns {Promise<Object|null>} - User profile data or null on error
 */
export async function fetchUserProfile(apiKey) {
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('/api/user/me', {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Check if user has Pro plan (plan.id === 2)
 * @param {Object} userData - User profile data
 * @returns {boolean} - True if user has Pro plan
 */
export function hasProPlan(userData) {
  if (!userData || !userData.plan) {
    return false;
  }

  // Plan ID 2 is Pro plan
  return userData.plan === 2;
}

/**
 * Get plan name from plan ID
 * @param {number} planId - Plan ID
 * @param {Function} t - Translation function (optional)
 * @returns {string} - Plan name
 */
export function getPlanName(planId, t = null) {
  const planNames = {
    0: t ? t('plans.free') : 'Free',
    1: t ? t('plans.essential') : 'Essential',
    2: t ? t('plans.pro') : 'Pro',
    3: t ? t('plans.standard') : 'Standard',
  };

  return planNames[planId] || (t ? t('plans.unknown') : 'Unknown');
}
