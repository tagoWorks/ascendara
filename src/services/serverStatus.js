const ENDPOINTS = {
  api: 'https://api.ascendara.app/health',
  storage: 'https://cdn.ascendara.app/health',
  lfs: 'https://lfs.ascendara.app/health'
};

const checkEndpoint = async (url) => {
  try {
    console.log(`Checking endpoint ${url}...`);
    const response = await window.electron.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Client': 'launcher-status-check'
      },
      timeout: 5000
    });
    
    console.log(`Response from ${url}:`, response);
    
    if (response.ok) {
      return {
        ok: true,
        data: typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      };
    }
    return { ok: false };
  } catch (error) {
    console.warn(`Failed to check ${url}:`, error);
    return { ok: false };
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
        isOffline: true,
        indexStatus: 'unknown'
      };
    }

    const results = await Promise.all(
      Object.entries(ENDPOINTS).map(async ([service, url]) => {
        const status = await checkEndpoint(url);
        return { service, status };
      })
    );

    const downServices = results
      .filter(({ status }) => !status.ok)
      .map(({ service }) => service);

    const apiResult = results.find(r => r.service === 'api');
    console.log('API Result:', apiResult);
    const apiStatus = apiResult?.status?.data;
    console.log('API Status:', apiStatus);

    if (!apiStatus) {
      console.warn('API status not found in response');
      return {
        isHealthy: false,
        downServices: [...downServices, 'api'],
        isOffline: false,
        indexStatus: 'unknown',
        version: '0.0',
        endpoint: 'unknown'
      };
    }

    return {
      isHealthy: downServices.length === 0,
      downServices,
      isOffline: false,
      indexStatus: apiStatus.status === 'updatingIndex' ? 'updating' : 'ready',
      version: apiStatus.version,
      endpoint: apiStatus.endpoint
    };
  } catch (error) {
    console.error('Error checking server status:', error);
    return {
      isHealthy: false,
      downServices: ['unknown'],
      isOffline: true,
      indexStatus: 'unknown'
    };
  }
};