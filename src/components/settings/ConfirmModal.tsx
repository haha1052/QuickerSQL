import React from 'react';
import { useLocale } from '../../context/LocaleContext';

interface ConfirmModalProps {
  confirmType: 'resetFirstLaunch' | 'restartApp' | null;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmModalComponent: React.FC<ConfirmModalProps> = ({
  confirmType,
  onClose,
  onConfirm,
}) => {
  const { t } = useLocale();

  if (!confirmType) return null;

  return (
    <div className="settings-confirm-overlay" onClick={onClose}>
      <div className="settings-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-confirm-header">
          <h3 className="settings-confirm-title">
            {confirmType === 'restartApp'
              ? t('settings.restartApp')
              : t('settings.resetFirstLaunch')}
          </h3>
          <button
            className="settings-confirm-close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="settings-confirm-body">
          <p>
            {confirmType === 'restartApp'
              ? t('settings.restartAppConfirm')
              : t('settings.resetFirstLaunchConfirm')}
          </p>
        </div>
        <div className="settings-confirm-footer">
          <button
            className="settings-confirm-cancel-btn"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            className="settings-confirm-confirm-btn"
            onClick={onConfirm}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal = React.memo(ConfirmModalComponent);
ConfirmModal.displayName = 'ConfirmModal';
