import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareText, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import ReportIssue from "./ReportIssue";
import "./ContextMenu.css";

const ContextMenu = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isReportOpen, setIsReportOpen] = useState(false);
  const menuRef = useRef(null);
  const { t } = useLanguage();

  const handleContextMenu = e => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;

    // Ensure menu stays within viewport
    const menuWidth = 200; // Approximate menu width
    const menuHeight = 200; // Approximate menu height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const adjustedX = Math.min(x, viewportWidth - menuWidth);
    const adjustedY = Math.min(y, viewportHeight - menuHeight);

    setPosition({ x: adjustedX, y: adjustedY });
    setIsVisible(true);
  };

  const handleClickOutside = e => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setIsVisible(false);
    }
  };

  const handleReport = () => {
    setIsReportOpen(true);
    setIsVisible(false);
  };

  const handleFeedback = () => {
    window.electron.openURL("https://ascendara.app/feedback");
    setIsVisible(false);
  };

  useEffect(() => {
    // Only attach listeners if we haven't already
    if (!window.__contextMenuListenersAttached) {
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") setIsVisible(false);
      });
      window.__contextMenuListenersAttached = true;
    }

    return () => {
      // Only remove listeners if we're the last instance
      if (window.__contextMenuListenersAttached) {
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("keydown", e => {
          if (e.key === "Escape") setIsVisible(false);
        });
        window.__contextMenuListenersAttached = false;
      }
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="context-menu"
            style={{
              position: "fixed",
              top: position.y,
              left: position.x,
              zIndex: 1000,
            }}
          >
            <div className="context-menu-content">
              <button onClick={handleReport} className="context-menu-item">
                <TriangleAlert className="mr-2 h-4 w-4" />
                {t("common.reportIssue")}
              </button>
              <button onClick={handleFeedback} className="context-menu-item">
                <MessageSquareText className="mr-2 h-4 w-4" />
                {t("common.giveFeedback")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReportIssue isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </>
  );
};

export default ContextMenu;
