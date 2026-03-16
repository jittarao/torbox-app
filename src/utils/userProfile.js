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
 * Check if user has Pro plan (plan_id === 2)
 * @param {Object} userData - User profile data
 * @returns {boolean} - True if user has Pro plan
 */
export function hasProPlan(userData) {
  if (!userData || userData.plan == null) {
    return false;
  }

  // Plan ID 2 is Pro plan
  const planId = typeof userData.plan === 'object' ? userData.plan?.id : userData.plan;
  return planId === 2;
}

/**
 * Build a permissions object for the current user.
 * This centralizes feature access decisions so components can stay generic.
 * @param {Object} userData - User profile data
 * @returns {Object} - Permissions map
 */
export function getUserPermissions(userData) {
  const isPro = hasProPlan(userData);

  return {
    planId: typeof userData?.plan === 'object' ? userData.plan?.id : userData?.plan ?? null,
    isPro,
    downloads: {
      torrents: true,
      webdl: true,
      usenet: isPro,
    },
  };
}

/**
 * Generic helper to check download-type access.
 * @param {string} type - 'torrents' | 'usenet' | 'webdl'
 * @param {Object|null} permissions - Permissions object from getUserPermissions
 * @returns {boolean}
 */
export function hasDownloadAccess(type, permissions) {
  if (!permissions || !permissions.downloads) return false;
  return Boolean(permissions.downloads[type]);
}

/**
 * Check if user can use usenet downloads (requires Pro plan, plan_id === 2)
 * @param {Object} userData - User profile data
 * @returns {boolean} - True if user has access to usenet
 */
export function canUseUsenet(userData) {
  return hasProPlan(userData);
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
