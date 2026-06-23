import React from 'react';
import type { TabType } from '../../types';
import { useAppContext } from '../../AppWrapper';
import { SettingsIcon } from './Icons';
import { useLocale } from '../../context/LocaleContext';
import { windowService } from '../../services/tauri';

interface HeaderProps {
  currentProject: string;
  activeTab: TabType;
  onProjectClick: () => void;
  onTabChange: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  activeTab,
  onProjectClick,
  onTabChange,
}) => {
  const { goToSettings } = useAppContext();
  const { t } = useLocale();

  const handleGoToSettings = () => {
    goToSettings();
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    windowService.minimize();
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    windowService.toggleMaximize();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    windowService.close();
  };

  return (
    <div className="header-container">
      <div className="header-left">
        <span className="header-logo">🦆</span>
        
        <button className="header-project-button" onClick={onProjectClick}>
          <svg className="header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span className="header-project-label">{t('header.project')}</span>
          <span className="header-project-name">
            {currentProject || '未选择'}
          </span>
        </button>

        <div className="header-divider" />

        <button
          className={activeTab === 'csv' ? 'header-tab header-tab-active' : 'header-tab'}
          onClick={() => onTabChange('csv')}
        >
          {t('header.csvImport')}
        </button>

        <button
          className={activeTab === 'sql' ? 'header-tab header-tab-active' : 'header-tab'}
          onClick={() => onTabChange('sql')}
        >
          {t('header.sqlQuery')}
        </button>

        <button
          className={activeTab === 'dashboard' ? 'header-tab header-tab-active' : 'header-tab'}
          onClick={() => onTabChange('dashboard')}
        >
          {t('header.dashboard')}
        </button>

        <button
          className={activeTab === 'automation' ? 'header-tab header-tab-active' : 'header-tab'}
          onClick={() => onTabChange('automation')}
        >
          自动化任务
        </button>
      </div>

      <div className="header-drag-spacer" />

      <div className="header-right">
        <button className="header-settings-button" onClick={handleGoToSettings} title={t('header.settings')}>
          <SettingsIcon size={18} />
        </button>

        <div className="header-window-controls">
          <button
            className="header-window-btn header-window-minimize"
            onClick={handleMinimize}
            type="button"
          >
            <span className="header-window-icon">─</span>
          </button>
          <button
            className="header-window-btn header-window-maximize"
            onClick={handleMaximize}
            type="button"
          >
            <span className="header-window-icon">□</span>
          </button>
          <button
            className="header-window-btn header-window-close"
            onClick={handleClose}
            type="button"
          >
            <span className="header-window-icon">×</span>
          </button>
        </div>
      </div>
    </div>
  );
};