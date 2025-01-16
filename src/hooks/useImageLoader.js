import { useState, useEffect } from 'react';
import imageCacheService from '../services/imageCacheService';

// Track which images are currently being loaded to prevent duplicate requests
const loadingImages = new Map();

// Shared image loading hook to prevent duplicate loading
export function useImageLoader(imgID, shouldLoad = true) {
  const [state, setState] = useState({
    cachedImage: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      if (!imgID || !shouldLoad) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: null
          });
        }
        return;
      }

      // Check if this image is already being loaded
      if (loadingImages.has(imgID)) {
        const existingPromise = loadingImages.get(imgID);
        try {
          const cached = await existingPromise;
          if (mounted) {
            setState({
              cachedImage: cached,
              loading: false,
              error: cached ? null : 'Failed to load image'
            });
          }
        } catch (error) {
          if (mounted) {
            setState({
              cachedImage: null,
              loading: false,
              error: error.message || 'Failed to load image'
            });
          }
        }
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Create and store the loading promise
        const loadPromise = imageCacheService.getImage(imgID);
        loadingImages.set(imgID, loadPromise);
        
        const cached = await loadPromise;
        
        if (mounted) {
          setState({
            cachedImage: cached,
            loading: false,
            error: cached ? null : 'Failed to load image'
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: error.message || 'Failed to load image'
          });
        }
      } finally {
        loadingImages.delete(imgID);
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [imgID, shouldLoad]);

  return state;
}
