import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Home, 
  Search, 
  Library, 
  Settings,
  Download,
  Clock,
  Gamepad2,
  ChevronRight
} from 'lucide-react';

const Navigation = memo(({ items }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [size, setSize] = useState(() => {
    const savedSize = localStorage.getItem('navSize');
    return savedSize ? parseFloat(savedSize) : 100;
  });

  const handleMouseDown = useCallback((e, isLeft) => {
    const startX = e.clientX;
    const startSize = size;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const adjustedDelta = isLeft ? -deltaX : deltaX;
      const newSize = Math.min(100, Math.max(50, startSize + (adjustedDelta / 5)));
      setSize(newSize);
      localStorage.setItem('navSize', newSize.toString());
      
      window.dispatchEvent(new CustomEvent('navResize'));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size]);

  const handleMouseEnter = useCallback((item) => {
    setHoveredItem(item.path);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const navStyle = useMemo(() => ({
    transform: `scale(${size / 100})`,
    transformOrigin: 'bottom center'
  }), [size]);

  const isActive = useCallback((path) => {
    return location.pathname === path;
  }, [location.pathname]);

  const navItems = useMemo(() => [
    { path: '/', label: t('common.home'), icon: Home, color: 'from-blue-500 to-cyan-400' },
    { path: '/search', label: t('common.search'), icon: Search, color: 'from-purple-500 to-pink-400' },
    { path: '/library', label: t('common.library'), icon: Library, color: 'from-green-500 to-emerald-400' },
    { path: '/downloads', label: t('common.downloads'), icon: Download, color: 'from-orange-500 to-amber-400' },
    { path: '/settings', label: t('common.settings'), icon: Settings, color: 'from-slate-500 to-gray-400' }
  ], [t]);

  useEffect(() => {
    const handleResize = () => {
      const newSize = localStorage.getItem('navSize');
      if (newSize) {
        setSize(parseFloat(newSize));
      }
    };

    window.addEventListener('navResize', handleResize);
    return () => window.removeEventListener('navResize', handleResize);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 p-6 z-40 pointer-events-none select-none">
      <div className="max-w-xl mx-auto nav-container relative" 
           style={navStyle}>
        <div className="bg-background/80 backdrop-blur-lg rounded-2xl border border-border shadow-lg p-3 flex items-center justify-center gap-2 pointer-events-auto relative">
          <div className="absolute -top-2 -left-2 w-4 h-4 cursor-nw-resize pointer-events-auto"
               onMouseDown={(e) => handleMouseDown(e, true)} />
          <div className="absolute -top-2 -right-2 w-4 h-4 cursor-ne-resize pointer-events-auto"
               onMouseDown={(e) => handleMouseDown(e, false)} />
          
          {navItems.map((item, index) => (
            <React.Fragment key={item.path}>
              <Link
                to={item.path}
                onMouseEnter={() => handleMouseEnter(item)}
                onMouseLeave={handleMouseLeave}
                className={`relative group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300
                  ${isActive(item.path) 
                    ? 'bg-primary text-background scale-110 z-10' 
                    : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  }
                  ${hoveredItem === item.path ? 'scale-110 z-10' : 'scale-100 z-0'}
                `}
              >
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${item.color} opacity-0 
                  ${isActive(item.path) || hoveredItem === item.path ? 'opacity-100' : ''}
                  transition-opacity duration-300`} 
                />
                <item.icon className="w-5 h-5 relative z-10" />
                <div className={`absolute -top-10 bg-background/95 border border-border rounded-lg px-3 py-1.5 
                  text-sm font-medium whitespace-nowrap transform transition-all duration-300 text-foreground
                  ${hoveredItem === item.path 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}>
                  {item.label}
                  <ChevronRight className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 rotate-90 w-4 h-4 text-border" />
                </div>
              </Link>
              {index === 3 && (
                <div className="w-px h-8 bg-border/50" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;