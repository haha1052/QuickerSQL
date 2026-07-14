import React from 'react';
import './Welcome.css';
import { useLocale } from '../context/LocaleContext';

interface WelcomeProps {
  onGetStarted: () => void;
  onGoToGuide: () => void;
  onGoToSettings: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onGetStarted, onGoToGuide, onGoToSettings }) => {
  const { t } = useLocale();
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="welcome-hero">
          <div className="welcome-logo">
            <span className="logo-emoji">🦆</span>
          </div>
          <div className="welcome-text">
            <h1 className="app-name">QuickerSQL</h1>
            <p className="app-tagline">{t('welcome.tagline')}</p>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="btn-primary" onClick={onGetStarted}>
            {t('welcome.getStarted')}
          </button>

          <div className="secondary-buttons">
            <button className="btn-secondary" onClick={onGoToGuide}>
              {t('welcome.watchTutorial')}
            </button>
            <button className="btn-secondary" onClick={onGoToSettings}>
              {t('welcome.openSettings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
