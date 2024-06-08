import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { NextUIProvider, Tabs, Tab, Button } from "@nextui-org/react";
import "./styles.css";
import LibraryPage from "./component/Library";
import BrowsePage from "./component/Browsing";
import { SettingsIcon } from "./component/global/SettingsIcon";
import SettingsModal from './component/global/SettingsPopup';
import {HeartIcon} from "./component/global/Heart";
import { LibraryIcon } from './component/global/LibraryIcon';
import { BrowseIcon } from './component/global/BrowseIcon';

const App = () => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const getGames = async () => {
    try {
      const gamesData = await window.electron.getGames();
      if (Array.isArray(gamesData)) {
        const installedGames = [];
        const downloadingGames = [];
        gamesData.forEach(game => {
          if (game.downloadingdata && game.downloadingdata.downloading) { 
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

  useEffect(() => {
    getGames();
  }, []);

  const toggleSettingsModal = () => {
    setIsSettingsModalOpen(!isSettingsModalOpen);
  };

  return (
    <NextUIProvider>
      <div className="w-screen h-screen justify-center">
          <SettingsModal isOpen={isSettingsModalOpen} onOpenChange={toggleSettingsModal} />
          <Tabs isVertical isIconOnly aria-label="Options" color="primary" variant="bordered" className="tabs">
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
      </div>
    </NextUIProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <Router>
      <App />
    </Router>
);