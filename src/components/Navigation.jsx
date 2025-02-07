import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { Home, Search, Library, Settings, Download, ChevronRight } from "lucide-react";

const Navigation = memo(({ items }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [size, setSize] = useState(() => {
    const savedSize = localStorage.getItem("navSize");
    return savedSize ? parseFloat(savedSize) : 100;
  });

  const handleMouseDown = useCallback(
    (e, isLeft) => {
      const startX = e.clientX;
      const startSize = size;

      const handleMouseMove = moveEvent => {
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const adjustedDelta = isLeft ? -deltaX : deltaX;
        const newSize = Math.min(100, Math.max(50, startSize + adjustedDelta / 5));
        setSize(newSize);
        localStorage.setItem("navSize", newSize.toString());

        window.dispatchEvent(new CustomEvent("navResize"));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [size]
  );

  const handleMouseEnter = useCallback(item => {
    setHoveredItem(item.path);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const navStyle = useMemo(
    () => ({
      transform: `scale(${size / 100})`,
      transformOrigin: "bottom center",
    }),
    [size]
  );

  const isActive = useCallback(
    path => {
      if (path === "/search" && location.pathname === "/download") {
        return true;
      }
      return location.pathname === path;
    },
    [location.pathname]
  );

  const navItems = useMemo(
    () => [
      {
        path: "/",
        label: t("common.home"),
        icon: Home,
        color: "from-blue-500 to-cyan-400",
      },
      {
        path: "/search",
        label: t("common.search"),
        icon: Search,
        color: "from-purple-500 to-pink-400",
      },
      {
        path: "/library",
        label: t("common.library"),
        icon: Library,
        color: "from-green-500 to-emerald-400",
      },
      {
        path: "/downloads",
        label: t("common.downloads"),
        icon: Download,
        color: "from-orange-500 to-amber-400",
      },
      {
        path: "/settings",
        label: t("common.settings"),
        icon: Settings,
        color: "from-slate-500 to-gray-400",
      },
    ],
    [t]
  );

  useEffect(() => {
    const handleResize = () => {
      const newSize = localStorage.getItem("navSize");
      if (newSize) {
        setSize(parseFloat(newSize));
      }
    };
    /**  @param {KeyboardEvent} event */
    const handleCtrlNavigation = event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      console.log("button pressed");
      switch (event.key) {
        case "1": {
          navigate("/");
          break;
        }
        case "2": {
          navigate("/search");
          break;
        }
        case "3": {
          navigate("/library");
          break;
        }
        case "4": {
          navigate("/downloads");
          break;
        }
        case "5": {
          navigate("/settings");
          break;
        }
      }
    };

    window.addEventListener("keydown", handleCtrlNavigation);
    window.addEventListener("navResize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleCtrlNavigation);
      window.removeEventListener("navResize", handleResize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 select-none p-6">
      <div className="nav-container relative mx-auto max-w-xl" style={navStyle}>
        <div className="pointer-events-auto relative flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 p-3 shadow-lg backdrop-blur-lg">
          <div
            className="pointer-events-auto absolute -left-2 -top-2 h-4 w-4 cursor-nw-resize"
            onMouseDown={e => handleMouseDown(e, true)}
          />
          <div
            className="pointer-events-auto absolute -right-2 -top-2 h-4 w-4 cursor-ne-resize"
            onMouseDown={e => handleMouseDown(e, false)}
          />

          {navItems.map((item, index) => (
            <React.Fragment key={item.path}>
              <Link
                to={item.path}
                onMouseEnter={() => handleMouseEnter(item)}
                onMouseLeave={handleMouseLeave}
                className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                  isActive(item.path)
                    ? "z-10 scale-110 bg-primary text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${hoveredItem === item.path ? "z-10 scale-110" : "z-0 scale-100"} `}
              >
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${item.color} opacity-0 ${isActive(item.path) || hoveredItem === item.path ? "opacity-100" : ""} transition-opacity duration-300`}
                />
                <item.icon className="relative z-10 h-5 w-5" />
                <div
                  className={`absolute -top-10 transform whitespace-nowrap rounded-lg border border-border bg-background/95 px-3 py-1.5 text-sm font-medium text-foreground transition-all duration-300 ${
                    hoveredItem === item.path
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-2 opacity-0"
                  }`}
                >
                  {item.label}
                  <ChevronRight className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-90 transform text-border" />
                </div>
              </Link>
              {index === 3 && <div className="h-8 w-px bg-border/50" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

Navigation.displayName = "Navigation";

export default Navigation;
