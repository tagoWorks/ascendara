import React, { useState, useEffect, } from "react";
import { ReportIcon } from "./ReportIcon";
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
  Link,
  Snippet,
  useDisclosure,
  Select,
  SelectItem,
} from "@nextui-org/react";

const isValidURL = (url, provider) => {
  console.log(url, provider);
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
      pattern = /^https:\/\/dl\.buzzheavier\.com\/\d+$/;
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

const CardComponent = ({ game, online, version, dirlink, downloadLinks, dlc }) => {
  const [inputLink, setInputLink] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedLink, setSelectedLink] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [isReportOpen, setReportOpen] = useState(false);
  const [isGameInstalled, setIsGameInstalled] = useState(false);
  const [isGameDownloading, setIsGameDownloading] = useState(false);
  const [showNoDownloadPath, setShowNoDownloadPath] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

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

  const handleDownload = () => {
    if (showNoDownloadPath) {
      setShowDirectoryModal(true);
      return;
    }
    if (!isValidURL(inputLink)) {
      alert("Please enter a valid download URL from your selected provider");
      return;
    }
    onOpen();
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
  const downloadFile = () => {
    if (showNoDownloadPath) {
      return;
    }
    if (inputLink.trim() === '') {
      alert("Please enter a download link");
      return;
    }
    if (!isValidURL(inputLink, selectedProvider)) {
      alert("Please enter a valid download URL from your selected provider");
      return;
    }
    window.electron.downloadFile(inputLink, game, online, dlc, version);
    console.log(
      `SENDING LOAD: ${inputLink}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}`
    )
    onClose();
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
      <Card className="wrap px-5">
        <CardHeader className="justify-between items-center">
          <div className="flex gap-5">
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center gap-2">
                <h4 className="text-small font-semibold leading-none text-default-600">
                  {game}
                </h4>
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
              <h5 className="text-small tracking-tight text-default-400">
              {version}
              </h5>
            </div>
          </div>
          <Button
            isDisabled={isGameInstalled || isGameDownloading}
            color="primary"
            variant="ghost"
            radius="full"
            size="sm"
            onClick={handleDownload}
          >
            Download
          </Button>
        </CardHeader>
      </Card>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" className="fixed arial">
        <ModalContent>
          <ModalHeader>
              <div>
                Download {game}
                <Button isIconOnly variant="blank" size="sm" onClick={handleOpenReport}><ReportIcon size="15px" /></Button>
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
              value={selectedProvider}
              onChange={(e) => handleSelectProvider(e.target.value)}
              placeholder="To get started, select a download provider"
            >
              {Object.keys(downloadLinks).map((provider) => (
                <SelectItem className="arial" key={provider} value={provider}>
                  {provider === "gofile"
                    ? "Easiest (GoFile)"
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
                  <Snippet isDisabled size="md" className="justify-center" hideSymbol variant="none">
                    <a>https:{selectedLink}</a>
                  </Snippet>
                  <h2 className="text-large">Thanks to ltsdw on GitHub</h2>
                  <h3>Unlike other providers that require a CAPTCHA verification, 
                    GoFile allows direct downloads through their API without such interruptions.</h3>
                  <h3 className="text-large">Simply click on Download to start downloading this game.</h3>
                </>
              ) : (
                <>
                  <h3>Download Link:</h3>
                  <Snippet size="md" className="justify-center" hideSymbol variant="none">
                    <a>https:{selectedLink}</a>
                  </Snippet>
                  <h2 className="text-large">Step 1.</h2>
                  <h3>Copy and paste the link into your browser and find the Download button</h3>
                  <h2 className="text-large">Step 2.</h2>
                  <h3>Stop the download once it starts in your browser, and copy the link that the browser started downloading</h3>
                  <h2 className="text-large">Step 3.</h2>
                  <h3>Paste the link in the input below and click "Next"</h3>
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
            <Button
              variant="ghost"
              color="success"
              onClick={() => setShowDirectoryModal(false)}
            >
              Download
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CardComponent;
