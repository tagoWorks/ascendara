import axios from 'axios';

let sessionId = null;
let lastInteractionTime = Date.now();
let sessionStartTime = Date.now();
let analyticsKey = null;

async function getSettings() {
    try {
        return await window.electron.getSettings();
    } catch (error) {
        console.error('Error getting settings:', error);
        return { sendAnalytics: false };
    }
}

async function getAnalyticsKey() {
    if (!analyticsKey) {
        analyticsKey = await window.electron.getAnalyticsKey();
    }
    return analyticsKey;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateHardwareId() {
    const storageKey = 'ascendara_hardware_id';
    let hardwareId = localStorage.getItem(storageKey);
    
    if (!hardwareId) {
        // Generate a new hardware ID if none exists
        hardwareId = 'hw-' + generateUUID();
        localStorage.setItem(storageKey, hardwareId);
    }
    
    return hardwareId;
}

async function getSystemInfo() {
    try {
        const info = {
            platform: navigator.platform || 'unknown',
            appVersion: window.electron?.appVersion || 'unknown',
            environment: import.meta.env.MODE || 'production',
            userAgent: navigator.userAgent || 'unknown',
            screenResolution: window.screen ? `${window.screen.width}x${window.screen.height}` : 'unknown',
            hardwareId: generateHardwareId(),
            // Optional fields that might not be available in all browsers
            memoryUsage: window.performance?.memory?.usedJSHeapSize,
            deviceMemory: navigator.deviceMemory,
            hardwareConcurrency: navigator.hardwareConcurrency,
            networkSpeed: navigator.connection?.downlink,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // Remove undefined values
        Object.keys(info).forEach(key => {
            if (info[key] === undefined) {
                delete info[key];
            }
        });

        return info;
    } catch (error) {
        console.error('Error getting system info:', error);
        // Return minimal required info
        return {
            platform: navigator.platform || 'unknown',
            appVersion: window.electron?.appVersion || 'unknown',
            environment: import.meta.env.MODE || 'production',
            userAgent: navigator.userAgent || 'unknown',
            hardwareId: generateHardwareId()
        };
    }
}

async function initSession() {
    try {
        sessionId = generateUUID();
        sessionStartTime = Date.now();
        
        const settings = await getSettings();
        if (!settings.sendAnalytics) return;

        const systemInfo = await getSystemInfo();
        const key = await getAnalyticsKey();
        
        if (!key) {
            console.error('Analytics key is missing');
            return;
        }

        const requestData = {
            timestamp: Date.now(),
            ...systemInfo
        };
        
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': key
            }
        };

        try {
            const response = await axios.post(
                'https://analytics.ascendara.app/api/analytics/session',
                requestData,
                requestConfig
            );
            
            console.log('Analytics response:', {
                status: response.status,
                data: response.data
            });
            
            sessionId = response.data.sessionId;
        } catch (error) {
            // Log detailed error information
            const errorDetails = {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                requestData: requestData,
                requestHeaders: requestConfig.headers
            };
            console.error('Error initializing analytics session:', errorDetails);
            return;
        }
    } catch (error) {
        console.error('Fatal error in analytics initialization:', error);
        return;
    }
}

async function trackEvent(eventName, additionalProperties = {}) {
    const settings = await getSettings();
    if (!settings.sendAnalytics) {
        console.log('Ascendara Analytics is disabled');
        return;
    }

    try {
        const currentSession = await initSession();
        const systemInfo = await getSystemInfo();
        const key = await getAnalyticsKey();
        
        const eventData = {
            event_name: eventName,
            session_id: currentSession,
            timestamp: Date.now(),
            properties: {
                ...systemInfo,
                ...additionalProperties,
                sessionDuration: Date.now() - sessionStartTime,
                timeSinceLastInteraction: Date.now() - lastInteractionTime,
                analyticsEnabled: settings.sendAnalytics
            }
        };

        await axios.post('https://analytics.ascendara.app/api/analytics/event', eventData, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': key
            }
        });

        lastInteractionTime = Date.now();
    } catch (error) {
        console.error('Error sending analytics event:', error);
        await trackError('ANALYTICS_ERROR', error);
    }
}

async function trackError(errorType, error) {
    const settings = await getSettings();
    if (!settings.sendAnalytics) return;

    try {
        const currentSession = await initSession();
        const systemInfo = await getSystemInfo();
        const key = await getAnalyticsKey();
        
        const errorData = {
            error_type: errorType,
            error_message: error.message || String(error),
            stack_trace: error.stack,
            session_id: currentSession,
            timestamp: Date.now(),
            properties: {
                ...systemInfo,
                sessionDuration: Date.now() - sessionStartTime
            }
        };

        await axios.post('https://analytics.ascendara.app/api/analytics/error', errorData, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': key
            }
        });
    } catch (err) {
        console.error('Error sending error analytics:', err);
    }
}

async function trackPageView(route) {
    await trackEvent('PAGE_VIEW', {
        pageName: route.split('/').pop() || 'home',
        route: route
    });
}

// Update interaction time on user activity
if (typeof window !== 'undefined') {
    window.addEventListener('click', () => lastInteractionTime = Date.now());
    window.addEventListener('keypress', () => lastInteractionTime = Date.now());
    window.addEventListener('mousemove', () => lastInteractionTime = Date.now());
    window.addEventListener('scroll', () => lastInteractionTime = Date.now());
}

export const analytics = {
    trackEvent,
    trackError,
    trackPageView,
    initSession
};

export {
    trackEvent,
    trackError,
    trackPageView,
    initSession
};