import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@poopfinder_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY)
      .then((raw) => {
        if (raw) setFavorites(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggleFavorite = useCallback((bathroomId) => {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[bathroomId]) {
        delete next[bathroomId];
      } else {
        next[bathroomId] = true;
      }
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isFavorite = useCallback((bathroomId) => !!favorites[bathroomId], [favorites]);

  return { favorites, isFavorite, toggleFavorite, loaded };
}
