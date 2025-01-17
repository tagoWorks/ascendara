const ENDPOINTS = {
  api: 'https://api.ascendara.app/health',
  storage: 'https://cdn.ascendara.app/health',
  lfs: 'https://lfs.ascendara.app/health'
};

const checkEndpoint = async (url) => {
  try {
    const response = await window.electron.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Client': 'launcher-status-check'
      },
      timeout: 5000
    });
    
    return response.ok;
  } catch (error) {
    console.warn(`Failed to check ${url}:`, error);
    return false;
  }
};

const checkInternetConnectivity = async () => {
  try {
    // Try to fetch a reliable external resource
    const response = await window.electron.request('https://www.google.com/', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.warn('Internet connectivity check failed:', error);
    return false;
  }
};

export const checkServerStatus = async () => {
  try {
    // First check internet connectivity
    const isOnline = await checkInternetConnectivity();
    if (!isOnline) {
      return {
        isHealthy: false,
        downServices: ['internet'],
        isOffline: true
      };
    }

    const results = await Promise.all(
      Object.entries(ENDPOINTS).map(async ([key, url]) => {
        const isUp = await checkEndpoint(url);
        return { service: key, isUp };
      })
    );

    return {
      isHealthy: results.every(result => result.isUp),
      downServices: results.filter(result => !result.isUp).map(service => service.service),
      isOffline: false
    };
  } catch (error) {
    console.error('Error checking server status:', error);
    return {
      isHealthy: false,
      downServices: ['Unknown error occurred'],
      isOffline: false
    };
  }
};