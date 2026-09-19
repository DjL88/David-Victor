import { useState, useEffect, useCallback } from 'react';

const FAVOURITES_STORAGE_KEY = 'dl_guest_favourites';
const FAVOURITES_EVENT = 'dl_favourites_updated';

// Pre-seeded popular PLUs for demo experience
const INITIAL_DEMO_FAVOURITES = ['PLU-ESX-001', 'PLU-ESX-004', 'PLU-ESX-007'];

export function useFavourites() {
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVOURITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore JSON parse errors
    }
    return INITIAL_DEMO_FAVOURITES;
  });

  // Sync across all components and windows via custom events
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFavourites(customEvent.detail);
      } else {
        try {
          const saved = localStorage.getItem(FAVOURITES_STORAGE_KEY);
          if (saved) setFavourites(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener(FAVOURITES_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(FAVOURITES_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const saveFavourites = useCallback((nextFavs: string[]) => {
    setFavourites(nextFavs);
    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(nextFavs));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(FAVOURITES_EVENT, { detail: nextFavs }));
  }, []);

  const isFavourite = useCallback(
    (plu: string) => {
      return favourites.includes(plu);
    },
    [favourites]
  );

  const toggleFavourite = useCallback(
    (plu: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      setFavourites((prev) => {
        const next = prev.includes(plu) ? prev.filter((id) => id !== plu) : [...prev, plu];
        try {
          localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent(FAVOURITES_EVENT, { detail: next }));
        return next;
      });
    },
    []
  );

  return {
    favourites,
    isFavourite,
    toggleFavourite,
    saveFavourites,
  };
}

const PAST_PURCHASES_STORAGE_KEY = 'dl_guest_past_purchases';
const INITIAL_DEMO_PURCHASES = [
  'PLU-ESX-001',
  'PLU-ESX-002',
  'PLU-ESX-004',
  'PLU-SOURDOUGH-01',
  'PLU-ORGANIC-MILK-2L',
  'PLU-COLDPRESS-ORANGE',
];

export function usePastPurchases() {
  const [pastPurchases, setPastPurchases] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(PAST_PURCHASES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_DEMO_PURCHASES;
  });

  const isPastPurchase = useCallback(
    (plu: string) => pastPurchases.includes(plu),
    [pastPurchases]
  );

  const recordPurchase = useCallback((plus: string[]) => {
    setPastPurchases((prev) => {
      const updated = Array.from(new Set([...prev, ...plus]));
      try {
        localStorage.setItem(PAST_PURCHASES_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return {
    pastPurchases,
    isPastPurchase,
    recordPurchase,
  };
}
