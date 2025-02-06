import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const getSteps = (t) => [
  {
    title: t('tour.title'),
    content: t('tour.welcome'),
    spotlight: null
  },
  {
    title: t('tour.serverStatus.title'),
    content: t('tour.serverStatus.content'),
    spotlight: "div[title='Server Status']",
    position: "bottom"
  },
  {
    title: t('tour.navigationBar.title'),
    content: t('tour.navigationBar.content'),
    spotlight: ".nav-container",
    position: "bottom"
  },
  {
    title: t('tour.resizing.title'),
    content: t('tour.resizing.content'),
    spotlight: ".nav-container",
    position: "bottom",
    showResizeHint: true
  },
  {
    title: t('tour.searchDownload.title'),
    content: t('tour.searchDownload.content'),
    spotlight: "a[href='/search']",
    position: "right",
    navigateTo: "/search"
  },
  {
    title: t('tour.gameLibrary.title'),
    content: t('tour.gameLibrary.content'),
    spotlight: "a[href='/library']",
    position: "right",
    navigateTo: "/library"
  },
  {
    title: t('tour.downloads.title'),
    content: t('tour.downloads.content'),
    spotlight: "a[href='/downloads']",
    position: "right",
    navigateTo: "/downloads"
  },
  {
    title: t('tour.settings.title'),
    content: t('tour.settings.content'),
    spotlight: "a[href='/settings']",
    position: "right",
    navigateTo: "/settings"
  },
  {
    title: t('tour.final.title'),
    content: t('tour.final.content'),
    spotlight: null,
    showDonateButton: true
  }
];

function Tour({ onClose }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPosition, setSpotlightPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const resizeIntervalRef = useRef(null);
  const originalSize = useRef(null);
  const [navScale, setNavScale] = useState(parseFloat(localStorage.getItem('navSize') || '100') / 100);
  const spotlightRef = useRef(null);
  const rafRef = useRef(null);
  const navigate = useNavigate();
  const [steps] = useState(() => getSteps(t));

  useEffect(() => {
    const updateSpotlight = () => {
      const step = steps[currentStep];
      if (step.spotlight) {
        const element = document.querySelector(step.spotlight);
        if (element) {
          const rect = element.getBoundingClientRect();
          
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
          }
          
          rafRef.current = requestAnimationFrame(() => {
            setSpotlightPosition({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            });
          });
        }
      }
    };

    updateSpotlight();
    
    const debouncedResize = debounce(updateSpotlight, 16);
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [currentStep]);

  useEffect(() => {
    if (steps[currentStep].showResizeHint) {
      originalSize.current = localStorage.getItem('navSize') || '100';
      let increasing = true;
      
      resizeIntervalRef.current = setInterval(() => {
        const currentSize = parseFloat(localStorage.getItem('navSize') || '100');
        let newSize;
        
        if (increasing) {
          newSize = currentSize + 0.2;
          if (newSize >= 100) increasing = false;
        } else {
          newSize = currentSize - 0.2;
          if (newSize <= 95) increasing = true;
        }
        
        localStorage.setItem('navSize', newSize.toString());
        window.dispatchEvent(new CustomEvent('navResize'));
      }, 25);
    } else {
      if (resizeIntervalRef.current) {
        clearInterval(resizeIntervalRef.current);
        if (originalSize.current) {
          localStorage.setItem('navSize', originalSize.current);
          window.dispatchEvent(new CustomEvent('navResize'));
        }
      }
    }

    return () => {
      if (resizeIntervalRef.current) {
        clearInterval(resizeIntervalRef.current);
        if (originalSize.current) {
          localStorage.setItem('navSize', originalSize.current);
          window.dispatchEvent(new CustomEvent('navResize'));
        }
      }
    };
  }, [currentStep]);

  useEffect(() => {
    const handleNavResize = () => {
      const newScale = parseFloat(localStorage.getItem('navSize') || '100') / 100;
      setNavScale(newScale);
    };

    window.addEventListener('navResize', handleNavResize);
    return () => window.removeEventListener('navResize', handleNavResize);
  }, []);

  useEffect(() => {
    const step = steps[currentStep];
    if (step.navigateTo) {
      const timeoutId = setTimeout(() => {
        navigate(step.navigateTo);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, navigate]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const nextStepHasNavigation = steps[currentStep + 1].navigateTo;
      if (nextStepHasNavigation) {
        setTimeout(() => {
          setCurrentStep(currentStep + 1);
        }, 100);
      } else {
        setCurrentStep(currentStep + 1);
      }
    } else {
      if (originalSize.current) {
        localStorage.setItem('navSize', originalSize.current);
        window.dispatchEvent(new CustomEvent('navResize'));
      }
      onClose();
      setTimeout(() => {
        navigate('/');
      }, 100);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const currentStepHasNavigation = steps[currentStep].navigateTo;
      if (currentStepHasNavigation) {
        setTimeout(() => {
          setCurrentStep(currentStep - 1);
        }, 100);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto z-[201]" />

      {/* Spotlight */}
      <AnimatePresence mode="wait">
        {steps[currentStep].spotlight && (
          <>
            {/* Spotlight overlay */}
            <motion.div
              ref={spotlightRef}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                left: spotlightPosition.x - 20,
                top: spotlightPosition.y - 20,
                width: spotlightPosition.width + 40,
                height: spotlightPosition.height + 40,
              }}
              transition={{ 
                type: "spring", 
                stiffness: 300,
                damping: 30,
                mass: 1,
                duration: 0.3
              }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none will-change-transform z-[202]"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65), inset 0 0 0 9999px rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                background: 'transparent',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            {/* Resize indicators */}
            {steps[currentStep].showResizeHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1,
                  left: spotlightPosition.x,
                  top: spotlightPosition.y,
                  width: spotlightPosition.width,
                  scale: navScale,
                }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  mass: 0.5,
                  duration: 0.2
                }}
                style={{
                  transformOrigin: 'bottom center',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)'
                }}
                className="absolute pointer-events-none will-change-transform z-[203]"
              >
                <div 
                  className="absolute top-0 left-0 w-10 h-10 bg-white rounded-lg"
                  style={{
                    transform: `translate(-${(navScale) * 20}px, -${(navScale) * 20}px)`,
                    transition: 'transform 100ms ease'
                  }}
                />
                <div 
                  className="absolute top-0 right-0 w-10 h-10 bg-white rounded-lg"
                  style={{
                    transform: `translate(${(navScale) * 20}px, -${(navScale) * 20}px)`,
                    transition: 'transform 100ms ease'
                  }}
                />
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-[203]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background border border-border rounded-xl p-6 shadow-lg max-w-md"
        >
          <h2 className="text-xl font-bold mb-2">{steps[currentStep].title}</h2>
          <p 
            className="text-muted-foreground mb-4 pointer-events-auto"
            dangerouslySetInnerHTML={{ __html: steps[currentStep].content }}
          />

          <div className="flex justify-between items-center">
            <button
              onClick={prevStep}
              className={`flex items-center gap-1 ${currentStep === 0 ? 'invisible' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" /> {t('common.prev')}
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-1 text-primary"
            >
              {currentStep === steps.length - 1 ? t('common.finish') : t('common.next')} 
              {currentStep === steps.length - 1 ? (
                <Rocket className="w-4 h-4 ml-2" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default Tour;
