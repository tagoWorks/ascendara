import React, { useState, useEffect, } from "react";
import { ReportIcon } from "./ReportIcon";
import { SeemlessDownloadIcon } from "./SeemlessDownloadIcon"
import ReportModal from "./GameReport";
import {
  Card,
  CardHeader,
  Chip,
  Button,
  Spacer,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Snippet,
  useDisclosure,
  Select,
  SelectItem,
  Spinner,
  Link,
  Tab,
  Tabs,
  Kbd
} from "@nextui-org/react";

const isValidURL = (url, provider) => {
  const trimmedUrl = url.trim();
  if (trimmedUrl === '') {
    return true;
  }

  let pattern;
  
  switch (provider.toLowerCase()) {
    case 'megadb':
      pattern = /^(https?:\/\/)([^\/?#]+)(?::(\d+))?(\/[^?#]*\/[^?#]*\/)([^?#]+)\.(?:zip|rar|7z)$/i;
      break;
    case 'buzzheavier':
      pattern = /^https:\/\/dl\.buzzheavier\.com\/\d+(?:\?.*?)?$/i;
      break;
    case 'gofile':
      pattern = /^https:\/\/store\d*\.gofile\.io\/download\/web\/[a-f0-9-]+\/[\w\s\.-]+\.(?:zip|rar|7z)$/i;
      break;
    default:
      return false;
  }

  const match = pattern.test(trimmedUrl);
  if (!match) {
    return false;
  }

  const domainRegex = new RegExp(provider, 'i');
  const containsProviderName = domainRegex.test(trimmedUrl);

  return containsProviderName;
};

const CardComponent = ({ game, online, version, size, dirlink, downloadLinks, dlc }) => {
  const [inputLink, setInputLink] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedLink, setSelectedLink] = useState("");
  const [isDownloadStarted, setIsDownloadStarted] = useState(false);
  const [withExtension, setWithExtension] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isReportOpen, setReportOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showNoDownloadPath, setShowNoDownloadPath] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [tabKey, setTabKey] = useState("with-extension");

  const handleOpenReport = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  useEffect(() => {
    const handleDownloadLink = (downloadLink) => {
      if (isValidURL(downloadLink)) {
        setInputLink(downloadLink);
        onOpen();
      }
    };

    window.handleDownloadLink = handleDownloadLink;
  }, [onOpen]);

  useEffect(() => {
    if (!isOpen) {
      setInputLink("");
      setSelectedProvider("");
      setSelectedLink("");
    }
  }, [isOpen]);
  const handleDownload = async () => {
    if (showNoDownloadPath) {
      setShowDirectoryModal(true);
      return;
    }
    const settings = await window.electron.getSettings();
    if (settings.seamlessDownloads) {
      if (downloadLinks["gofile"] && downloadLinks["gofile"].length > 0) {
        setSelectedProvider("gofile");
        const gofileLink = downloadLinks["gofile"][0];
        setSelectedLink(gofileLink);
        window.electron.downloadFile(gofileLink, game, online, dlc, version);
        setIsDownloadStarted(true); // Set download started to true
        console.log(
          `SENDING LOAD: ${gofileLink}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}`
        );
      } else {
        onOpen();
      }
    } else {
      onOpen();
    }
  };
  const checkDownloadPath = async () => {
    try {
      const settings = await window.electron.getSettings();
      if (!settings.downloadDirectory) {
        setShowNoDownloadPath(true);
      }
    } catch (error) {
      console.error('Error getting settings:', error);
    }
  };
  useEffect(() => {
    checkDownloadPath();
  }, []);
  useEffect(() => {
    const fetchDownloadingGames = async () => {
      try {
        const games = await window.electron.getGames();
        games.forEach((games) => {
          if (games.game === game) {

            setIsInstalled(true);
            console.log(`Game ${game} is installed`);
          }
        })
      } 
      catch (error) {
        console.error('Error fetching downloading games:', error);
      }
    };
    fetchDownloadingGames();
  }, []);
  
  useEffect(() => {
    const checkIfGameIsInstalled = async () => {
      try {
        const games = await window.electron.getGames();
        const installedGame = games.find((installedGame) => installedGame.game === game);
        if (installedGame) {
          setIsInstalled(true);
          console.log(`Game ${game} is installed`);
        } else {
          setIsInstalled(false);
        }
      } catch (error) {
        console.error('Error checking if game is installed:', error);
      }
    };
    checkIfGameIsInstalled();
  }, [game]);
  const downloadFile = () => {
    if (showNoDownloadPath) {
      return;
    }
    setIsStartingDownload(true);
    
    setTimeout(() => {
      if (selectedProvider === 'gofile') {
        window.electron.downloadFile(selectedLink, game, online, dlc, version);
        console.log(
          `SENDING LOAD: ${selectedLink}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}`
        );
      } else {
        if (inputLink.trim() === '') {
          alert("Please enter a download link");
          setIsStartingDownload(false);
          return;
        }
        if (!isValidURL(inputLink, selectedProvider)) {
          alert("Please enter a valid download URL from your selected provider");
          setIsStartingDownload(false);
          return;
        }
        window.electron.downloadFile(inputLink, game, online, dlc, version);
        console.log(
          `SENDING LOAD: ${inputLink}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}`
        );
      }
      
      setTimeout(() => {
        setIsStartingDownload(false);
        onClose();
      }, 2000);
    }, 0);
  };
  
  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    const selectedLinks = downloadLinks[provider] || [];
    const link = selectedLinks[0] || "";
    setSelectedLink(link);
    console.log(`Selected Provider: ${provider}`);
    console.log(`Selected Link: ${link}`);
  };

  
  return (
    <>
      <Card isBlurred className="wrap px-5 border-none bg-background/60 dark:bg-default-100/50">
        <CardHeader className="justify-between items-center">
          <div className="flex gap-5">
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center gap-2">
                <h4 className="text-small font-semibold leading-none text-default-600">
                  {game}
                </h4>
                  <h5 className="text-small tracking-tight text-default-400">
                  {version}
                  </h5>
                  <Spacer x={2} />
              </div>
              <div className="flex items-center gap-2">
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
                <Spacer x={5} />
              </div>
            </div>
          </div>
          {!isInstalled ? (
            <Button
              aria-label="Download"
              color="primary"
              variant="ghost"
              radius="full"
              size="sm"
              onClick={handleDownload}
            >
              Download {size}
              {downloadLinks["gofile"] && (
                <SeemlessDownloadIcon size="15px" />
              )}
          </Button>
        ) : (
          <Button 
            isDisabled
            aria-label="Installed"
            color="primary"
            variant="faded"
            radius="full"
            size="sm"
          >
            Installed
          </Button>
        )}
        </CardHeader>
      </Card>
      <Modal isDismissable={false} isOpen={isOpen} onClose={onClose} size="5xl" className="fixed arial" classNames={{
                    body: "py-6",
                    backdrop: "bg-[#292f46]/50",
                    base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",
                  }}>
        <ModalContent>
          <ModalHeader>
              <div>
                Download {game}
                <Button aria-label="ReportGame" isIconOnly variant="blank" size="sm" onClick={handleOpenReport}><ReportIcon size="15px" /></Button>
                {isReportOpen && <ReportModal
                  gameName={game}
                  isReportOpen={isReportOpen}
                  onReportClose={handleCloseReport}
                  setReportReason={setReportReason}
                />}
              </div>
            </ModalHeader>
          <ModalBody>
            <Select
              aria-label="ProviderSelector"
              value={selectedProvider}
              size="lg"
              onChange={(e) => handleSelectProvider(e.target.value)}
              placeholder="To get started, select a download provider"
            >
              {Object.keys(downloadLinks).map((provider) => (
                <SelectItem className="arial" key={provider} value={provider}>
                {provider === "gofile"
                  ? "Seemless (GoFile)"
                  : provider === "megadb"
                  ? "Default (MegaDB)"
                  : provider}
              </SelectItem>
              ))}
            </Select>
            {selectedProvider ? (
              selectedProvider === "gofile" ? (
                <>
                  <h3>Direct Link:</h3>
                  <div>
                  <Snippet size="md" hideSymbol variant="none">
                    <a>https:{selectedLink}</a>
                  </Snippet>
                  </div>
                  <h2 className="text-large">Thanks to ltsdw on GitHub</h2>
                  <h3>Unlike other providers that require a CAPTCHA verification, <br/>
                    GoFile allows direct downloads through their API without such interruptions.</h3>
                  <h3 className="text-large">Simply click on Download to start downloading this game.</h3>
                </>
              ) : (
                <>
                <h3>Download Link:</h3>
                <div>
                  <Snippet onClick={() => window.electron.openURL(`https://${selectedLink}`)} variant="solid" hideCopyButton size="md" hideSymbol>
                    <a>https:{selectedLink}</a>
                  </Snippet>
                </div>
                <Tabs
                  selectedKey={tabKey}
                  onSelectionChange={setTabKey}
                  aria-label="Download Instructions"
                  color="secondary"
                  className="extensiontab"
                  isVertical
                  variant="light"
                  size="md"
                >
                  <Tab key="with-extension" title="With Extension">
                    
                    <p classname="text-small">Make sure you have the <Link onClick={() => window.electron.openURL('https://ascendara.app/extension')}>Ascendara Download Blocker</Link> extension enabled!</p>
                    <h2 className="text-large">Step 1. Copy and paste the link into your browser</h2>
                    <h2 className="text-large">Step 2. Complete the CAPTCHA and start the download</h2>
                    <h2 className="text-large">Step 3. The extension will stop the download and provide you the direct download link (DDL)</h2>
                    <h2 className="text-large">Step 4. Paste the DDL in the input below and start the download</h2>
                  </Tab>
                  <Tab key="without-extension" title="Without Extension">
                    <div className="grid grid-cols-2 gap-4">
                    <h2 className="text-large">Step 1. Copy and paste the link into your browser</h2>

                    <h2 className="text-large">Step 4. Hit <Kbd>CTRL+J</Kbd> to open your downloads</h2>

                    <h2 className="text-large">Step 2. Complete the CAPTCHA and start the download</h2>

                    <h2 className="text-large">Step 5. Copy the link that the browser started downloading</h2>

                    <h2 className="text-large">Step 3. Stop the download once it starts in your browser</h2>

                    <h2 className="text-large">Step 6. Paste the link in the input below and start the download</h2>
                    </div>
                  </Tab>
                </Tabs>
                <Spacer y={2} />
                <h3 className="text-small text-default-400">Some providers may limit download speeds</h3>
                <Input
                  label="Enter the download link here"
                  value={inputLink}
                  onChange={(e) => setInputLink(e.target.value)}
                  isInvalid={!isValidURL(inputLink, selectedProvider, game)}
                  errorMessage="Please enter a valid download URL from your selected provider"
                />
              </>
            )
          ) : (
            <></>
          )}
        </ModalBody>
            <ModalFooter>
            {selectedProvider ? (
              <Button 
                aria-label="StartDownloading" 
                variant="ghost" 
                color="success" 
                onClick={downloadFile}
                isDisabled={isStartingDownload}
              >
                {isStartingDownload ? (
                  <>
                    Starting Download
                    <Spinner size="sm" color="success" />
                  </>
                ) : (
                  "Start Downloading"
                )}
              </Button>
            ) : <></>}
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        hideCloseButton
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        size="md"
        className="fixed arial"
        classNames={{
          body: "py-6",
          backdrop: "bg-[#292f46]/50",
          base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixedarial",
        }}
      >
        <ModalContent>
          <ModalHeader>Hang on there!</ModalHeader>
          <ModalBody>
            <p>
              You cannot download games yet. Please set a games directory by clicking the
              settings button on the bottom left, then click on the Download Directory input.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              color="success"
              onClick={() => setShowDirectoryModal(false)}
            >
              Okay
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {isDownloadStarted && (
        <Modal
          isOpen={isDownloadStarted}
          onClose={() => setIsDownloadStarted(false)}
          size="md"
          className="fixed arial"
          classNames={{
            body: "py-6",
            backdrop: "bg-[#292f46]/50",
            base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",
          }}
        >
          <ModalContent>
            <ModalHeader>Downloading {game}</ModalHeader>
            <ModalBody>
              <p>{game} is now downloading. Check the progress in the Library.</p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                color="success"
                onClick={() => window.location.reload()}
              >
                Okay
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

export default CardComponent;