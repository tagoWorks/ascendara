import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
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
  const { t } = useLanguage();

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error("Error fetching token:", error);
        toast.error(t('common.reportDialog.authFailed'), {
          description: t('common.reportDialog.authFailedDesc')
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
      toast.error(t('common.reportDialog.missingInfo'), {
        description: t('common.reportDialog.missingInfoDesc')
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
      loading: t('common.reportDialog.submitting'),
      success: () => {
        onClose();
        return t('common.reportDialog.success');
      },
      error: t('common.reportDialog.error'),
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.reportDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('common.reportDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">{t('common.reportDialog.reasonLabel')}</Label>
            <Input
              id="reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('common.reportDialog.reasonPlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="details">{t('common.reportDialog.detailsLabel')}</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t('common.reportDialog.detailsPlaceholder')}
              rows={4}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.reportDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.reportDialog.submitting')}
              </>
            ) : (
              t('common.reportDialog.submit')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReportIssue;
