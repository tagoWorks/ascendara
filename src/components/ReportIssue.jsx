import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ReportIssue = ({ isOpen, onClose }) => {
  const [reportReason, setReportReason] = useState("");
  const [details, setDetails] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error("Error fetching token:", error);
        toast.error("Authentication Failed", {
          description: "Unable to authenticate. Please try again later."
        });
      }
    };

    if (isOpen) {
      fetchToken();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setReportReason("");
      setDetails("");
    }
  }, [isOpen]);

  const getToken = async () => {
    const AUTHORIZATION = await window.electron.getAPIKey();
    const response = await fetch("https://api.ascendara.app/auth/token", {
      headers: {
        Authorization: `Bearer ${AUTHORIZATION}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to obtain token");
    }

    const data = await response.json();
    return data.token;
  };

  const handleSubmit = async () => {
    if (!reportReason.trim() || !details.trim()) {
      toast.error("Missing Information", {
        description: "Please fill out all required fields."
      });
      return;
    }

    const promise = new Promise(async (resolve, reject) => {
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
            details: details,
          }),
        });

        if (response.ok) {
          resolve();
        } else {
          reject(new Error("Failed to submit report"));
        }
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(promise, {
      loading: "Submitting report...",
      success: () => {
        onClose();
        return "Thank you for your report!";
      },
      error: "Failed to submit report. Please try again."
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Report an Issue</AlertDialogTitle>
          <AlertDialogDescription>
            Help us improve Ascendara by reporting any issues you encounter.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason" className="col-span-4">
              What are you reporting?
            </Label>
            <Input
              id="reason"
              className="col-span-4"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Brief description of the issue"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="details" className="col-span-4">
              Detailed Description
            </Label>
            <Textarea
              id="details"
              className="col-span-4"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide as much detail as possible"
              rows={4}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReportIssue;
