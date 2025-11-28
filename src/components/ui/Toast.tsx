import React, { useEffect, useState } from 'react';

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
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  useEffect(() => {
    if (!open || !duration) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!visible) return null;

  const colors = variantColors[variant];

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20000,
        maxWidth: '92vw',
        background: 'rgba(15, 23, 42, 0.9)', // ベースはダーク
        color: colors.text,
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: '0 18px 45px rgba(15,23,42,0.45)',
        fontSize: '12px',
        lineHeight: 1.5,
        textAlign: 'center',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '9999px',
          backgroundColor: colors.background,
          boxShadow: '0 0 0 3px rgba(148,163,184,0.3)',
        }}
      />
      <span>{message}</span>
    </div>
  );
}


