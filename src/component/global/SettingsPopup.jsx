import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch, Input, Spacer, Divider, Progress } from "@nextui-org/react";
import ReportModal from './AscendaraReport';
import  { SeemlessDownloadIcon } from '../GameSearch/svg/SeemlessDownloadIcon'
import { BugIcon } from './BugIcon'
import { CloseCircleXIcon } from './CloseCircleXIcon'
import { UpdateIcon } from '../Library/Games/svg/UpdateIcon';


const SettingsModal = ({ isOpen, onOpenChange }) => {
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [backgroundMotion, setBackgroundMotion] = useState(false);
  const [splitTunnelDownloads, setSplitTunnelDownloads] = useState(false);
  const [allowOldLinks, setAllowOldLinks] = useState(false);
  const [pendingOldLinksToggle, setPendingOldLinksToggle] = useState(false);
  const [seamlessDownloads, setSeamlessDownloads] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState('');
  const [version, setVersion]  = useState(''); 
  const [isReportOpen, setReportOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isOldLinksWarningOpen, setOldLinksWarningOpen] = useState(false);
  const [isUninstallModalOpen, setUninstallModalOpen] = useState(false);
  const [isUninstallingModalOpen, setUninstallingModalOpen] = useState(false);
  const [isDebugModalOpen, setDebugModalOpen] = useState(false);
  useEffect(() => {
    const handleF5Press = (event) => {
      if (event.key === 'F5' && isOpen) {
        event.preventDefault();
        onOpenChange(false);
        setDebugModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleF5Press);

    return () => {
      window.removeEventListener('keydown', handleF5Press);
    };
  }, [isOpen, onOpenChange]);

  const handleOpenReport = () => {
    setReportOpen(true);
  };
  const handleDeleteTimestamp = () => {
    window.electron.deleteGame("localTimestampFile");
  };

  const handleOpenLocal = () => {
    window.electron.openGameDirectory("local", true);
  };
  const handleCloseReport = () => {
    setReportOpen(false);
  };

  useEffect(() => {
    window.electron.getSettings().then((settings) => {
      setEnableNotifications(settings.enableNotifications);
      setAutoUpdate(settings.autoUpdate);
      setSplitTunnelDownloads(settings.splitTunnelDownloads);
      setSeamlessDownloads(settings.seamlessDownloads);
      setAllowOldLinks(settings.allowOldLinks);
      setDownloadDirectory(settings.downloadDirectory);
    });
  }, []);

  useEffect(() => {
    window.electron.getVersion().then((version) => {
      setVersion(version);
    });
  }, []);

  const handleNotificationsToggle = (checked) => {
    console.log('Enable Notifications:', checked);
    setEnableNotifications((prevState) => !prevState);
  };

  const handleAllowOldLinksToggle = (checked) => {
    if (!allowOldLinks) {
      setPendingOldLinksToggle(true);
      setOldLinksWarningOpen(true);
    } else {
      setAllowOldLinks(false);
    }
  };

  const handleAutoUpdateToggle = (checked) => {
    console.log('Auto-Update:', checked);
    setAutoUpdate((prevState) => !prevState);
  };

  const handleSplitTunnelDownloadsToggle = (checked) => {
    console.log('Split Tunnel Downloads:', checked);
    setSplitTunnelDownloads((prevState) => !prevState);
  };

  const handleSeamlessDownloads = (checked) => {
    console.log('Seamless Downloads:', checked);
    setSeamlessDownloads((prevState) => !prevState);
  };

  const handleSave = () => {
    const options = {
      enableNotifications,
      autoUpdate,
      splitTunnelDownloads,
      seamlessDownloads
    };
    window.electron.saveSettings(options, downloadDirectory);
    onOpenChange(false);
    window.location.reload();
  };

  const handleSelectDirectory = async () => {
    const directoryPath = await window.electron.openDirectoryDialog();
    if (directoryPath) {
      console.log('Selected directory:', directoryPath);
      setDownloadDirectory(directoryPath);
    }
  };

  const handleOldLinksWarningConfirm = () => {
    setAllowOldLinks(true);
    setPendingOldLinksToggle(false);
    setOldLinksWarningOpen(false);
  };
  
  const handleOldLinksWarningClose = () => {
    setPendingOldLinksToggle(false);
    setOldLinksWarningOpen(false);
  };

  const handleUninstallModalClose = () => {
    setUninstallModalOpen(false);
  };
  const handleUninstallingModalClose = () => {
    setUninstallingModalOpen(false);
  };
  
  const handleApiKeyChange = (newApiKey) => {
    window.electron.overrideApiKey(newApiKey);
  };

  const handleUninstallingModalOpen = () => {
    setUninstallModalOpen(false);
    onOpenChange(false);
    setUninstallingModalOpen(true);
    window.electron.uninstallAscendara();
  };



  return (
    <>
      <Modal onClose={handleSave} size='2xl' isDismissable={false} isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <h1 className="text-large flex center gap-2">Settings</h1>
              </ModalHeader>
              <ModalBody>
                
              <Input
                  onClick={handleSelectDirectory}
                  isReadOnly
                  label="Download Directory"
                  value={downloadDirectory}
                />
                <Divider/>
                
                <Switch
                  isSelected={seamlessDownloads}
                  value={seamlessDownloads}
                  onChange={handleSeamlessDownloads}
                >
                  <div className="items-center gap-2" style={{ display: "flex" }}>
                  Seamless Downloads <SeemlessDownloadIcon size={16}/>
                  </div>
                  <p className="text-small text-default-500">When downloading a game, if the provider <br/>
                     doesn't require CAPTCHA, it will seamlessly start</p>
                </Switch>
                <Switch
                  isDisabled
                  isSelected={allowOldLinks || pendingOldLinksToggle}
                  value={allowOldLinks}
                  onChange={handleAllowOldLinksToggle}
                >
                  View Old Download Links
                  <p className="text-small text-default-500">Links for older versions of games will be shown</p>
                </Switch>
                <Switch
                  isSelected={autoUpdate}
                  value={enableNotifications}
                  onChange={handleAutoUpdateToggle}
                >
                  Check Version on Launch
                  <p className="text-small text-default-500">Upon launching Ascendara, it will check <br/>
                    servers and notify you if there is an update</p> 
                </Switch>
                <Spacer y={0.6}/>
                  <div className="gap-1" style={{ display: 'flex' }}>
                  <Button color="primary" size="sm" onClick={handleOpenReport}>Report a Bug
                    <BugIcon size={16}/>
                  </Button>
                  {isReportOpen && <ReportModal
                    isReportOpen={isReportOpen}
                    onReportClose={handleCloseReport}
                  />}
                  <Button isDisabled={true} color="warning" variant='solid' size="sm">Check for Update
                    <UpdateIcon size={16}/>
                  </Button>
                  <Button color="danger" variant='ghost' size="sm" onPress={() => setUninstallModalOpen(true)}>Uninstall
                    <CloseCircleXIcon size={16}/>
                  </Button>
                </div>

              </ModalBody>
              <ModalFooter>
                <h2 className="text-small text-default-400 arial text-center">
                  Ascendara {version}
                </h2>
                <h2 className="text-small text-default-400 arial text-center"> | </h2>
                <h2 onClick={() => window.electron.openURL('https://github.com/tagoWorks/ascendara/wiki/Usage-Guide')} className="show-pointer text-small text-default-400 arial text-center">
                  Usage Guide
                </h2>
                <h2 className="text-small text-default-400 arial text-center"> | </h2>
                <h2 onClick={() => window.electron.openURL('https://tago.works')} className="show-pointer text-small text-default-400 arial text-center">
                  tagoWorks
                </h2>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isOldLinksWarningOpen}
        onOpenChange={handleOldLinksWarningClose}
        hideCloseButton
        placement="center"
      >
        <ModalContent>
          <ModalHeader>
            <h3>Hang on...</h3>
          </ModalHeader>
          <ModalBody>
            <p>Old links are not supported and some may not work. Do not report an older game version if it doesn't work.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant='ghost' color="success" onPress={handleOldLinksWarningConfirm}>
              I understand
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>


      <Modal
        isOpen={isUninstallModalOpen}
        onOpenChange={handleUninstallModalClose}
        hideCloseButton
        placement="center"
      >
        <ModalContent>
          <ModalHeader>
            <h3>Uninstall Ascendara?</h3>
          </ModalHeader>
          <ModalBody>
            <p>You are about to uninstall Ascendara from your computer.</p>
            <p>Some things are not going to be deleted, and this will only uninstall Ascendara from 
              your computer. These things include:<br/>
              • Games downloaded<br/>
              • Games added to Library<br/>
              • Ascendara info files in game directories<br/>
              • Temp files made
            </p>
            <p>Do you want to continue?</p>
            <p className="text-small text-default-500">This action cannot be undone</p>

          </ModalBody>
          <ModalFooter>
            <div className="items-center flex gap-3">
            <Button size='lg' variant='solid' color="primary" onPress={handleUninstallModalClose}>
              Cancel
            </Button>
            <Button onClick={handleUninstallingModalOpen} size='sm' variant='ghost' color="danger">
              I understand, uninstall Ascendara
            </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isUninstallingModalOpen}
        onOpenChange={handleUninstallingModalClose}
        hideCloseButton
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>
            <h3>Uninstalling Ascendara...</h3>
          </ModalHeader>
          <ModalBody>
            <Progress isIndeterminate color='danger'/>
          </ModalBody>

        </ModalContent>
      </Modal>
    
      <Modal
        isOpen={isDebugModalOpen}
        onOpenChange={setDebugModalOpen}
        hideCloseButton
        placement="center"
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>
            <h3>Developer Tools</h3>
          </ModalHeader>
          <ModalBody>
            <Button onPress={handleOpenLocal} >
              Open local directory
            </Button>
            <Button onPress={handleDeleteTimestamp} >
              Delete timestamp file
            </Button>
            <Input
            label="API Key"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
          />
          </ModalBody>
          <ModalFooter>
            <Button variant='ghost' color="primary" onPress={() => setDebugModalOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SettingsModal;