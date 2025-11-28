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
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: 20000,
        maxWidth: '90vw',
        background: colors.background,
        color: colors.text,
        padding: '12px 16px',
        borderRadius: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        fontSize: '13px',
        lineHeight: 1.5,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}


