import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch, Input, Spacer } from "@nextui-org/react";

const SettingsModal = ({ isOpen, onOpenChange }) => {
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [splitTunnelDownloads, setSplitTunnelDownloads] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState('');

  useEffect(() => {
    window.electron.getSettings().then((settings) => {
      console.log(settings);
      setEnableNotifications(settings.enableNotifications);
      setAutoUpdate(settings.autoUpdate);
      setSplitTunnelDownloads(settings.splitTunnelDownloads);
      setDownloadDirectory(settings.downloadDirectory);
    });
  }, []);

  const handleNotificationsToggle = (checked) => {
    console.log('Enable Notifications:', checked);
    setEnableNotifications((prevState) => !prevState);
  };
  
  const handleAutoUpdateToggle = (checked) => {
    console.log('Auto-Update:', checked);
    setAutoUpdate((prevState) => !prevState);
  };
  const handleSplitTunnelDownloadsToggle = (checked) => {
    console.log('Split Tunnel Downloads:', checked);
    setSplitTunnelDownloads((prevState) => !prevState);
  }

  const handleSave = () => {
    const options = {
      enableNotifications,
      autoUpdate,
      splitTunnelDownloads,
    }
    window.electron.saveSettings(options, downloadDirectory);
    onOpenChange(false); // Close the modal after saving
  };
    
  const handleSelectDirectory = async () => {
    const directoryPath = await window.electron.openDirectoryDialog();
    if (directoryPath) {
      console.log('Selected directory:', directoryPath);
      setDownloadDirectory(directoryPath);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" classNames={{ backdrop: "backdrop-opacity-50 backdrop-blur", }}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3>Settings</h3>
            </ModalHeader>
            <ModalBody>
              <Switch
                isDisabled
                isSelected={splitTunnelDownloads}
                value={splitTunnelDownloads}
                onChange={handleSplitTunnelDownloadsToggle}
              >
                Split Tunnel Downloads
                <p className="text-small text-default-500">Coming Soon</p>
              </Switch>
              <Switch
                isDisabled
                isSelected={autoUpdate}
                value={enableNotifications}
                onChange={handleAutoUpdateToggle}
              >
                Auto-Update
                <p className="text-small text-default-500">Coming Soon</p>
              </Switch>
              <Spacer y={3} />
              <Input
                onClick={handleSelectDirectory}
                label="Download Directory"
                value={downloadDirectory}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={handleSave}>
                Save
              </Button>
              <h2 className="text-small text-default-400 fixed bottom-0 py-4 arial text-center">
                Ascendara v1.0 | NextJS | Electron
              </h2>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;