import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardFooter, Chip, Button, Spacer, CircularProgress, Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { GamesSetting } from "./svg/ThreeDotsVerticle";
import { DirectoryIcon } from "./svg/DirectoryIcon";
import { UpdateIcon } from "./svg/UpdateIcon";
import { ShortCutIcon } from "./svg/ShortCutIcon";
import { DeleteIcon } from "./svg/DeleteIcon";
import { EditIcon } from "./svg/EditIcon";

const CardComponent = ({
  game,
  online,
  dlc,
  version,
  path,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    const checkIfGameIsRunning = setInterval(async () => {
      const running = await window.electron.isGameRunning(game);
      setIsRunning(running);
    }, 1000);

    return () => clearInterval(checkIfGameIsRunning);
  }, [game]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleDeleteGame = () => {
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteGame = () => {
    setIsConfirmModalOpen(false);
    setIsUninstalling(true);
    window.electron.deleteGame(game);
    window.location.reload();
  };

  const handleEditGame = async () => {
    const exePath = await window.electron.openFileDialog();
    if (exePath) {
      console.log('Selected directory:', exePath);
      window.electron.modifyGameExecutable(game, exePath);
    }
  };

  const handleUpdateGame = () => {
    console.log("Update game:", game);
  };

  const handleOpenExplorer = () => {
    window.electron.openGameDirectory(game, false);
  };

  const handleReqLibraries = () => {
    window.electron.openReqPath(game);
  };

  const handlePlayGame = () => {
    window.electron.playGame(game, false);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  window.setGamesData = (gamesData) => {
    setGames(gamesData);
  };

  return (
    <>
      <Card isBlurred className="cards py-4 px-5 cards bg-background/60 dark:bg-default-100/50">
        <CardHeader>
          <div>
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold leading-none text-default-600">
                  {game}
                </h4>
                <p className="text-small tracking-tight text-default-400">{version}</p>
                <Spacer x={5} />
              </div>
              <h5>
                <div className="flex items-center gap-2">
                  {isUninstalling ? (
                    <Chip color="danger" variant="solid" size="m">
                      Uninstalling...
                    </Chip>
                  ) : (
                    <>
                      {online && (
                        <Chip color="success" variant="shadow" size="sm">
                          ONLINE
                        </Chip>
                      )}
                      {dlc && (
                        <Chip color="warning" variant="shadow" size="sm">
                          ALL-DLC
                        </Chip>
                      )}
                    </>
                  )}
                </div>
              </h5>
            </div>
          </div>
        </CardHeader>
        <CardFooter>
          <Dropdown open={isOpen} onOpenChange={setIsOpen} isDisabled={isUninstalling}>
            <DropdownTrigger>
              <Button isIconOnly color="default" size="sm" variant="light" onClick={toggleDropdown} disabled={isUninstalling}>
                {isUninstalling ? null : <GamesSetting />}
              </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" aria-label="Game Actions">
              <DropdownSection title="Actions">
                  <DropdownItem isDisabled onClick={() => window.electron.createShortcut(game)} startContent={
                    <div className="flex items-center justify-start">
                      <ShortCutIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
                    </div>
                  }>
                    Create a Shortcut
                  </DropdownItem>
                <DropdownItem onClick={handleOpenExplorer} startContent={
                  <div className="flex items-center justify-start">
                    <DirectoryIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
                  </div>
                }>
                  Open in Explorer
                </DropdownItem>
                <DropdownItem onClick={handleEditGame} startContent={
                  <div className="flex items-center justify-start">
                    <EditIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
                  </div>
                }>
                  Change Executing File
                </DropdownItem>
              </DropdownSection>
              <DropdownSection title="Danger Zone">
                <DropdownItem onClick={handleDeleteGame} startContent={
                  <div className="flex items-center justify-start">
                    <DeleteIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
                  </div>
                }>
                  Uninstall
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
          <Spacer x={2} />
          {isUninstalling ? null : (
            <Button
              color="success"
              radius="full"
              size="lg"
              variant={isRunning ? "solid" : "ghost"}
              spinner={isLoading ? <CircularProgress color="success" size="sm" /> : null}
              onClick={handlePlayGame}
              isLoading={isLoading}
              disabled={isRunning}
            >
              {isRunning ? "Running" : "PLAY"}
            </Button>)}
        </CardFooter>
      </Card>

      <Modal 
        isDismissable={false}
        hideCloseButton
        isOpen={isConfirmModalOpen} 
        onOpenChange={setIsConfirmModalOpen}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Are you sure you want to uninstall {game}?</ModalHeader>
              <ModalBody>
                <p>This action is irreversible.</p>
                <p>Saved data/progress for games are probably stored at a different location. These files will not be deleted.</p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" onPress={confirmDeleteGame}>
                  Uninstall
                </Button>
                <Button variant="bordered" color="primary" onPress={onClose}>
                  Cancel
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default CardComponent;