import React, { useState } from 'react';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any; // 型の都合でネストコンポーネントを any 扱い
import type { PinData } from '../../types/pins';
import { okutamaPins } from '../../data/okutama-pins';
import { pinTypeStyles } from '../../types/pins';
import { FaMapMarkerAlt, FaExternalLinkAlt } from 'react-icons/fa';

interface PinListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPin: PinData | null;
  onSelectPin: (pin: PinData) => void;
  onDeselectPin: () => void;
}

export default function PinListDrawer({
  open,
  onOpenChange,
  selectedPin,
  onSelectPin,
  onDeselectPin,
}: PinListDrawerProps) {
  const [sheetMode, setSheetMode] = useState<'pin-list' | 'pin-detail'>('pin-list');

  const handleSelectPinFromList = (pin: PinData) => {
    onSelectPin(pin);
    setSheetMode('pin-detail');
  };

  const backToList = () => {
    setSheetMode('pin-list');
    onDeselectPin();
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      onDeselectPin();
      setSheetMode('pin-list');
    }
  };

  return (
    <VDrawer.Root open={open} onOpenChange={handleOpenChange}>
      <VDrawer.Portal>
        <VDrawer.Overlay style={{ background: 'rgba(0,0,0,.15)' }} />
        <VDrawer.Content
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 11000,
            background: '#ffffff',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            boxShadow: '0 -8px 24px rgba(0,0,0,.2)',
          }}
          onOpenAutoFocus={(e: Event) => e.preventDefault()}
          onCloseAutoFocus={(e: Event) => e.preventDefault()}
        >
          <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#e5e7eb' }} />
          </div>
          {/* 固定ヘッダー */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 16px 16px 16px',
              zIndex: 1,
            }}
          >
            {sheetMode === 'pin-detail' && selectedPin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={backToList}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '18px',
                    fontWeight: '400',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.color = '#4b5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  ←
                </button>
                <div style={{ fontSize: '24px' }}>{pinTypeStyles[selectedPin.type].icon}</div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#111827',
                      lineHeight: '1.35',
                    }}
                  >
                    {selectedPin.title}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                    {pinTypeStyles[selectedPin.type].label}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#111827',
                  }}
                >
                  情報地点一覧
                </h2>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  かつての小河内村の情報地点を探索
                </div>
              </div>
            )}
          </div>
          {/* スクロール可能なコンテンツ */}
          <div
            style={{
              padding: '16px',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
            }}
          >
            {sheetMode === 'pin-detail' && selectedPin ? (
              <div>
                {selectedPin.image && (
                  <div
                    style={{
                      width: '100%',
                      height: '200px',
                      borderRadius: 8,
                      overflow: 'hidden',
                      marginBottom: 16,
                      background: '#f3f4f6',
                    }}
                  >
                    <img
                      src={selectedPin.image}
                      alt={selectedPin.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.7',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    marginBottom: 16,
                  }}
                >
                  {selectedPin.description}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 16 }}>
                  座標: {selectedPin.coordinates[0].toFixed(6)},{' '}
                  {selectedPin.coordinates[1].toFixed(6)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedPin.mapUrl && (
                    <a
                      href={selectedPin.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 16px',
                        background: '#f9fafb',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: '#111827',
                        fontWeight: 500,
                        fontSize: '14px',
                        border: '1px solid #e5e7eb',
                      }}
                      onClick={() => window.open(selectedPin.mapUrl, '_blank')}
                    >
                      <FaMapMarkerAlt size={16} />
                      <span>Googleマップで開く</span>
                      <FaExternalLinkAlt size={12} style={{ marginLeft: 'auto' }} />
                    </a>
                  )}
                  {selectedPin.externalUrl && (
                    <a
                      href={selectedPin.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 16px',
                        background: '#f9fafb',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: '#111827',
                        fontWeight: 500,
                        fontSize: '14px',
                        border: '1px solid #e5e7eb',
                      }}
                      onClick={() => window.open(selectedPin.externalUrl, '_blank')}
                    >
                      <span>関連リンク</span>
                      <FaExternalLinkAlt size={12} style={{ marginLeft: 'auto' }} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    margin: '0 0 8px 0',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{okutamaPins.length} 件</div>
                </div>
                <div>
                  {okutamaPins.map((pin) => {
                    const style = pinTypeStyles[pin.type];
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => handleSelectPinFromList(pin)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 20 }}>{style.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: '#111827',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {pin.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{style.label}</div>
                        </div>
                        <div style={{ color: '#9ca3af' }}>›</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </VDrawer.Content>
      </VDrawer.Portal>
    </VDrawer.Root>
  );
}
