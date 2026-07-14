import React, { useState } from 'react';
import './Guide.css';
import { useLocale } from '../context/LocaleContext';

interface GuideProps {
  onComplete: () => void;
  onSkip: () => void;
}

type GuideStep = 'project' | 'import' | 'query' | 'done';

const Guide: React.FC<GuideProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState<GuideStep>('project');
  const { t } = useLocale();

  const nextStep = () => {
    if (step === 'project') setStep('import');
    else if (step === 'import') setStep('query');
    else if (step === 'query') setStep('done');
  };

  const prevStep = () => {
    if (step === 'import') setStep('project');
    else if (step === 'query') setStep('import');
    else if (step === 'done') setStep('query');
  };

  return (
    <div className="guide-container">
      <div className="guide-content">
        <div className="guide-header">
          <button className="skip-btn" onClick={onSkip}>
            {t('guide.skip')}
          </button>
          <div className="progress-dots">
            <span className={`dot ${step === 'project' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'import' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'query' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'done' ? 'active' : ''}`}></span>
          </div>
        </div>

        <div className="guide-body">
          {step === 'project' && (
            <div className="step">
              <div className="step-icon">📁</div>
              <h2>{t('guide.project.title')}</h2>
              <p>
                {t('guide.project.desc1')}<br />
                {t('guide.project.desc2')}<br />
                {t('guide.project.desc3')}<br />
                {t('guide.project.desc4')}
              </p>
            </div>
          )}

          {step === 'import' && (
            <div className="step">
              <div className="step-icon import-step-icon">📊</div>
              <h2>{t('guide.import.title')}</h2>
              <div className="guide-card">
                <div className="card-icon">📥</div>
                <div className="card-content">
                  <h3>{t('guide.import.supportedFormats')}</h3>
                  <ul>
                    <li>📄 CSV (.csv)</li>
                    <li>📗 Excel (.xlsx, .xls)</li>
                    <li>📋 JSON (.json)</li>
                    <li>📦 Parquet (.parquet)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 'query' && (
            <div className="step">
              <div className="step-icon">⚡</div>
              <h2>{t('guide.query.title')}</h2>
              <p>
                {t('guide.query.desc1')}<br />
                {t('guide.query.desc2')}
              </p>
              <div className="guide-card">
                <div className="card-icon">💡</div>
                <div className="card-content">
                  <h3>{t('guide.query.shortcuts')}</h3>
                  <ul>
                    <li>{t('guide.query.shortcut1')}</li>
                    <li>{t('guide.query.shortcut2')}</li>
                    <li>{t('guide.query.shortcut3')}</li>
                    <li>{t('guide.query.shortcut4')}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="step">
              <div className="step-icon">🎉</div>
              <h2>{t('guide.done.title')}</h2>
              <p>
                {t('guide.done.desc1')}<br />
                {t('guide.done.desc2')}
              </p>
              <div className="quick-tips">
                <p>{t('guide.done.nextSteps')}</p>
                <ul>
                  <li>{t('guide.done.tip1')}</li>
                  <li>{t('guide.done.tip2')}</li>
                  <li>{t('guide.done.tip3')}</li>
                  <li>{t('guide.done.tip4')}</li>
                  <li>{t('guide.done.tip5')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="guide-footer">
          {step !== 'project' && (
            <button className="btn btn-back" onClick={prevStep}>
              {t('guide.prev')}
            </button>
          )}
          <div style={{ flex: 1 }}></div>
          {step !== 'done' && (
            <button className="btn btn-next" onClick={nextStep}>
              {t('guide.next')}
            </button>
          )}
          {step === 'done' && (
            <button className="btn btn-complete" onClick={onComplete}>
              {t('guide.startUsing')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Guide;