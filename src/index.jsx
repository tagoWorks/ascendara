import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody, Checkbox, ModalFooter, Progress, Link, Divider, Spacer } from "@nextui-org/react";
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
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNextModal, setShowNextModal] = useState(false);
  const [brokenVersions, setBrokenVersions] = useState([]);
  const [isInstallingLibraries, setIsInstallingLibraries] = useState(false);
  const [showUpdateWarning, setShowUpdateWarning] = useState(false);
  const [showReqUpdateWarning, setShowReqUpdateWarning] = useState(false);
  const [isUpdatingAscendara, setIsUpdatingAscendara] = useState(false);
  const [selectedTab, setSelectedTab] = useState("browse");
  const [privacyPolicyChecked, setPrivacyPolicyChecked] = useState(false);
  const [termsOfServiceChecked, setTermsOfServiceChecked] = useState(false);

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
        await checkIsNew();
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
  
    fetchData();
  }, []);

  const checkHasLaunched = async () => {
    try {
      const hasLaunched = await window.electron.hasLaunched();
      if (hasLaunched) {
        console.log("Checking for update...")
        const isLatest = await window.electron.isLatest();
        if (!isLatest) {
          setShowUpdateWarning(true)
          console.error("UPDATE AVAILABLE")
        } else {
          console.log("Up to date")
        }
      } else {
        console.log("Launched already")
        setShowUpdateWarning(false)
      }
    }
    catch (error) {
      console.error("Error checking if launched:" + error)
    }
  }

  const fetchBrokenVersions = async () => {
    try {
      const response = await fetch('https://api.ascendara.app/app/brokenversions');
      const brokenVersionsData = await response.json();
      setBrokenVersions(brokenVersionsData);
      const currentVersion = await window.electron.getVersion();
      if (brokenVersionsData.includes(currentVersion)) {
        setShowReqUpdateWarning(true);
      }
    } catch (error) {
      console.error("Error fetching broken versions:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await getGames();
        await checkIsNew();
        await checkHasLaunched();
        await fetchBrokenVersions();
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
  
  const closeWelcomeModal = async () => {
    if (privacyPolicyChecked && termsOfServiceChecked) {
      await window.electron.createTimestamp();
      setShowWelcomeModal(false);
      setShowNewModal(true);
    }
  };

  const closeNewModal = () => {
    setShowNewModal(false);
    setShowNextModal(true);
  };

  const closeUpdateWarning = () => {
    setShowUpdateWarning(false);
  };

  const handleTabChange = (key) => {
    setSelectedTab(key);
  };

  return (
      <div className={`w-screen h-screen justify-center main-window`}>
        <Modal isDismissable={false} hideCloseButton isOpen={showUpdateWarning} onClose={closeUpdateWarning}>
          <ModalContent>
            <ModalHeader>
              <h1>New Version Available!</h1>
            </ModalHeader>
            <ModalBody>
              <p>There is a new update available. Please update in order to fix any issues there might be with this version as this project is still in development.</p>
              <p>Join the <Link onClick={() => window.electron.openURL('https://ascendara.app/discord')} className="show-pointer">Discord server</Link> in order to be informed on the different changes taking place.</p>
            </ModalBody>
            <ModalFooter>
              <Button color="warning" onClick={() => {
                  setShowUpdateWarning(false);
                  setIsUpdatingAscendara(true);
                  window.electron.updateAscendara();
                  }}>
                Download Update & Relaunch</Button>
              <Button color='danger' variant='bordered' onClick={closeUpdateWarning}>Later...</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isDismissable={false} hideCloseButton isOpen={showReqUpdateWarning}>
          <ModalContent>
            <ModalHeader>
                <h1>Ascendara Update Required</h1>
              </ModalHeader>
              <ModalBody>
                <p>This version has been flagged due to major issues or security vulnerabilities. Please update to the latest version to ensure your safety and optimal performance.</p>
                <p>Join the <Link onClick={() => window.electron.openURL('https://ascendara.app/discord')} className="show-pointer">Discord server</Link> for more information on why this update is important.</p>
              </ModalBody>
            <ModalFooter>
              <Button color="success" onClick={() => {
                  setShowUpdateWarning(false);
                  setIsUpdatingAscendara(true);
                  window.electron.updateAscendara();
                  }}>
                Download Update & Relaunch</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isDismissable={false} hideCloseButton isOpen={showWelcomeModal} onClose={closeWelcomeModal}>
          <ModalContent>
            <ModalHeader>
              <h2>Welcome to Ascendara!</h2>
            </ModalHeader>
            <ModalBody>
              <p>Ascendara is still in development and issues are expected. Please report any issues in the Discord server or "Report a Bug" in settings. Remember to set your download directory before installing or adding any games.</p>
              <div className="mt-4">
                <Divider/>
                <Spacer y={2}/>
                <p>Please agree to the following in order to use Ascendara</p>
                <Spacer y={2}/>
                <Checkbox
                  isSelected={privacyPolicyChecked}
                  onValueChange={setPrivacyPolicyChecked}
                >
                  I have read and agree to Ascendara's <Link href="#" onClick={() => window.electron.openURL('https://ascendara.app/privacy')}>Privacy Policy</Link>
                </Checkbox>
              </div>
              <div className="mt-2">
                <Checkbox
                  isSelected={termsOfServiceChecked}
                  onValueChange={setTermsOfServiceChecked}
                >
                  I have read and agree to Ascendara's <Link href="#" onClick={() => window.electron.openURL('https://ascendara.app/terms')}>Terms of Service</Link>
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant='bordered'
                onClick={closeWelcomeModal}
                isDisabled={!privacyPolicyChecked || !termsOfServiceChecked}
              >
                Next
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        
        <Modal isDismissable={false} hideCloseButton isOpen={showNewModal} onClose={closeNewModal}>
          <ModalContent>
            <ModalHeader>
              <h2>Ascendara Extension</h2>
            </ModalHeader>
            <ModalBody>
              <p>It's recommended that you get the Ascendara Download Blocker chrome extension in order to quickly copy direct download links for Ascendara</p>
              <p>Would you like to get it now?</p>
            </ModalBody>
            <ModalFooter>
              <Button variant='bordered' color="success" onClick={closeNewModal} onPress={() => window.electron.openURL('https://ascendara.app/extension')}>Get it Now</Button>
              <Button variant='bordered' onClick={closeNewModal}>Skip</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


        <Modal isDismissable={false} hideCloseButton isOpen={showNextModal} onClose={() => setShowNextModal(false)}>
          <ModalContent>
            <ModalHeader>
              <h2>Game Dependencies</h2>
            </ModalHeader>
            <ModalBody>
              <p>Most games require you to install the following dependencies if you haven't before:<br/> • .NET Framework <br/> • DirectX <br/> • OpenAL <br/> • Visual C++ Redistributable <br/> • XNA Framework Redistributable</p>
              <p>Ascendara can automatically install these dependencies onto your PC.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant='bordered' color='success' onClick={handleInstallLibraries}>Install Dependencies</Button>
              <Button variant='bordered' onClick={() => setShowNextModal(false)}>Start Exploring</Button>
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
              <Progress isIndeterminate color="default" />
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={isUpdatingAscendara} onClose={() => setIsUpdatingAscendara(false)} hideCloseButton isDismissable={false}>
          <ModalContent>
            <ModalHeader>
              <h2>Downloading the latest version...</h2>
            </ModalHeader>
            <ModalBody>
              <p>The installer executable is going to be downloaded and ran.</p>
              <p>When the installer runs, the app should close.</p>
            </ModalBody>
            <ModalFooter>
              <Progress isIndeterminate color="default" />
            </ModalFooter>
          </ModalContent>
        </Modal>

        <SettingsModal isOpen={isSettingsModalOpen} onOpenChange={toggleSettingsModal} />
        <ThemesModal isOpen={isThemesModalOpen} onOpenChange={toggleThemesModal} />
        <Tabs 
          isVertical 
          isIconOnly 
          aria-label="Options" 
          color="white" 
          variant="light" 
          className="tabs"
          selectedKey={selectedTab}
          onSelectionChange={handleTabChange}
        >
          <Tab 
            key="browse" 
            title={<BrowseIcon fill={selectedTab === "browse" ? "black" : "white"} />}
          >
            <BrowsePage />
          </Tab>
          <Tab 
            key="games" 
            title={<LibraryIcon fill={selectedTab === "games" ? "black" : "white"} />}
          >
            <div className='flex'>
              <LibraryPage />
            </div>
          </Tab>
        </Tabs>
        <Button isIconOnly color="default" size="sm" variant="light" className="configure-loc" onPress={toggleSettingsModal}>
          <SettingsIcon />
        </Button>
      </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <Router>
    <App />
  </Router>
);