// Console Text Art Utilities
const consoleStyles = {
    welcome: [
        "font-size: 20px",
        "font-weight: bold",
        "color: #4CAF50",
        "text-shadow: 2px 2px 4px rgba(0,0,0,0.2)",
        "padding: 10px"
    ].join(";"),
    header: [
        "font-size: 16px",
        "font-weight: bold",
        "color: #9C27B0",
        "border-bottom: 2px solid #9C27B0",
        "padding: 4px 0"
    ].join(";"),
    info: [
        "font-size: 14px",
        "color: #1976D2",
        "padding: 4px 8px",
        "margin: 2px 0",
        "background: rgba(25, 118, 210, 0.05)",
        "border-left: 3px solid #1976D2"
    ].join(";"),
    security: [
        "font-size: 14px",
        "color: #D32F2F",
        "padding: 4px 8px",
        "margin: 2px 0",
        "background: rgba(211, 47, 47, 0.05)",
        "border-left: 3px solid #D32F2F"
    ].join(";"),
    analytics: [
        "font-size: 14px",
        "color: #00796B",
        "padding: 4px 8px",
        "margin: 2px 0",
        "background: rgba(0, 121, 107, 0.05)",
        "border-left: 3px solid #00796B"
    ].join(";")
};

const printWelcome = () => {
    console.log(`%c
╔═══════════════════════════════════════╗
║        ASCENDARA CONSOLE LOGS         ║
║        https://ascendara.app/         ║
╚═══════════════════════════════════════╝`, consoleStyles.welcome);
};

const printHeader = (text) => {
    console.log(`%c${text}`, consoleStyles.header);
};

const printInfo = (message) => {
    console.log(`%c${message}`, consoleStyles.info);
};

const printSecurity = (message) => {
    console.log(`%c🔒 ${message}`, consoleStyles.security);
};

const printAnalytics = (message) => {
    console.log(`%c📊 ${message}`, consoleStyles.analytics);
};

export const initializeConsole = (analytics) => {
    printWelcome();

    printHeader("About Console Logs");
    printInfo("This console provides detailed insights into Ascendara's operations");
    printInfo("All application activities are logged here for transparency");

    printHeader("Security Notice");
    printSecurity("Never share console logs - they contain sensitive session data");
    printSecurity("Clear console before sharing screenshots or recordings");

    printHeader("Analytics & Tracking");

    // Verify we're using the real analytics service
    if ('isDummy' in analytics) {
        printAnalytics("Using dummy analytics service implementation");
    } else {
        printAnalytics("Using Ascendara analytics service");
        printAnalytics("Real-time analytics and error tracking are active");
    }
};

export { printWelcome, printHeader, printInfo, printSecurity, printAnalytics };