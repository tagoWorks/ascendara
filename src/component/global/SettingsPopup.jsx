import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch, Input, Spacer } from "@nextui-org/react";

const SettingsModal = ({ isOpen, onOpenChange }) => {
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [backgroundMotion, setBackgroundMotion] = useState(false);
  const [splitTunnelDownloads, setSplitTunnelDownloads] = useState(false);
  const [seamlessGoFileDownloads, setSeamlessGoFileDownloads] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState('');
  const [version, setVersion]  = useState(''); 

  useEffect(() => {
    window.electron.getSettings().then((settings) => {
      setEnableNotifications(settings.enableNotifications);
      setAutoUpdate(settings.autoUpdate);
      setSplitTunnelDownloads(settings.splitTunnelDownloads);
      setSeamlessGoFileDownloads(settings.seamlessGoFileDownloads);
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
    }
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

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" classNames={{body: "py-6",backdrop: "bg-[#292f46]/50",base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",}}>
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
                <p className="text-small text-default-500">Automatically start downloading files that are hosted on GoFile</p>
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
                isSelected={splitTunnelDownloads}
                value={splitTunnelDownloads}
                onChange={handleSplitTunnelDownloadsToggle}
              >
                Multi-Thread Downloads
                <p className="text-small text-default-500">Coming Soon</p>
              </Switch>
              <Switch
                isDisabled
                isSelected={autoUpdate}
                value={enableNotifications}
                onChange={handleAutoUpdateToggle}
              >
                Background Updates
                <p className="text-small text-default-500">Coming Soon</p>
              </Switch>
              <Spacer y={3} />
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
    </Modal>
  );
};

export default SettingsModal;