const ENDPOINTS = {
  api: "https://api.ascendara.app/health",
  storage: "https://cdn.ascendara.app/health",
  lfs: "https://lfs.ascendara.app/health",
};

const checkEndpoint = async url => {
  try {
    console.log(`Checking endpoint ${url}...`);
    const response = await window.electron.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Client": "launcher-status-check",
      },
      timeout: 5000,
    });

    console.log(`Response from ${url}:`, response);

    if (response.ok) {
      return {
        ok: true,
        data:
          typeof response.data === "string" ? JSON.parse(response.data) : response.data,
      };
    }
    return { 
      ok: false,
      error: `Service Unavailable (${response.status})`,
    };
  } catch (error) {
    console.warn(`Failed to check ${url}:`, error);
    return { 
      ok: false,
      error: 'Service Unreachable'
    };
  }
};

const checkInternetConnectivity = async () => {
  try {
    // Try to fetch a reliable external resource
    const response = await window.electron.request("https://www.google.com/", {
      method: "HEAD",
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    console.warn("Internet connectivity check failed:", error);
    return false;
  }
};

// Singleton state
let currentStatus = {
  ok: true, // Start optimistically
  noInternet: false,
  api: { ok: true },
  storage: { ok: true },
  lfs: { ok: true },
};
let lastCheck = null;
let checkInterval = null;
let subscribers = new Set();

const CACHE_DURATION = 10000; // 10 seconds

export const checkServerStatus = async (force = false) => {
  // Return cached status if available and not forced
  if (!force && currentStatus && lastCheck && Date.now() - lastCheck < CACHE_DURATION) {
    return currentStatus;
  }

  try {
    // First check internet connectivity
    const isOnline = await checkInternetConnectivity();

    // If no internet, update and return that status
    if (!isOnline) {
      currentStatus = {
        ok: false,
        noInternet: true,
        api: { ok: false, error: 'No internet connection' },
        storage: { ok: false, error: 'No internet connection' },
        lfs: { ok: false, error: 'No internet connection' },
      };
      lastCheck = Date.now();
      notifySubscribers();
      return currentStatus;
    }

    // We have internet, check all services
    const results = await Promise.all([
      checkEndpoint(ENDPOINTS.api),
      checkEndpoint(ENDPOINTS.storage),
      checkEndpoint(ENDPOINTS.lfs),
    ]);

    currentStatus = {
      ok: results.every(r => r.ok),
      noInternet: false,
      api: results[0],
      storage: results[1],
      lfs: results[2],
    };

    lastCheck = Date.now();
    notifySubscribers();
    return currentStatus;
  } catch (error) {
    console.error("Error checking server status:", error);
    // Don't update status on error, keep previous status
    return currentStatus;
  }
};

// Function to notify all subscribers of status changes
const notifySubscribers = () => {
  subscribers.forEach(callback => callback(currentStatus));
};

// Subscribe to status updates
export const subscribeToStatus = callback => {
  subscribers.add(callback);
  // Return unsubscribe function
  return () => subscribers.delete(callback);
};

// Start the status check interval
export const startStatusCheck = (interval = 30000) => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Do an immediate check
  checkServerStatus(true).catch(console.error);

  checkInterval = setInterval(() => {
    checkServerStatus(true).catch(console.error);
  }, interval);

  return () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  };
};

// Get the current status without checking
export const getCurrentStatus = () => currentStatus;
