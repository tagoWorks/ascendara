import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Image, Spacer, Chip } from "@nextui-org/react";

const ThemesModal = ({ isOpen, onOpenChange }) => {
  const [backgrounds, setBackgrounds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchBackgrounds();
    }
  }, [isOpen]);

  const fetchBackgrounds = async () => {
    try {
      const backgrounds = await window.electron.getBackgrounds();
      setBackgrounds(backgrounds);
    } catch (error) {
      console.error("Error fetching backgrounds:", error);
    }
  };

  const setBackground = (backgroundName) => {
    console.log(backgroundName)
  
    if (backgroundName.includes('(Gradient)')) {
      window.electron.setBackground(null, backgroundName);
    } else {
      window.electron.setBackground(backgroundName, null);
    }
  
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      classNames={{ backdrop: "backdrop-opacity-50 backdrop-blur" }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              <h3>Backgrounds <Chip size='md' variant='solid' color='danger'>UNDER DEVELOPMENT</Chip></h3>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h1>Gradient</h1>
                  <Spacer y={3} />
                  {backgrounds.filter(bg => bg.name.includes('(Gradient)')).map((background) => {
                    const name = background.name.replace(/\.(png|jpg|jpeg)$/i, '').replace(/\s*\([^)]*\)\s*/g, '');
                    return (
                      <div key={background.name} className="gradient-side">
                        <Image
                          onClick={() => setBackground(background.name, true)}
                          src={background.preview}
                          width={90}
                          height={90}
                          alt={name}
                        />
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h1>Solid</h1>
                  <Spacer y={3} />
                  {backgrounds.filter(bg => bg.name.includes('(Solid)')).map((background) => {
                    const name = background.name.replace(/\.(png|jpg|jpeg)$/i, '').replace(/\s*\([^)]*\)\s*/g, '');
                    return (
                      <div key={background.name} className="solid-side">
                        <Image
                          onClick={() => setBackground(background.name)}
                          src={background.preview}
                          width={90}
                          height={90}
                          alt={name}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ThemesModal;