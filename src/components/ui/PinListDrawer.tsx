import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any; // 型の都合でネストコンポーネントを any 扱い
import type { PinData } from '../../types/pins';
import { okutamaPins } from '../../data/okutama-pins';
import { pinTypeStyles } from '../../types/pins';
import {
  FaMapMarkerAlt,
  FaExternalLinkAlt,
  FaChevronRight,
  FaChevronLeft,
  FaImage,
  FaTimes,
} from 'react-icons/fa';

type ListTab = 'all' | 'folktale' | 'performing-art';

const TAB_ITEMS: { key: ListTab; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'folktale', label: '民話' },
  { key: 'performing-art', label: '伝統芸能' },
];

interface PinListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPin: PinData | null;
  onSelectPin: (pin: PinData) => void;
  onDeselectPin: () => void;
  onSheetModeChange?: (mode: 'pin-list' | 'pin-detail') => void;
}

/** ピンのサブタイトル（民話 or 伝統芸能タイトル）を返す */
function getSubtitle(pin: PinData): string | null {
  if (pin.folktaleTitle) return pin.folktaleTitle;
  if (pin.performingArtTitle) return pin.performingArtTitle;
  return null;
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
  const [activeTab, _setActiveTab] = useState<ListTab>('all');
  const [imageOpen, setImageOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setActiveTab = useCallback((tab: ListTab) => {
    _setActiveTab(tab);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  const setSheetMode = useCallback((mode: 'pin-list' | 'pin-detail') => {
    _setSheetMode(mode);
    onSheetModeChange?.(mode);
  }, [onSheetModeChange]);

  // タブに応じたフィルタリング
  const filteredPins = useMemo(() => {
    if (activeTab === 'folktale') return okutamaPins.filter((p) => p.folktaleTitle);
    if (activeTab === 'performing-art') return okutamaPins.filter((p) => p.performingArtTitle);
    return okutamaPins;
  }, [activeTab]);

  // 選択されたピンが変更されたら詳細モードに切り替え、画像付きなら自動表示
  React.useEffect(() => {
    if (selectedPin) {
      setSheetMode('pin-detail');
      setImageOpen(!!selectedPin.image);
    }
  }, [selectedPin, setSheetMode]);

  // Vaulの仕様でbodyにpointer-events: noneが付与されるのを防ぐ
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = 'auto';
      }, 50);
      return () => clearTimeout(timer);
    }
    document.body.style.pointerEvents = '';
  }, [open]);

  const handleTogglePinSelection = (pin: PinData, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.pin-detail-button')) {
      onSelectPin(pin);
      setSheetMode('pin-detail');
      return;
    }
    if (selectedPin?.id === pin.id) {
      onDeselectPin();
    } else {
      onSelectPin(pin);
    }
  };

  const backToList = () => {
    setSheetMode('pin-list');
    setImageOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setImageOpen(false);
      if (!selectedPin) {
        setSheetMode('pin-list');
      }
    }
  };

  return (
    <>
      {/* 画像オーバーレイ: ドロワーの下層 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10999,
          background: 'rgba(0, 0, 0, 0.75)',
          opacity: imageOpen && selectedPin?.image ? 1 : 0,
          pointerEvents: imageOpen && selectedPin?.image ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      >
        {/* 画像表示エリア: 上部45vhに限定 */}
        <div
          style={{
            height: '45vh',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => setImageOpen(false)}
            aria-label="画像を閉じる"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              minHeight: 0,
              borderRadius: 9999,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1,
              padding: 0,
            }}
          >
            <FaTimes size={14} />
          </button>
          {selectedPin?.image && (
            <img
              src={selectedPin.image}
              alt={selectedPin.title}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(45vh - 32px)',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          )}
        </div>
      </div>

      <VDrawer.Root open={open} onOpenChange={handleOpenChange} modal={false}>
        <VDrawer.Content
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 11000,
            background: 'transparent',
            maxHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
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

            {/* 固定ヘッダー */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#ffffff',
                borderBottom: '1px solid #f3f4f6',
                padding: '0 16px 0 16px',
                zIndex: 1,
              }}
            >
              {sheetMode === 'pin-detail' && selectedPin ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14 }}>
                  <button
                    type="button"
                    className="drawer-back-btn"
                    onClick={backToList}
                    aria-label="一覧に戻る"
                  >
                    <FaChevronLeft size={14} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                        textAlign: 'left',
                      }}
                    >
                      {selectedPin.title}
                    </h3>
                    {getSubtitle(selectedPin) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: selectedPin.folktaleTitle ? '#D55DF4' : '#661A71',
                          fontWeight: 500,
                          marginTop: 2,
                          textAlign: 'left',
                        }}
                      >
                        {selectedPin.folktaleTitle ? '民話: ' : '伝統芸能: '}
                        {getSubtitle(selectedPin)}
                      </div>
                    )}
                  </div>
                  {/* 画像表示ボタン */}
                  {selectedPin.image && (
                    <button
                      type="button"
                      onClick={() => setImageOpen((prev) => !prev)}
                      aria-label={imageOpen ? '画像を閉じる' : '画像を表示'}
                      disabled={imageOpen}
                      style={{
                        width: 36,
                        height: 36,
                        minHeight: 0,
                        minWidth: 36,
                        borderRadius: 10,
                        border: 'none',
                        background: imageOpen ? '#e5e7eb' : '#f3f4f6',
                        color: imageOpen ? '#9ca3af' : '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: imageOpen ? 'default' : 'pointer',
                        padding: 0,
                        transition: 'background 0.15s ease, color 0.15s ease',
                        opacity: imageOpen ? 0.5 : 1,
                      }}
                    >
                      <FaImage size={14} />
                    </button>
                  )}
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
                      ({filteredPins.length}件)
                    </span>
                  </h2>
                  <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                    かつての小河内村の情報地点を探索
                  </div>
                  {/* タブ */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      marginTop: 6,
                      paddingBottom: 8,
                    }}
                  >
                    {TAB_ITEMS.map((tab) => {
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          style={{
                            padding: '3px 10px',
                            minHeight: 0,
                            borderRadius: 9999,
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.4,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: isActive ? '#111827' : '#f3f4f6',
                            color: isActive ? '#ffffff' : '#6b7280',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* スクロール可能なコンテンツ：ドラッグ不可 */}
            <div
              ref={scrollRef}
              style={{
                padding: '16px',
                flex: 1,
                overflowY: 'auto',
              }}
              data-vaul-no-drag
            >
              {sheetMode === 'pin-detail' && selectedPin ? (
                <div>
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
                  {filteredPins.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontSize: 14,
                        padding: '24px 0',
                      }}
                    >
                      該当する情報地点はありません
                    </div>
                  ) : (
                    <div>
                      {filteredPins.map((pin, index) => {
                        const style = pinTypeStyles[pin.type];
                        const isSelected = selectedPin?.id === pin.id;
                        const isLast = index === filteredPins.length - 1;
                        const subtitle = getSubtitle(pin);
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
                              padding: '10px 4px',
                              background: isSelected ? '#f8f7ff' : 'transparent',
                              border: 'none',
                              borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                              cursor: 'pointer',
                              textAlign: 'left',
                              borderRadius: isSelected ? 8 : 0,
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* タイプカラードット（選択時のみ表示） */}
                            {isSelected && (
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  minWidth: 8,
                                  borderRadius: 9999,
                                  background: style.color,
                                }}
                              />
                            )}
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
                                {activeTab !== 'all' && subtitle ? subtitle : pin.title}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#9ca3af',
                                  fontWeight: 500,
                                  marginTop: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                {activeTab !== 'all' && subtitle ? (
                                  <>
                                    <FaMapMarkerAlt size={9} style={{ flexShrink: 0 }} />
                                    {pin.title}
                                  </>
                                ) : subtitle ? (
                                  <span
                                    style={{ color: pin.folktaleTitle ? '#D55DF4' : '#661A71' }}
                                  >
                                    {subtitle}
                                  </span>
                                ) : (
                                  style.label
                                )}
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
                  )}
                </div>
              )}
            </div>
          </div>
        </VDrawer.Content>
      </VDrawer.Root>
    </>
  );
}
