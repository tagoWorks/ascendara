import React, { useState } from 'react';
import { Card, CardHeader, Spinner, CardFooter, CardBody, Chip, Spacer, Button, Progress, Divider, Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Input } from '@nextui-org/react';
import { StopIcon } from './StopIcon';
import '../library.css'

const CardComponent = ({ game, online, dlc, version, dirlink, downloadingData }) => {
  const isDownloading = downloadingData && downloadingData.downloading;
  const isExtracting = downloadingData && downloadingData.extracting;
  const isUpdating = downloadingData && downloadingData.updating;
  const hasError = downloadingData && downloadingData.error;
  const [isStopping, setIsStopping] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [retryLink, setRetryLink] = useState('');
  const handleStopDownload = async () => {
    setIsStopping(true);
    await window.electron.killDownload(game);
    setIsStopping(false);
  };

  const handleRetryDownload = () => {
    setShowModal(true);
  };

  const handleRetryConfirm = async () => {
    await window.electron.retryDownload(retryLink);
    setShowModal(false);
  };

  const handleRetryFolderExtract = async () => {
    await window.electron.retryExtract(game, online, dlc, version);
  };

  const handleOpenFolder = async () => {
    await window.electron.openGameDirectory(game);
  };

  if (!isDownloading && !isExtracting && !isUpdating && !hasError) {
    return null;
  }

  return (
    <>
      <Card isBlurred className="py-4 px-4 bg-background/60 dark:bg-default-100/50">
        <CardHeader className="justify-between items-center">
          <Dropdown className=''>
            <DropdownTrigger>
              {isStopping ? (
                <Spinner color="danger" size="sm" className="transform -translate-x-1/2 -translate-y-1/2" />
              ) : (
                <Button isIconOnly variant='none' className="transform -translate-x-1/2 -translate-y-1/2">
                  {!hasError && <StopIcon fill="#d8504d" size={20}/>}
                </Button>
              )}
            </DropdownTrigger>
            <DropdownMenu className='justify-center'>
              <DropdownSection>
                <DropdownItem variant='flat' color='danger' aria-label='Confirm' description='Are you sure you want to stop installing this game?' onClick={handleStopDownload}>
                  {isStopping ? 'Stopping...' : 'Stop the Download'}
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
          <div className="flex">
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold leading-none text-default-600">
                  {game}
                  {isDownloading && <span className="text-default-400 px-2"><Chip color="success" variant="flat" size="sm">Downloading</Chip></span>}
                  {isExtracting && <span className="text-default-400 px-2"><Chip color="warning" variant="flat" size="sm">Extracting</Chip></span>}
                  {isUpdating && <span className="text-default-400 px-2"><Chip color="success" variant="flat" size="sm">Updating</Chip></span>}
                  {hasError && <span className="text-default-400 px-2"><Chip color="danger" variant="flat" size="sm">Error</Chip></span>}
                </h4>
                <Spacer x={5} />
              </div>
              <h5 className="text-small tracking-tight text-default-400">
                {version}
              </h5>
            </div>
          </div>
        </CardHeader>
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <CardBody className="justify-between items-center">
          {isDownloading ? (
            <div className="py-3 flex gap-2">
              <Chip color="default" variant="flat" size="sm">
                {downloadingData.progressDownloadSpeeds}
              </Chip>
              <Chip color="default" variant="flat" size="sm">
                ETA: {downloadingData.timeUntilComplete}
              </Chip>
              <Divider className="my-4" />
            </div>
          ) : null}
        </CardBody>
        {isDownloading ? (
          <CardFooter className="wrap justify-between items-center">
            <Progress
              value={downloadingData.progressCompleted}
              color="default"
            />
            <div className="flex py-2">
              <Chip color="default" variant="bordered" size="sm">
                {downloadingData.progressCompleted}%
              </Chip>
            </div>
          </CardFooter>
        ) : (
          <Progress
            isIndeterminate={hasError ? false : true}
            color="default"
          />
        )}
        {hasError ? (
          <CardFooter className="wrap justify-between items-center">
            <div className="flex">
              <Button color="danger" variant="ghost" size="l" onClick={handleStopDownload}>
                Cancel & Delete
              </Button>
              <Spacer x={5} />
              <Dropdown>
                <DropdownTrigger>
                  <Button color="primary" variant="ghost" size="l">
                    Retry
                  </Button>
                </DropdownTrigger>
                <DropdownMenu className='justify-center'>
                  <DropdownSection>
                    <DropdownItem variant='flat' color='default' aria-label='Confirm' description='Attempt to redownload the game and extract again.' onClick={handleRetryDownload}>
                      Retry Download
                    </DropdownItem>
                    {!window.electron.checkRetryExtract(game) && (
                      <DropdownItem variant='flat' color='default' aria-label='Confirm' description='Select the extracted game folder.' onClick={handleRetryFolderExtract}>
                        Select Game Folder
                      </DropdownItem>
                    )}
                  </DropdownSection>
                </DropdownMenu>
              </Dropdown>
            </div>
          </CardFooter>
        ) : null}
      </Card>
      
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalContent>
        <ModalHeader>
          <h4>Retry Download</h4>
        </ModalHeader>
        <ModalBody>
          <Input
            fullWidth
            placeholder="Enter download link"
            value={retryLink}
            onChange={(e) => setRetryLink(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button auto flat color="error" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button auto onClick={handleRetryConfirm}>
            Confirm
          </Button>
        </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CardComponent;