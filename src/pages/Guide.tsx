import React, { useState } from 'react';
import './Guide.css';

interface GuideProps {
  onComplete: () => void;
  onSkip: () => void;
}

type GuideStep = 'workspace' | 'import' | 'query' | 'done';

const Guide: React.FC<GuideProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState<GuideStep>('workspace');

  const nextStep = () => {
    if (step === 'workspace') setStep('import');
    else if (step === 'import') setStep('query');
    else if (step === 'query') setStep('done');
  };

  const prevStep = () => {
    if (step === 'import') setStep('workspace');
    else if (step === 'query') setStep('import');
    else if (step === 'done') setStep('query');
  };

  return (
    <div className="guide-container">
      <div className="guide-content">
        <div className="guide-header">
          <button className="skip-btn" onClick={onSkip}>
            跳过引导
          </button>
          <div className="progress-dots">
            <span className={`dot ${step === 'workspace' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'import' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'query' ? 'active' : ''}`}></span>
            <span className={`dot ${step === 'done' ? 'active' : ''}`}></span>
          </div>
        </div>

        <div className="guide-body">
          {step === 'workspace' && (
            <div className="step">
              <div className="step-icon">📁</div>
              <h2>选择工作区</h2>
              <p>
                选择一个文件夹作为 QuickerSQL 的工作区，
                所有数据和项目都将保存在这里。
              </p>
              <div className="guide-card">
                <div className="card-icon">📂</div>
                <div className="card-content">
                  <h3>工作区是什么？</h3>
                  <p>工作区是您存放数据库文件和项目配置的地方。每次启动应用时，系统会自动加载最近使用的工作区。</p>
                </div>
              </div>
            </div>
          )}

          {step === 'import' && (
            <div className="step">
              <div className="step-icon">📊</div>
              <h2>导入您的数据</h2>
              <p>
                导入 CSV、Excel、JSON 或 Parquet 文件，
                或者使用我们提供的示例数据开始体验。
              </p>
              <div className="guide-card">
                <div className="card-icon">📥</div>
                <div className="card-content">
                  <h3>支持的文件格式</h3>
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
              <h2>编写 SQL 查询</h2>
              <p>
                使用强大的 SQL 编辑器查询和分析您的数据。
                支持语法高亮、自动补全和实时执行。
              </p>
              <div className="guide-card">
                <div className="card-icon">💡</div>
                <div className="card-content">
                  <h3>快捷操作</h3>
                  <ul>
                    <li>▶️ F5 执行查询</li>
                    <li>💾 Ctrl+S 保存查询</li>
                    <li>📋 双击数据表自动生成 SQL</li>
                    <li>📈 查询结果可直接生成图表</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="step">
              <div className="step-icon">🎉</div>
              <h2>准备好了！</h2>
              <p>
                QuickerSQL 已准备就绪，您现在可以开始使用了。
                开始您的数据分析之旅吧！
              </p>
              <div className="quick-tips">
                <p>接下来可以：</p>
                <ul>
                  <li>在左侧查看您的数据表</li>
                  <li>在右侧编写 SQL 查询</li>
                  <li>点击执行查看结果</li>
                  <li>切换到图表标签页创建可视化</li>
                  <li>在仪表盘组合多个图表</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="guide-footer">
          {step !== 'workspace' && (
            <button className="btn btn-back" onClick={prevStep}>
              ← 上一步
            </button>
          )}
          <div style={{ flex: 1 }}></div>
          {step !== 'done' && (
            <button className="btn btn-next" onClick={nextStep}>
              下一步 →
            </button>
          )}
          {step === 'done' && (
            <button className="btn btn-complete" onClick={onComplete}>
              🦆 开始使用 QuickerSQL
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Guide;