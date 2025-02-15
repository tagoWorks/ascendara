import React, { createContext, useContext, useState, useEffect } from "react";

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettingsState] = useState({
    downloadDirectory: "",
    showOldDownloadLinks: false,
    seeInappropriateContent: false,
    notifications: true,
    downloadHandler: false,
    torrentEnabled: false,
    gameSource: "steamrip",
    autoCreateShortcuts: true,
    sendAnalytics: true,
    autoUpdate: true,
    language: "en",
    theme: "purple",
    threadCount: 4,
    sideScrollBar: false,
  });

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electron.getSettings();
        if (savedSettings) {
          setSettingsState(savedSettings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();

    // Listen for settings changes
    const handleSettingsChange = (event, newSettings) => {
      setSettingsState(prevSettings => ({
        ...prevSettings,
        ...newSettings
      }));
    };

    window.electron.ipcRenderer.on("settings-updated", handleSettingsChange);

    return () => {
      window.electron.ipcRenderer.off("settings-updated", handleSettingsChange);
    };
  }, []);

  const updateSetting = async (key, value) => {
    try {
      const success = await window.electron.updateSetting(key, value);
      if (success) {
        setSettingsState(prevSettings => ({
          ...prevSettings,
          [key]: value
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating setting:", error);
      return false;
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const success = await window.electron.saveSettings(newSettings);
      if (success) {
        setSettingsState(prevSettings => ({
          ...prevSettings,
          ...newSettings
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating settings:", error);
      return false;
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      settings,
      updateSetting,
      updateSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
