import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";

const TrustModal = ({ isOpen, onOpenChange, game }) => {
  const [loading, setLoading] = useState(false);

  const getToken = async () => {
    const AUTHORIZATION = await window.electron.getAPIKey();
    const response = await fetch("https://api.ascendara.app/auth/token", {
      headers: {
        Authorization: `Bearer ${AUTHORIZATION}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    } else {
      throw new Error("Failed to obtain token");
    }
  };

  const handleTrustClick = async () => {
    setLoading(true);
    try {
      const games = await window.electron.getGames();
      const gameExists = games.some((gameItem) => gameItem.game === game);
      if (!gameExists) {
        console.log(`Game ${game} does not exist in the list of games. Trust request cancelled.`);
        return;
      }

      const token = await getToken();
      const response = await fetch("https://api.ascendara.app/app/trust", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gameName: game }),
      });

      if (response.ok) {
        console.log("Game trusted successfully");
      } else {
        console.error("Error trusting game:", response.status);
      }
    } catch (error) {
      console.error("Error trusting game:", error);
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const handleNevermindClick = () => {
    onOpenChange(false);
  };

  return (
    <Modal
      hideCloseButton
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
    >
      <ModalContent>
        <ModalHeader>Trust {game}?</ModalHeader>
        <ModalBody>
          <p>If you've successfully downloaded and played this game before, it's likely to work 
            for others too! By trusting this game, you're helping to let the Ascendara community 
            know that it's been tested and works well. Trusting a game you already trusted in the
            past does nothing.<br/>
            <br/>
            <b>Please note:</b> It may take up to 30 minutes for this change to take effect.</p>
        </ModalBody>
        <ModalFooter>
          <Button
            aria-label="VerifyGame"
            variant="ghost"
            color="primary"
            onClick={handleTrustClick}
            isLoading={loading}
          >
            I trust this game
          </Button>
          <Button
            color="danger"
            variant="ghost"
            onClick={handleNevermindClick}
          >
            Nevermind
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TrustModal;
