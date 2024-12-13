class AnalyticsService {
    constructor() {
        this.events = []
        this.sessionStartTime = Date.now()
        this.sessionId = this.generateSessionId()
        this.isEnabled = true  // Start enabled by default
        this.appVersion = '1.0.0'
        this.userAgent = window.navigator.userAgent
        this.lastInteraction = Date.now()
        this.analyticsEndpoint = 'https://analytics.ascendara.app'
        this.pendingEvents = []  // Store events during initialization
        this.isDev = process.env.NODE_ENV === 'development'
        this.initializationPromise = this.initialize()
    }

    async initialize() {
        try {
            const settings = await window.electron.getSettings()
            this.isEnabled = settings?.sendAnalytics === true 
            this.appVersion = await window.electron.getVersion()
            
            // Process any events that occurred during initialization
            if (this.isEnabled && this.pendingEvents.length > 0) {
                this.events.push(...this.pendingEvents)
                this.pendingEvents = []
                await this.flushEvents()
            } else if (!this.isEnabled) {
                this.pendingEvents = []  // Clear pending events if analytics are disabled
            }
        } catch (error) {
            console.error('Failed to initialize analytics:', error)
            this.isEnabled = false
        }
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    }

    async trackEvent(eventName, properties = {}) {
        console.log(`📊 Analytics Event Received - ${eventName}`, { properties });
        const event = {
            eventName,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            properties: {
                ...properties,
                appVersion: this.appVersion,
                platform: await window.electron.platform,
                screenResolution: `${window.innerWidth}x${window.innerHeight}`,
                userAgent: this.userAgent,
                sessionDuration: this.getSessionDuration(),
                timeSinceLastInteraction: Date.now() - this.lastInteraction,
                memoryUsage: window.performance.memory?.usedJSHeapSize,
                route: window.location.hash,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                analyticsEnabled: this.isEnabled,
                environment: this.isDev ? 'development' : 'production'
            }
        }
        
        this.lastInteraction = Date.now()

        // Log event in development mode
        if (this.isDev) {
            console.group('Analytics Event')
            console.log('Event:', eventName)
            console.log('Properties:', event.properties)
            console.log('Timestamp:', new Date(event.timestamp).toISOString())
            console.log('Session:', event.sessionId)
            console.groupEnd()
        }

        // If still initializing, store in pending events
        if (!this.initializationPromise.isResolved) {
            this.pendingEvents.push(event)
            return
        }

        // Otherwise process normally
        if (this.isEnabled) {
            this.events.push(event)
            // Only send to server in production
            if (!this.isDev) {
                await this.persistEvent(event)
            }
        }
    }

    trackPageView(pageName) {
        this.trackEvent('page_view', { pageName })
    }

    trackInteraction(elementId, interactionType, additionalData = {}) {
        this.trackEvent('user_interaction', {
            elementId,
            interactionType,
            ...additionalData
        })
    }

    trackError(error, context = {}) {
        this.trackEvent('error', {
            errorMessage: error.message,
            errorStack: error.stack,
            errorType: error.name,
            componentStack: error.componentStack, // For React errors
            context,
            severity: context.severity || 'error',
            currentRoute: window.location.hash,
            lastAction: this.events[this.events.length - 1]?.eventName,
            browserInfo: {
                userAgent: this.userAgent,
                language: navigator.language,
                cookiesEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                onLine: navigator.onLine,
            },
            performanceMetrics: {
                memory: window.performance.memory ? {
                    usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                    totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                } : null,
                timing: window.performance.timing.toJSON(),
            }
        })
    }

    trackPerformance(metricName, value, context = {}) {
        this.trackEvent('performance', {
            metricName,
            value,
            ...context,
            navigationTiming: window.performance.timing.toJSON(),
            memory: window.performance.memory ? {
                usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            } : null,
        })
    }

    trackUserFlow(flowName, stepName, status, metadata = {}) {
        this.trackEvent('user_flow', {
            flowName,
            stepName,
            status,
            flowDuration: metadata.duration,
            ...metadata
        })
    }

    trackTourProgress(stepNumber, stepName, completed = false) {
        this.trackEvent('tour_progress', {
            stepNumber,
            stepName,
            completed
        })
    }

    trackFeatureUsage(featureName, actionType, metadata = {}) {
        this.trackEvent('feature_usage', {
            featureName,
            actionType,
            ...metadata
        })
    }

    getSessionDuration() {
        return Date.now() - this.sessionStartTime
    }

    async persistEvent(event) {
        // Double-check settings before sending
        if (!this.isEnabled || this.isDev) return

        try {
            const settings = await window.electron.getSettings()
            if (!settings?.sendAnalytics) {
                this.isEnabled = false
                return
            }

            const apiKey = await window.electron.getAnalyticsKey()
            const response = await fetch(`${this.analyticsEndpoint}/api/analytics/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(event)
            })

            if (!response.ok) {
                console.error('Failed to persist analytics event:', await response.text())
            }
        } catch (error) {
            console.error('Error persisting analytics event:', error)
        }
    }

    async flushEvents() {
        if (!this.isEnabled || this.events.length === 0) return;
        
        console.log(`📤 Flushing ${this.events.length} analytics events`);
        try {
            const settings = await window.electron.getSettings()
            if (!settings?.sendAnalytics) {
                this.isEnabled = false
                this.events = []  // Clear events if analytics are disabled
                return
            }

            const apiKey = await window.electron.getAnalyticsKey()
            const response = await fetch(`${this.analyticsEndpoint}/api/analytics/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(this.events)
            })

            if (response.ok) {
                this.events = []
            } else {
                console.error('Failed to flush analytics events:', await response.text())
            }
        } catch (error) {
            console.error('Error flushing analytics events:', error)
        }
    }

    async updateSettings() {
        const settings = await window.electron.getSettings()
        this.isEnabled = settings?.sendAnalytics === true  // Explicitly check for true
        
        if (!this.isEnabled) {
            this.events = []  // Clear any pending events if analytics are disabled
        }
    }
}

export const analytics = new AnalyticsService()

// Listen for settings changes
window.electron.onSettingsChanged(async () => {
    await analytics.updateSettings()
})