/**
 * DashboardConfirmModal — 仪表盘内通用确认弹窗子组件
 *
 * 职责：
 * - 渲染标题 + 正文 + 取消/确认按钮的确认弹窗（替代原生 confirm）
 * - 支持自定义 confirm 按钮颜色（如删除场景用 error 色）
 * - 纯展示型组件：所有业务动作由父组件通过回调处理
 *
 * 拆分自 DashboardPage.tsx（P2 技术债 Task 3）
 */
import React from 'react';
import { useLocale } from '../../context/LocaleContext';

export interface DashboardConfirmModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 标题文案 key 已翻译的字符串 */
  title: string;
  /** 正文内容（已翻译，可含变量） */
  message: React.ReactNode;
  /** 确认按钮文案，默认取 common.confirm */
  confirmLabel?: string;
  /** 取消按钮文案，默认取 common.cancel */
  cancelLabel?: string;
  /** 确认按钮变体：'primary'（默认）| 'danger'（红色，用于删除等场景） */
  variant?: 'primary' | 'danger';
  /** 点击确认 */
  onConfirm: () => void;
  /** 点击取消 / 关闭 / 遮罩点击 */
  onCancel: () => void;
}

export const DashboardConfirmModal: React.FC<DashboardConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  const { t } = useLocale();

  if (!open) return null;

  const confirmBtnStyle: React.CSSProperties =
    variant === 'danger'
      ? {
          ...styles.confirmBtn,
          background: 'var(--error)',
          borderColor: 'var(--error)',
        }
      : styles.confirmBtn;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.closeBtn} onClick={onCancel}>×</button>
        </div>
        <div style={styles.body}>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {message}
          </p>
        </div>
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button style={confirmBtnStyle} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

// 弹窗样式（与项目其他模态风格一致；原 confirmModalStyles）
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 8,
    width: '420px',
    maxWidth: '90vw',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: { padding: '20px' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
  },
  confirmBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--primary)',
    background: 'var(--primary)',
    color: 'white',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};
