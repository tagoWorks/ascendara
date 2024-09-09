import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch, Input, Spacer, RadioGroup, Radio, Dropdown, DropdownTrigger, DropdownItem, DropdownMenu } from "@nextui-org/react";
import ReportModal from './AscendaraReport';
import { WarningIcon } from './WarningIcon';
import  { SeemlessDownloadIcon } from '../GameSearch/svg/SeemlessDownloadIcon'

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
  const [isOldLinksWarningOpen, setOldLinksWarningOpen] = useState(false);
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
      setBackgroundMotion(settings.backgroundMotion);
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

  const handleBackgroundMotionToggle = (checked) => {
    console.log('Background Motion:', checked);
    setBackgroundMotion((prevState) => !prevState);
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
      seamlessDownloads,
      backgroundMotion
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

  return (
    <>
      <Modal onClose={handleSave} size='5xl' isDismissable={false} isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <h1 className="text-large flex center gap-2">Settings
                <Button color="danger" size="sm" onClick={handleOpenReport}>Report a Bug</Button>
                {isReportOpen && <ReportModal
                  isReportOpen={isReportOpen}
                  onReportClose={handleCloseReport}
                />}</h1>
              </ModalHeader>
              <ModalBody>
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
                  isSelected={backgroundMotion}
                  value={backgroundMotion}
                  onChange={handleBackgroundMotionToggle}
                >
                  Background Motion
                  <p className="text-small text-default-500">Toggle the background gradient motion</p>
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
                <Input
                  onClick={handleSelectDirectory}
                  isReadOnly
                  label="Download Directory"
                  value={downloadDirectory}
                />
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