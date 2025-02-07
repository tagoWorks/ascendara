import React, { useState, useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import Navigation from "./Navigation";
import MenuBar from "./MenuBar";
import Tour from "./Tour";
import { useTheme } from "../contexts/ThemeContext";

function Layout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      setShowTour(true);
    }
  }, [searchParams]);

  const handleCloseTour = () => {
    setShowTour(false);
    setSearchParams({});
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <MenuBar className="fixed top-0 left-0 right-0 z-50" />
      <div className="h-16" />
      <main className="flex-1 pb-24 px-4 overflow-y-auto">
        <Outlet />
        {showTour && <Tour onClose={handleCloseTour} />}
      </main>
      <Navigation className="fixed bottom-0 left-0 right-0" />
    </div>
  );
}

export default Layout;
