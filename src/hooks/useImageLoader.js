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
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true }));
        const cached = await imageCacheService.getImage(imgID);
        
        if (mounted) {
          setState({
            cachedImage: cached,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: error.message
          });
        }
      }
    };

    loadImage();
    return () => { mounted = false; };
  }, [imgID]);

  return state;
}
