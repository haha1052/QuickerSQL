import React, { useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useSetting } from './SettingsContext';

export const ThemeSettingsSync: React.FC = () => {
  const { setTheme } = useTheme();
  const [themeSetting] = useSetting('appearance', 'theme');

  useEffect(() => {
    if (themeSetting && setTheme) {
      setTheme(themeSetting as 'light' | 'dark' | 'system');
    }
  }, [themeSetting, setTheme]);

  return null;
};
