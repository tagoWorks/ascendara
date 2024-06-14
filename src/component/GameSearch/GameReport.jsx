import React, { useState, useEffect } from "react";
import { ReportIcon } from "./ReportIcon";
import { WarningIcon } from "../global/WarningIcon";

import { Autocomplete, AutocompleteItem, Button, Modal, Spinner, ModalContent, ModalHeader, Spacer, ModalBody, ModalFooter, Textarea, Card, CardBody } from "@nextui-org/react";
import "./browsing.css";

const ReportModal = ({ isReportOpen, onReportClose, gameName }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [authToken, setAuthToken] = useState("");
  
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };

    fetchToken();
  }, []);

  const handleReasonChange = (event) => {
    setReportReason(event.target.value);
  };

  const handleTextareaChange = (event) => {
    setValue(event.target.value);
  };

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

  const handleSubmitReport = async () => {
    setIsLoading(true);
    if (value.trim() === '' || authToken === '') {
      onReportClose();
      return;
    }
    try {
      const response = await fetch('https://api.ascendara.app/app/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          reportType: "GameBrowsing",
          reason: reportReason,
          details: value,
          gameName: gameName,
        }),
      });

      if (response.ok) {
        console.log('Report submitted successfully');
        setReportSubmitted(true);
      } else {
        console.error('Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isReportOpen} onClose={onReportClose} className="justify-center arial" classNames={{
      backdrop: "bg-[#fff]/0",
      base: "border-[#292f46] bg-[#19172c] fixedarial",
    }}>
      <ModalContent>
        <ModalHeader>Reporting a game | {gameName}</ModalHeader>
        <ModalBody>
          {reportSubmitted ? (
            <p>Thank you for your help</p>
          ) : (
            <div>

              <Card classNames={{
                base: "border-[#292f46] bg-[#19172c] fixedarial",
              }}>
                <CardBody style={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon fill="#FF4433"/>
                    <p className="text-small">
                      When reporting a bug with a game or feature, your IP address
                      is temporally saved on Ascendara servers only, in order to prevent spam.
                    </p>
                </CardBody>
              </Card>

              <Spacer y={5} />

              <Autocomplete
                isRequired
                disableSelectorIconRotation
                selectorIcon={null}
                allowsCustomValue
                label="What are you reporting?"
                placeholder="Select or type a reason"
                value={reportReason}
                onSelectionChange={handleReasonChange}
                className="autocomplete-with-spacing"
              >
                <AutocompleteItem value="gamedetails">Game Details Misleading</AutocompleteItem>
                <AutocompleteItem value="filesnotdownloading">Files Not Downloading</AutocompleteItem>
                <AutocompleteItem value="linksnotworking">A Link Is Not Working</AutocompleteItem>

              </Autocomplete>
              <Spacer y={5} />
              <Textarea
                isRequired
                label="Description"
                placeholder="Enter your description"
                className="mt-4"
                value={value}
                onChange={handleTextareaChange}
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <>
              {reportSubmitted ? (
                <Button variant="ghost" color="primary" onClick={onReportClose}>
                  Close
                </Button>
              ) : (
                <Button variant="ghost" color="success" onClick={handleSubmitReport}>
                  Submit Report
                </Button>
              )}
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReportModal;
