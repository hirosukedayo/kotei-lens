import React, { useEffect } from 'react';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  message: string;
  open: boolean;
  onClose?: () => void;
  duration?: number; // ms. undefined/null なら自動クローズなし
  variant?: ToastVariant;
}

const variantColors: Record<ToastVariant, { background: string; text: string }> = {
  info: { background: 'rgba(37, 99, 235, 0.95)', text: '#f9fafb' },
  success: { background: 'rgba(22, 163, 74, 0.95)', text: '#f9fafb' },
  warning: { background: 'rgba(234, 179, 8, 0.95)', text: '#111827' },
  error: { background: 'rgba(220, 38, 38, 0.95)', text: '#f9fafb' },
};

export function Toast({ message, open, onClose, duration = 4000, variant = 'info' }: ToastProps) {
  // openがtrueになった時点でタイマーを開始し、duration経過後にonCloseを呼ぶ
  useEffect(() => {
    if (!open || !duration) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  // openがfalseの場合は表示しない
  if (!open) return null;

  const colors = variantColors[variant];

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20000,
        // 画面上部に横長のバーとして表示
        maxWidth: 'min(640px, 96vw)',
        minWidth: 'min(360px, 96vw)',
        background: colors.background,
        color: colors.text,
        padding: '14px 20px',
        // 矩形 + やや丸み
        borderRadius: 12,
        boxShadow: '0 18px 45px rgba(15,23,42,0.45)',
        fontSize: '14px',
        lineHeight: 1.6,
        textAlign: 'left',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 10,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '9999px',
          backgroundColor: colors.background,
          boxShadow: '0 0 0 4px rgba(15,23,42,0.35)',
        }}
      />
      <span style={{ fontWeight: 500 }}>{message}</span>
    </div>
  );
}
