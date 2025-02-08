/**
 * Analytics and reporting are only available in official builds to ensure security.
 *
 * @see https://ascendara.app/docs/developer/build-from-source#important-limitations
 */
export const analytics = {
  isDummy: true,
  trackPageView: page => {
    console.debug("[Analytics] Page view:", page);
  },
  trackEvent: (event, properties) => {
    console.debug("[Analytics] Event:", event, properties);
  },
  trackError: (error, info) => {
    console.debug("[Analytics] Error:", error, info);
  },
  flushEvents: () => {
    console.debug("[Analytics] Flushing events");
  },
  trackFeatureUsage: (featureName, actionType, metadata = {}) => {
    console.debug("[Analytics] Feature usage:", { featureName, actionType, metadata });
  },
  trackTourProgress: (stepNumber, stepName, completed = false) => {
    console.debug("[Analytics] Tour progress:", { stepNumber, stepName, completed });
  },
  updateSettings: async () => {
    console.debug("[Analytics] Settings updated");
  },
};
if (typeof window !== "undefined" && window.electron) {
  window.electron.onSettingsChanged(async () => {
    await analytics.updateSettings();
  });
}
