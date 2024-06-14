import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { NextUIProvider, Tabs, Tab, Button, Tooltip } from "@nextui-org/react";
import "./styles.css";
import LibraryPage from "./component/Library";
import BrowsePage from "./component/Browsing";
import { SettingsIcon } from "./component/global/SettingsIcon";
import SettingsModal from './component/global/SettingsPopup';
import ThemesModal from './component/global/ThemesPopup'
import {HeartIcon} from "./component/global/Heart";
import { LibraryIcon } from './component/global/LibraryIcon';
import { BrowseIcon } from './component/global/BrowseIcon';
import { ThemesIcon } from './component/global/ThemesIcon'


const App = () => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isThemesModalOpen, setIsThemesModalOpen] = useState(false);
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [backgroundMotion, setBackgroundMotion] = useState(true); // add this state

  const getGames = async () => {
    try {
      const gamesData = await window.electron.getGames();
      if (Array.isArray(gamesData)) {
        const installedGames = [];
        const downloadingGames = [];
        gamesData.forEach(game => {
          if (game.downloadingData && game.downloadingData.downloading) { 
            downloadingGames.push(game);
          } else {
            installedGames.push(game);
          }
        });
        setGames(installedGames);
        setDownloadingGames(downloadingGames);
      } else {
        console.error("Invalid data format received:", gamesData);
      }
    } catch (error) {
      console.error("Error fetching games:", error);
    }
  };

  const getSettings = async () => {
    try {
      const settings = await window.electron.getSettings();
      if (settings && settings.backgroundMotion !== undefined) {
        setBackgroundMotion(settings.backgroundMotion);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await getGames();
        await getSettings(); // call getSettings here
      } catch (error) {
        console.error("Error fetching data:", error);
        setIsInitialLoading(false); 
      }
    };
  
    fetchData();
  
  }, []);

  const toggleSettingsModal = () => {
    setIsSettingsModalOpen(!isSettingsModalOpen);
  };

  const toggleThemesModal = () => {
    setIsThemesModalOpen(!isThemesModalOpen);
  };

  return (
    <NextUIProvider>
      <div className={`w-screen h-screen justify-center main-window ${backgroundMotion ? 'animate' : ''}`}>
          <SettingsModal isOpen={isSettingsModalOpen} onOpenChange={toggleSettingsModal} />
          <ThemesModal isOpen={isThemesModalOpen} onOpenChange={toggleThemesModal} />
          <Tabs isVertical isIconOnly aria-label="Options" color="secondary" variant="bordered" className="tabs">
            <Tab key="browse" title={
                <BrowseIcon />
            }>
              <BrowsePage />
            </Tab>
            <Tab key="games" title={
                <LibraryIcon />
            }>
              <div className='flex'>
              <LibraryPage />
              </div>
            </Tab>
          </Tabs>
          <Button isIconOnly color="default" size="sm" variant="light" className="configure-loc" onPress={toggleSettingsModal}>
            <SettingsIcon />
          </Button>
          <Tooltip content="Coming soon...">
          <Button isIconOnly color="default" size="sm" variant="light" className="theme-loc" onPress={toggleThemesModal}>
            <ThemesIcon width={22} height={22} />
          </Button>
          </Tooltip>
      </div>
    </NextUIProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <Router>
      <App />
    </Router>
);