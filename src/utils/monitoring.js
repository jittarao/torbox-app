// Security monitoring for cross-user data detection

export const logSecurityEvent = (event, details = {}) => {
  if (!details || typeof details !== 'object') {
    details = {};
  }
  
  const safeDetails = {
    ...details,
    authIds: details.authIds && Array.isArray(details.authIds) 
      ? details.authIds.map(id => id && typeof id === 'string' ? id.substring(0, 8) + '...' : id) 
      : details.authIds,
    owners: details.owners && Array.isArray(details.owners)
      ? details.owners.map(id => id && typeof id === 'string' ? id.substring(0, 8) + '...' : id)
      : details.owners,
    apiKey: details.apiKey && typeof details.apiKey === 'string' 
      ? details.apiKey.substring(0, 8) + '...' 
      : details.apiKey
  };
  console.error(`SECURITY EVENT: ${event}`, safeDetails);
};

export const detectCrossUserData = (items, apiKey) => {
  if (!items || !Array.isArray(items)) return false;
  
  const authIds = [...new Set(items.map(item => item?.auth_id).filter(Boolean))];
  
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
