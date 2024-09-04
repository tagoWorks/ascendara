import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardFooter, Chip, Button, Spacer, CircularProgress, Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem } from "@nextui-org/react";
import { GamesSetting } from "./svg/ThreeDotsVerticle";
import { DirectoryIcon } from "./svg/DirectoryIcon";
import { ShortCutIcon } from "./svg/ShortCutIcon";
import { DeleteIcon } from "./svg/DeleteIcon";

const CustomCardComponent = ({
  game,
  online,
  dlc,
  version,
  executable,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

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
    setIsUninstalling(true);
    window.electron.removeCustomGame(game);
    window.location.reload();
  };

  const handleOpenExplorer = () => {
    window.electron.openGameDirectory(game, true);
  };


  const handlePlayGame = () => {
    window.electron.playGame(game, true);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  window.setGamesData = (gamesData) => {
    setGames(gamesData);
  };

  return (
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
              <h5 className="">
                <div className="flex items-center gap-2">
                  {isUninstalling ? (
                    <Chip color="danger" variant="solid" size="m">
                      Removing...
                    </Chip>
                  ) : (
                    <>
                    <Chip color="primary" variant="shadow" size="sm">
                        ADDED
                    </Chip>
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
              <DropdownItem isDisabled onClick startContent={
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
            </DropdownSection>
              <DropdownItem onClick={handleDeleteGame} startContent={
                <div className="flex items-center justify-start">
                  <DeleteIcon className="text-xl text-default-500 pointer-events-none flex-shrink-0" />
                </div>
              }>
                Remove from Library
              </DropdownItem>
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
            {isRunning ? "PLAYING" : "PLAY"}
          </Button>)}
        
      </CardFooter>
    </Card>
  );
};

export default CustomCardComponent;
