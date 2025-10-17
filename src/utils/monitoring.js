// Security monitoring for cross-user data detection

export const logSecurityEvent = (event, details) => {
  const safeDetails = {
    ...details,
    authIds: details.authIds ? details.authIds.map(id => id.substring(0, 8) + '...') : details.authIds,
    owners: details.owners ? details.owners.map(id => id.substring(0, 8) + '...') : details.owners,
    apiKey: details.apiKey ? details.apiKey.substring(0, 8) + '...' : details.apiKey
  };
  console.error(`SECURITY EVENT: ${event}`, safeDetails);
};

export const detectCrossUserData = (items, apiKey) => {
  if (!items || !Array.isArray(items)) return false;
  
  const authIds = [...new Set(items.map(item => item.auth_id))];
  
  if (authIds.length > 1) {
    logSecurityEvent('cross_user_data_detected', {
      authIds: authIds,
      apiKey: apiKey,
      itemCount: items.length,
      authIdCount: authIds.length,
      timestamp: new Date().toISOString()
    });
    return true;
  }
  return false;
};

export const validateUserData = (data, apiKey) => {
  if (!data || !Array.isArray(data)) return false;
  
  detectCrossUserData(data, apiKey);
  return true;
};
