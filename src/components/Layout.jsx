import React, { useState, useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import Navigation from "./Navigation";
import MenuBar from "./MenuBar";
import Tour from "./Tour";
import { useTheme } from "@/context/ThemeContext";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MenuBar className="fixed left-0 right-0 top-0 z-50" />
      <div className="h-16" />
      <main className="flex-1 overflow-y-auto px-4 pb-24">
        <Outlet />
        {showTour && <Tour onClose={handleCloseTour} />}
      </main>
      <Navigation className="fixed bottom-0 left-0 right-0" />
    </div>
  );
}

export default Layout;
