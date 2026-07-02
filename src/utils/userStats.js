export function getUserStatsErrorMessage(data, fallback) {
  if (data.error && data.error !== 'UNKNOWN_ERROR') {
    return data.error;
  }
  return data.detail || data.error || fallback;
}

export async function fetchUserStats(apiKey, { grouping = 'week', signal } = {}) {
  const params = new URLSearchParams({
    bandwidth: 'true',
    bandwidth_grouping: grouping,
  });

  const response = await fetch(`/api/user/stats?${params.toString()}`, {
    headers: { 'x-api-key': apiKey },
    signal,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(getUserStatsErrorMessage(data, 'Failed to load stats'));
  }

  return data.data || {};
}
