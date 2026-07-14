import React, { useEffect } from 'react';
import { useSetting } from './SettingsContext';
import { tauriService } from '../services/tauri';

const MIN_CAPACITY = 20;
const MAX_CAPACITY = 500;
const MIN_TTL_SECONDS = 30;

export const CacheSettingsSync: React.FC = () => {
  const [enableCache] = useSetting('cache', 'enableCache');
  const [cacheSize] = useSetting('cache', 'cacheSize');
  const [cacheExpiry] = useSetting('cache', 'cacheExpiry');
  const [cacheStrategy] = useSetting('cache', 'cacheStrategy');

  useEffect(() => {
    const enabled = enableCache === 'true';
    const sizeEntries = parseFloat(cacheSize ?? '100');
    const expiryMinutes = parseFloat(cacheExpiry ?? '30');
    const strategy = cacheStrategy ?? 'lru';

    const capacity = Math.min(
      MAX_CAPACITY,
      Math.max(MIN_CAPACITY, Math.round(sizeEntries))
    );
    const ttlSeconds = Math.max(MIN_TTL_SECONDS, Math.round(expiryMinutes * 60));

    const sync = async () => {
      try {
        await tauriService.configureQueryCache({
          capacity,
          ttlSeconds,
          enabled,
          strategy,
        });
      } catch (error) {
        console.error('Failed to sync cache settings:', error);
      }
    };

    void sync();
  }, [enableCache, cacheSize, cacheExpiry, cacheStrategy]);

  return null;
};
