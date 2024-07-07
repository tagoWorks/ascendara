import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Switch, Button, Tooltip } from "@nextui-org/react";
import { HelpIcon } from '../../GameSearch/HelpIcon';

const GamesAddModal = ({ isOpen, onOpenChange }) => {
  const [executable, setExecutable] = useState(null);
  const [gameName, setGameName] = useState('');
  const [hasVersion, setHasVersion] = useState(false);
  const [version, setVersion] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [hasDLC, setHasDLC] = useState(false);

  const handleChooseExecutable = async () => {
    const file = await window.electron.openFileDialog();
    if (file) {
      setExecutable(file);
      const fileName = file.replace(/^.*[\\\/]/, '').replace('.exe', '');
      setGameName(fileName);
    }
  };

  const handleSubmit = () => {
    if (gameName && executable) {
      window.electron.addGame(gameName, isOnline, hasDLC, version, executable);
      onOpenChange(false);
      setExecutable(null);
      setGameName('');
      setHasVersion(false);
      setVersion('');
      setIsOnline(false);
      setHasDLC(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" classNames={{
      body: "py-6",
      backdrop: "bg-[#292f46]/50",
      base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",
    }}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              <h3>Add a Game</h3>
            </ModalHeader>
            <ModalBody>
              <h1>Choose your Game</h1>
              <Input
                type="text"
                value={executable || ''}
                onClick={handleChooseExecutable}
                readOnly
                placeholder="Executable Path"
              />
              <Input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Game Name"
              />
              <div>
              <Tooltip content="Specify displayed information. This will not add or modify anything in the game files.">
                Game Details
              </Tooltip>
              </div>
                <Switch checked={hasVersion} onChange={(e) => setHasVersion(e.target.checked)}>
                Specify a Game Version
                </Switch>
              {hasVersion && (
                <Input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="Version Number"
                />
              )}
                <Switch checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)}>
                Has Online Fix
                </Switch>
                <Switch checked={hasDLC} onChange={(e) => setHasDLC(e.target.checked)}>
                Includes All DLC's
                </Switch>
              <ModalFooter>
                <Button variant='ghost' onClick={handleSubmit}>Add Game</Button>
              </ModalFooter>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default GamesAddModal;