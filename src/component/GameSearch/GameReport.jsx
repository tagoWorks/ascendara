import React, { useState, useEffect } from "react";
import { ReportIcon } from "./ReportIcon";
import { Autocomplete, AutocompleteItem, Button, Modal, Spinner, ModalContent, ModalHeader, Spacer, ModalBody, ModalFooter, Textarea } from "@nextui-org/react";
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
          'Authorization': `Bearer ${authToken}`
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
    <Modal isOpen={isReportOpen} onClose={onReportClose} className="justify-center">
      <ModalContent>
        <ModalHeader>Reporting a game | {gameName}</ModalHeader>
        <ModalBody>
          {reportSubmitted ? (
            <p>Thank you for your help</p>
          ) : (
            <div>
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
                <Button variant="solid" color="success" onClick={onReportClose}>
                  Close
                </Button>
              ) : (
                <Button variant="solid" color="error" onClick={handleSubmitReport}>
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
