import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";

export default function NoDownloadPath({ isOpen, onClose }) {
  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>No Download Path Selected</ModalHeader>
        <ModalBody>
          Please go to settings and select a directory to download games into.
        </ModalBody>
        <ModalFooter>
          <Button auto flat color="error" onClick={onClose}>
            Got it
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}