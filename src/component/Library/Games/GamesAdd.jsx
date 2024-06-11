import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";

const GamesAddModal = ({ isOpen, onOpenChange }) => {

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
              <h3>Add your game</h3>
            </ModalHeader>
            <ModalBody>

            </ModalBody>
            <ModalFooter>

            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default GamesAddModal;