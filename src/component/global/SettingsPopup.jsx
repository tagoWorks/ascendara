import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch, Input, Spacer } from "@nextui-org/react";
import ReportModal from './AscendaraReport';
import { WarningIcon } from './WarningIcon';

const SettingsModal = ({ isOpen, onOpenChange }) => {
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [backgroundMotion, setBackgroundMotion] = useState(false);
  const [splitTunnelDownloads, setSplitTunnelDownloads] = useState(false);
  const [allowOldLinks, setAllowOldLinks] = useState(false);
  const [pendingOldLinksToggle, setPendingOldLinksToggle] = useState(false);
  const [seamlessGoFileDownloads, setSeamlessGoFileDownloads] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState('');
  const [version, setVersion]  = useState(''); 
  const [isReportOpen, setReportOpen] = useState(false);
  const [isOldLinksWarningOpen, setOldLinksWarningOpen] = useState(false);

  const handleOpenReport = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  useEffect(() => {
    window.electron.getSettings().then((settings) => {
      setEnableNotifications(settings.enableNotifications);
      setAutoUpdate(settings.autoUpdate);
      setSplitTunnelDownloads(settings.splitTunnelDownloads);
      setSeamlessGoFileDownloads(settings.seamlessGoFileDownloads);
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

  const handleSeamlessGoFileDownloadsToggle = (checked) => {
    console.log('Seamless GoFile Downloads:', checked);
    setSeamlessGoFileDownloads((prevState) => !prevState);
  };

  const handleSave = () => {
    const options = {
      enableNotifications,
      autoUpdate,
      splitTunnelDownloads,
      seamlessGoFileDownloads,
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
    <Modal size='5xl' isDismissable={false} isOpen={isOpen} onOpenChange={onOpenChange} placement="center" classNames={{body: "py-6",backdrop: "bg-[#292f46]/50",base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",}}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3>Settings</h3>
            </ModalHeader>
            <ModalBody>
              <Switch
                isSelected={seamlessGoFileDownloads}
                value={seamlessGoFileDownloads}
                onChange={handleSeamlessGoFileDownloadsToggle}
              >
                Seamless GoFile Downloads
                <p className="text-small text-default-500">When downloading a game, if GoFile is a provider the download will seamlessly start</p>
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
                <p className="text-small text-default-500">Be able to view older versions of games</p>
              </Switch>
              <Switch
                isDisabled
                isSelected={autoUpdate}
                value={enableNotifications}
                onChange={handleAutoUpdateToggle}
              >
                Automatically check for updates
                <p className="text-small text-default-500">Check Ascendara's server for newer versions, and notify when there is one</p>
              </Switch>
              <Spacer y={3} />
              <Button color="danger" size="sm" onClick={handleOpenReport}>Report a Bug</Button>
              {isReportOpen && <ReportModal
                isReportOpen={isReportOpen}
                onReportClose={handleCloseReport}
              />}
              <Input
                onClick={handleSelectDirectory}
                isReadOnly
                label="Download Directory"
                value={downloadDirectory}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant='ghost' color="primary" onPress={handleSave}>
                Save
              </Button>
              <h2 className="text-small text-default-400 fixed bottom-0 py-4 arial text-center">
                Ascendara Development Build {version} | NextJS | Electron
              </h2>
            </ModalFooter>
          </>
        )}
      </ModalContent>
      <Modal
        isOpen={isOldLinksWarningOpen}
        onOpenChange={handleOldLinksWarningClose}
        hideCloseButton
        placement="center"
        classNames={{body: "py-6",base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",}}
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
    </Modal>
  );
};

export default SettingsModal;