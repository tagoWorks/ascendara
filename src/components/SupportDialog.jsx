import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageCircle, DollarSign, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const SupportDialog = ({ onClose }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [authToken, setAuthToken] = useState("")


  useEffect(() => {
    const fetchToken = async () => {
      try {
        const AUTHORIZATION = await window.electron.getAPIKey();
        const response = await fetch('https://api.ascendara.app/auth/token', {
          headers: {
            'Authorization': AUTHORIZATION
          }
        });
        const data = await response.json();
        if (data.token) {
          setAuthToken(data.token);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
        toast.error(t('common.authFailed'), {
          description: t('common.authFailedDesc')
        });
      }
    };

    fetchToken();
  }, []);

  const handleStarClick = (value) => {
    setRating(value);
  };

  const handleClose = () => {
    if (rating > 0) {
      if (!authToken) {
        console.error("No auth token available");
        toast.error(t('common.authFailed'), {
          description: t('common.authFailedDesc')
        });
        onClose();
        return;
      }

      // Send the rating to the API
      fetch('https://api.ascendara.app/app/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          action: 'rating',
          rating: rating
        })
      }).catch(error => {
        console.error("Error sending rating:", error);
        toast.error(t('common.ratingFailed'), {
          description: t('common.ratingFailedDesc')
        });
      });
    }
    onClose();
  };

  const handleDonate = () => {
    window.electron.openURL('https://ascendara.app/donate');
  };

  const handleFeedback = () => {
    window.electron.openURL('https://ascendara.app/feedback');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 relative"
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>

          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">{t('app.supportDialog.title')}</h2>
              <p className="text-muted-foreground">
                {t('app.supportDialog.message')}
              </p>
            </div>

            <div className="flex justify-center -space-x-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onMouseEnter={() => setHoveredStar(value)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => handleStarClick(value)}
                  className="transition-transform hover:scale-110 px-1"
                >
                  <Star
                    size={32}
                    className={`${
                      value <= (hoveredStar || rating)
                        ? 'fill-yellow-400 stroke-yellow-400'
                        : 'stroke-muted-foreground'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleDonate}
                className="flex items-center justify-center gap-2 bg-primary/80 text-secondary-foreground rounded-lg px-4 py-3 hover:bg-primary/90 transition-colors"
              >
                <DollarSign size={20} />
                {t('app.supportDialog.donate')}
              </button>
              <button
                onClick={handleFeedback}
                className="flex items-center justify-center gap-2 bg-secondary text-primary rounded-lg px-4 py-3 hover:bg-secondary/90 transition-colors"
              >
                <MessageCircle size={20} />
                {t('app.supportDialog.feedback')}
              </button>
            </div>

            <div className="text-center text-sm text-muted-foreground bg-primary/40 rounded-lg p-4 space-y-3 pt-2">
              <p className="italic px-8">
                {t('app.supportDialog.note')}
              </p>
              <div className="flex justify-center">
                <img 
                  src="https://cdn.ascendara.app/files/signature.svg"
                  className="w-28"
                  alt="Santiago Signature"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SupportDialog;
