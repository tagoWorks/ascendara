import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./app.css";
import "./i18n";
import { analytics } from "./services/analyticsService";
import { initializeConsole } from "./lib/consoleIntro.js";

window.addEventListener("beforeunload", () => {
  analytics.flushEvents();
});

initializeConsole(analytics);
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
