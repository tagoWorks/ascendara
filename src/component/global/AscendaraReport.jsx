import React, { useState, useEffect } from "react";
import { WarningIcon } from "../global/WarningIcon";

import {
  Input,
  Button,
  Modal,
  Spinner,
  ModalContent,
  ModalHeader,
  Spacer,
  ModalBody,
  ModalFooter,
  Textarea,
  Card,
  CardBody,
} from "@nextui-org/react";

const ReportModal = ({ isReportOpen, onReportClose }) => {
  const [reportReason, setReportReason] = useState("");
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };

    if (isReportOpen) {
      fetchToken();
    }
  }, [isReportOpen]);

  useEffect(() => {
    if (!isReportOpen) {
      setReportReason("");
      setValue("");
      setReportSubmitted(false);
      setError("");
    }
  }, [isReportOpen]);

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
    if (value.trim() === "" || authToken === "") {
      setError("Please fill out the required fields.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch("https://api.ascendara.app/app/report/feature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          reportType: "AscendaraApp",
          reason: reportReason,
          details: value,
        }),
      });

      if (response.ok) {
        console.log("Report submitted successfully");
        setReportSubmitted(true);
      } else {
        console.error("Failed to submit report");
        setError("Failed to submit report. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      hideCloseButton
      isOpen={isReportOpen}
      onClose={onReportClose}
      className="justify-center arial"
      classNames={{
        backdrop: "bg-[#fff]/0",
        base: "border-[#292f46] bg-[#19172c] fixedarial",
      }}
    >
      <ModalContent>
        <ModalHeader>Report a Bug</ModalHeader>
        <ModalBody>
          {reportSubmitted ? (
            <p>Thank you for your help</p>
          ) : (
            <div>
              <Card
                classNames={{
                  base: "border-[#292f46] bg-[#19172c] fixedarial",
                }}
              >
                <CardBody style={{ display: "flex", alignItems: "center" }}>
                  <WarningIcon fill="#FF4433" />
                  <p className="text-small">
                    When reporting a bug or issues with game info, your IP address
                    will be obfuscated with a unique ID, and then temporarily stored
                    in order to prevent spam.
                  </p>
                </CardBody>
              </Card>

              <Spacer y={5} />

              <Input
                  isRequired
                  label="What is it that you're reporting?"
                  value={reportReason}
                  onChange={(value) => handleReasonChange(value)}
                >

              </Input>
              <Spacer y={5} />
              <Textarea
                isRequired
                label="Detailed Description"
                className="mt-4"
                value={value}
                onChange={handleTextareaChange}
              />
              {error && <p className="error-text">{error}</p>}
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