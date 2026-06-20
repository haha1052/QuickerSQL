import React from 'react';
import './Welcome.css';

interface WelcomeProps {
  onGetStarted: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onGetStarted }) => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="welcome-logo">
          <span className="logo-emoji">🦆</span>
          <h1 className="app-name">QuickerSQL</h1>
          <p className="app-tagline">轻量本地高性能数据分析工具</p>
        </div>

        <div className="welcome-actions">
          <button className="btn-primary" onClick={onGetStarted}>
            开始使用
          </button>

          <div className="secondary-buttons">
            <button className="btn-secondary">
              📚 观看教程
            </button>
            <button className="btn-secondary">
              ⚙️ 打开设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
