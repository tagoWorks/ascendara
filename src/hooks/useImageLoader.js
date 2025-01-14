import { useState, useEffect } from 'react';
import imageCacheService from '../services/imageCacheService';

// Shared image loading hook to prevent duplicate loading
export function useImageLoader(imgID) {
  const [state, setState] = useState({
    cachedImage: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      if (!imgID) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: null
          });
        }
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const cached = await imageCacheService.getImage(imgID);
        
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
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [imgID]);

  return state;
}
