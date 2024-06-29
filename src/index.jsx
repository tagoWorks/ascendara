import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { NextUIProvider, Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Progress } from "@nextui-org/react";
import "./styles.css";
import LibraryPage from "./component/Library";
import BrowsePage from "./component/Browsing";
import { SettingsIcon } from "./component/global/SettingsIcon";
import SettingsModal from './component/global/SettingsPopup';
import ThemesModal from './component/global/ThemesPopup';
import { LibraryIcon } from './component/global/LibraryIcon';
import { BrowseIcon } from './component/global/BrowseIcon';

const App = () => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isThemesModalOpen, setIsThemesModalOpen] = useState(false);
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [backgroundMotion, setBackgroundMotion] = useState();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showNextModal, setShowNextModal] = useState(false);
  const [isInstallingLibraries, setIsInstallingLibraries] = useState(false);

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
  
  const handleInstallLibraries = async () => {
    setShowNextModal(false);
    setIsInstallingLibraries(true);
    try {
      const result = await window.electron.installDependencies();
      if (result.success) {
        console.log("All installations complete");
      } else {
        console.error("Installation failed:", result.message);
      }
    } catch (error) {
      console.error("Error installing libraries:", error);
    } finally {
      setIsInstallingLibraries(false);
    }
  };

  const checkIsNew = async () => {
    try {
      const isNew = await window.electron.isNew();
      if (isNew) {
        setTimeout(() => {
          setShowWelcomeModal(true);
        }, 1500);
      }
    } catch (error) {
      console.error("Error checking if new:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await getGames();
        await getSettings();
        await checkIsNew();
      } catch (error) {
        console.error("Error fetching data:", error);
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
  const closeWelcomeModal = () => {
    setShowWelcomeModal(false);
    setShowNextModal(true);
  };
  return (
    <NextUIProvider>
      <div className={`w-screen h-screen justify-center main-window ${backgroundMotion ? 'animate' : ''}`}>
        <Modal isDismissable={false} hideCloseButton isOpen={showWelcomeModal} onClose={closeWelcomeModal}>
          <ModalContent>
            <ModalHeader>
              <h2>Welcome to Ascendara!</h2>
            </ModalHeader>
            <ModalBody>
              <p>Ascendara is still in development and issues are expected. Please report any issues in the Discord server or "Report a Bug" in settings. Remember to set your download directory before installing or adding any games.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant='bordered' onClick={closeWelcomeModal}>Next</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        <Modal isDismissable={false} hideCloseButton isOpen={showNextModal} onClose={() => setShowNextModal(false)}>
          <ModalContent>
            <ModalHeader>
              <h2>Getting Started</h2>
            </ModalHeader>
            <ModalBody>
              <p>Most games require you to install the following dependencies if you haven't before:<br/> • .NET Framework <br/> • DirectX <br/> • OpenAL <br/> • Visual C++ Redistributable <br/> • XNA Framework Redistributable</p>
              <p>Ascendara can automatically install these dependencies onto your PC.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant='bordered' onClick={() => setShowNextModal(false)}>Start Exploring</Button>
              <Button variant='bordered' color='success' onClick={handleInstallLibraries}>Install Dependencies</Button>
         </ModalFooter>
          </ModalContent>
        </Modal>
        <Modal isOpen={isInstallingLibraries} onClose={() => setIsInstallingLibraries(false)} hideCloseButton isDismissable={false}>
          <ModalContent>
            <ModalHeader>
              <h2>Installing Dependencies...</h2>
            </ModalHeader>
            <ModalBody>
              <p>The installer executables are going to be downloaded and ran. Please click "Yes" on for each elevated permissions prompt.</p>
              <p>After all dependencies are installed, this popup will close.</p>
            </ModalBody>
            <ModalFooter>
              <Progress isIndeterminate color="secondary" />
            </ModalFooter>
          </ModalContent>
        </Modal>
        <SettingsModal isOpen={isSettingsModalOpen} onOpenChange={toggleSettingsModal} />
        <ThemesModal isOpen={isThemesModalOpen} onOpenChange={toggleThemesModal} />
        <Tabs isVertical isIconOnly aria-label="Options" color="secondary" variant="bordered" className="tabs">
          <Tab key="browse" title={<BrowseIcon />}>
            <BrowsePage />
          </Tab>
          <Tab key="games" title={<LibraryIcon />}>
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