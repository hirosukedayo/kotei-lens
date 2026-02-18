import React, { useState, useCallback } from 'react';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any; // 型の都合でネストコンポーネントを any 扱い
import type { PinData } from '../../types/pins';
import { okutamaPins } from '../../data/okutama-pins';
import { pinTypeStyles } from '../../types/pins';
import { FaMapMarkerAlt, FaExternalLinkAlt, FaChevronRight, FaChevronLeft } from 'react-icons/fa';

interface PinListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPin: PinData | null;
  onSelectPin: (pin: PinData) => void;
  onDeselectPin: () => void;
  onSheetModeChange?: (mode: 'pin-list' | 'pin-detail') => void;
}

export default function PinListDrawer({
  open,
  onOpenChange,
  selectedPin,
  onSelectPin,
  onDeselectPin,
  onSheetModeChange,
}: PinListDrawerProps) {
  const [sheetMode, _setSheetMode] = useState<'pin-list' | 'pin-detail'>('pin-list');
  const setSheetMode = useCallback((mode: 'pin-list' | 'pin-detail') => {
    _setSheetMode(mode);
    onSheetModeChange?.(mode);
  }, [onSheetModeChange]);

  // 選択されたピンが変更されたら詳細モードに切り替える
  React.useEffect(() => {
    if (selectedPin) {
      setSheetMode('pin-detail');
    }
  }, [selectedPin, setSheetMode]);

  // Vaulの仕様でbodyにpointer-events: noneが付与されるのを防ぐ
  React.useEffect(() => {
    if (open) {
      // ライブラリによるstyle適用を上書きするため、わずかに遅延させる
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = 'auto';
      }, 50);
      return () => clearTimeout(timer);
    }
    document.body.style.pointerEvents = '';
  }, [open]);

  const handleTogglePinSelection = (pin: PinData, e: React.MouseEvent) => {
    // 右矢印部分をクリックした場合は詳細表示
    const target = e.target as HTMLElement;
    if (target.closest('.pin-detail-button')) {
      onSelectPin(pin);
      setSheetMode('pin-detail');
      return;
    }

    // それ以外の場合は選択/選択解除
    if (selectedPin?.id === pin.id) {
      onDeselectPin();
    } else {
      onSelectPin(pin);
    }
  };

  const backToList = () => {
    setSheetMode('pin-list');
    // 選択状態は保持する（onDeselectPinを呼ばない）
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen && !selectedPin) {
      // ピン未選択状態でドロワーが閉じた場合のみリストに戻す
      setSheetMode('pin-list');
    }
  };

  return (
    <VDrawer.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <VDrawer.Content
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 11000,
          // 背景は透明にして、実際のコンテンツ部分のみがクリックをブロックするようにする
          background: 'transparent',
          maxHeight: '50vh',
          display: 'flex',
          flexDirection: 'column',
          // pointerEvents: 'none' を削除してドラッグ操作を有効化
        }}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <VDrawer.Title style={{ display: 'none' }}>ピン詳細・一覧</VDrawer.Title>
        <VDrawer.Description style={{ display: 'none' }}>
          地図上のピンの詳細情報や一覧を表示します。
        </VDrawer.Description>

        <div
          style={{
            background: '#ffffff',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: '0 -4px 20px rgba(0,0,0,.12)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* ドラッグハンドル領域 */}
          <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
            <div data-vaul-handle />
          </div>

          {/* 固定ヘッダー（スワイプダウンでドロワーを閉じられる） */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: '#ffffff',
              borderBottom: '1px solid #f3f4f6',
              padding: '0 16px 14px 16px',
              zIndex: 1,
            }}
          >
            {sheetMode === 'pin-detail' && selectedPin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="drawer-back-btn"
                  onClick={backToList}
                  aria-label="一覧に戻る"
                >
                  <FaChevronLeft size={14} />
                </button>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#111827',
                    lineHeight: 1.35,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                  }}
                >
                  {selectedPin.title}
                </h3>
              </div>
            ) : (
              <div style={{ textAlign: 'left' }}>
                <h2
                  style={{
                    margin: '0 0 2px 0',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#111827',
                    letterSpacing: '-0.01em',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  情報地点一覧
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>
                    ({okutamaPins.length}件)
                  </span>
                </h2>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                  かつての小河内村の情報地点を探索
                </div>
              </div>
            )}
          </div>
          {/* スクロール可能なコンテンツ：ドラッグ不可 */}
          <div
            style={{
              padding: '16px',
              flex: 1, // 残りの高さを埋める
              overflowY: 'auto',
            }}
            data-vaul-no-drag
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
                    textAlign: 'left',
                  }}
                >
                  {selectedPin.description}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, fontWeight: 500 }}>
                  {selectedPin.coordinates[0].toFixed(6)}, {selectedPin.coordinates[1].toFixed(6)}
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
                    >
                      <span>関連リンク</span>
                      <FaExternalLinkAlt size={12} style={{ marginLeft: 'auto' }} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div>
                  {okutamaPins.map((pin, index) => {
                    const style = pinTypeStyles[pin.type];
                    const isSelected = selectedPin?.id === pin.id;
                    const isLast = index === okutamaPins.length - 1;
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={(e) => handleTogglePinSelection(pin, e)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 4px',
                          background: isSelected ? '#f8f7ff' : 'transparent',
                          border: 'none',
                          borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderRadius: isSelected ? 8 : 0,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* タイプカラードット */}
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            minWidth: 8,
                            borderRadius: 9999,
                            background: style.color,
                            opacity: isSelected ? 1 : 0.5,
                            transition: 'opacity 0.15s ease',
                          }}
                        />
                        {/* アイコン */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            minWidth: 36,
                            borderRadius: 10,
                            background: isSelected ? '#f0ecff' : '#f9fafb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <i
                            className={`ph-fill ph-${style.icon}`}
                            style={{
                              fontSize: 17,
                              color: isSelected ? style.color : '#9ca3af',
                              transition: 'color 0.15s ease',
                            }}
                          />
                        </div>
                        {/* テキスト */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: '#111827',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.4,
                            }}
                          >
                            {pin.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginTop: 1 }}>
                            {style.label}
                          </div>
                        </div>
                        {/* 矢印 */}
                        <div
                          className="pin-detail-button"
                          style={{
                            color: isSelected ? style.color : '#d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease',
                            padding: '0 2px',
                          }}
                        >
                          <FaChevronRight size={11} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </VDrawer.Content>
    </VDrawer.Root>
  );
}
