import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any; // 型の都合でネストコンポーネントを any 扱い
import type { PinData } from '../../types/pins';
import { okutamaPins } from '../../data/okutama-pins';
import { pinTypeStyles } from '../../types/pins';
import { audioTracks } from '../../data/audio-tracks';
import {
  FaMapMarkerAlt,
  FaExternalLinkAlt,
  FaChevronRight,
  FaChevronLeft,
  FaImage,
  FaTimes,
  FaPlay,
  FaPause,
} from 'react-icons/fa';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import { MdReplay5, MdForward5 } from 'react-icons/md';

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
  onImageOpenChange?: (open: boolean) => void;
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
  onImageOpenChange,
}: PinListDrawerProps) {
  const [sheetMode, _setSheetMode] = useState<'pin-list' | 'pin-detail'>('pin-list');
  const [activeTab, _setActiveTab] = useState<ListTab>('all');
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const [drawerTopY, setDrawerTopY] = useState(0);

  const [imageOpen, _setImageOpen] = useState(false);
  const setImageOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    _setImageOpen((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      onImageOpenChange?.(next);
      return next;
    });
  }, [onImageOpenChange]);

  // 画像表示の切り替え時にドロワー上端のY座標を測定
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPinの切り替え時にもドロワー位置を再計測する必要がある
  useEffect(() => {
    if (!imageOpen) {
      setDrawerTopY(0);
      return;
    }
    const measure = () => {
      const el = drawerContentRef.current;
      if (el) {
        setDrawerTopY(el.getBoundingClientRect().top);
      }
    };
    // Vaulのアニメーション完了後に測定（2フレーム待機）
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });
    return () => cancelAnimationFrame(id);
  }, [imageOpen, selectedPin]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 民話オーディオプレーヤー
  const folktaleAudioRef = useRef<HTMLAudioElement>(null);
  const [ftPlaying, setFtPlaying] = useState(false);
  const [ftCurrentTime, setFtCurrentTime] = useState(0);
  const [ftDuration, setFtDuration] = useState(0);

  const folktaleTrack = useMemo(
    () => (selectedPin?.folktaleId ? audioTracks.find((t) => t.id === selectedPin.folktaleId) : null),
    [selectedPin?.folktaleId],
  );

  // 民話プレーヤーのイベントバインド
  useEffect(() => {
    const audio = folktaleAudioRef.current;
    if (!audio || !folktaleTrack) return;

    audio.src = `${import.meta.env.BASE_URL}audio/${folktaleTrack.filename}`;
    audio.load();
    setFtPlaying(false);
    setFtCurrentTime(0);
    setFtDuration(0);

    const onTimeUpdate = () => setFtCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setFtDuration(audio.duration);
    const onPlay = () => setFtPlaying(true);
    const onPause = () => setFtPlaying(false);
    const onEnded = () => {
      setFtPlaying(false);
      setFtCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [folktaleTrack]);

  const ftTogglePlay = useCallback(() => {
    const audio = folktaleAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const ftSkip = useCallback((seconds: number) => {
    const audio = folktaleAudioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration || 0));
  }, []);

  const ftSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = folktaleAudioRef.current;
    const bar = e.currentTarget;
    if (!audio || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  }, []);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }
    if (!selectedPin) return;
    const text = selectedPin.reading ?? `${selectedPin.title}。${selectedPin.description}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [isSpeaking, selectedPin, stopSpeech]);

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
      stopSpeech();
    } else {
      setImageOpen(false);
    }
  }, [selectedPin, setSheetMode, setImageOpen, stopSpeech]);

  // ドロワーが閉じられたら音声を停止（スワイプ閉じ等あらゆるケースに対応）
  React.useEffect(() => {
    if (!open) {
      stopSpeech();
      folktaleAudioRef.current?.pause();
    }
  }, [open, stopSpeech]);

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
    stopSpeech();
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setImageOpen(false);
      // stopSpeechはuseEffect(!open)で一元管理
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
        {/* 画像表示エリア: 画面上端〜記事上端の空間に収まるよう写真を配置 */}
        <div
          style={{
            height: drawerTopY > 0 ? `${drawerTopY}px` : '50vh',
            display: 'flex',
            alignItems: 'center',
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
              width: 48,
              height: 48,
              minHeight: 0,
              borderRadius: 9999,
              border: 'none',
              background: '#ff4900',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1,
              padding: 0,
            }}
          >
            <FaTimes size={20} />
          </button>
          {selectedPin?.image && (
            <img
              src={`${import.meta.env.BASE_URL}${selectedPin.image.replace(/^\//, '')}`}
              alt={selectedPin.title}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          )}
        </div>
      </div>

      <VDrawer.Root open={open} onOpenChange={handleOpenChange} modal={false} noBodyStyles>
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
            ref={drawerContentRef}
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
                  {/* 音声再生ボタン */}
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    aria-label={isSpeaking ? '読み上げを停止' : '読み上げ'}
                    style={{
                      width: 36,
                      height: 36,
                      minHeight: 0,
                      minWidth: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: isSpeaking ? '#111827' : '#f3f4f6',
                      color: isSpeaking ? '#ffffff' : '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {isSpeaking ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
                  </button>
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
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* 民話インラインプレーヤー */}
                    {folktaleTrack && (
                      <div
                        style={{
                          background: '#f5f5f5',
                          borderRadius: 14,
                          padding: '14px 16px 16px',
                          position: 'relative',
                        }}
                      >
                        {/* 民話ページリンク */}
                        <a
                          href={`${import.meta.env.BASE_URL}minwa/?id=${selectedPin.folktaleId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="民話ページを開く"
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 12,
                            color: '#c0c0c0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FaExternalLinkAlt size={10} />
                        </a>
                        {/* biome-ignore lint/a11y/useMediaCaption: audio-only folk tale narration */}
                        <audio ref={folktaleAudioRef} preload="metadata" />
                        <div style={{ textAlign: 'center', marginBottom: 10 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
                            {folktaleTrack.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginTop: 2 }}>
                            語り：荒澤弘
                          </div>
                        </div>
                        {/* プログレスバー */}
                        <div
                          onClick={ftSeek}
                          onKeyDown={undefined}
                          style={{
                            height: 6,
                            borderRadius: 3,
                            background: '#3a3a3a',
                            cursor: 'pointer',
                            marginBottom: 14,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 3,
                              background: '#e07028',
                              width: ftDuration > 0 ? `${(ftCurrentTime / ftDuration) * 100}%` : '0%',
                              transition: 'width 0.1s linear',
                            }}
                          />
                        </div>
                        {/* コントロールボタン */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                          <button
                            type="button"
                            onClick={() => ftSkip(-5)}
                            aria-label="5秒戻る"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 9999,
                              border: 'none',
                              background: '#9ca3af',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              minHeight: 0,
                            }}
                          >
                            <MdReplay5 size={30} />
                          </button>
                          <button
                            type="button"
                            onClick={ftTogglePlay}
                            aria-label={ftPlaying ? '一時停止' : '再生'}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 9999,
                              border: 'none',
                              background: '#6b7280',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              minHeight: 0,
                            }}
                          >
                            {ftPlaying ? <FaPause size={22} /> : <FaPlay size={22} style={{ marginLeft: 3 }} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => ftSkip(5)}
                            aria-label="5秒進む"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 9999,
                              border: 'none',
                              background: '#9ca3af',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              minHeight: 0,
                            }}
                          >
                            <MdForward5 size={30} />
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedPin.externalUrl && (
                      <a
                        href={selectedPin.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 12px',
                          background: '#f3f4f6',
                          borderRadius: 10,
                          textDecoration: 'none',
                          color: '#6b7280',
                          fontWeight: 600,
                          fontSize: '12px',
                          border: 'none',
                        }}
                      >
                        <FaExternalLinkAlt size={10} />
                        <span>{selectedPin.externalUrlTitle || '関連リンク'}</span>
                      </a>
                    )}
                    {selectedPin.mapUrl && (
                      <a
                        href={selectedPin.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 12px',
                          background: '#f3f4f6',
                          borderRadius: 10,
                          textDecoration: 'none',
                          color: '#6b7280',
                          fontWeight: 600,
                          fontSize: '12px',
                          border: 'none',
                        }}
                      >
                        <FaMapMarkerAlt size={11} />
                        <span>いまはここ</span>
                      </a>
                    )}
                  </div>
                  {/* ページネーション */}
                  {(() => {
                    const currentIndex = filteredPins.findIndex((p) => p.id === selectedPin.id);
                    const prevPin = currentIndex > 0 ? filteredPins[currentIndex - 1] : null;
                    const nextPin = currentIndex < filteredPins.length - 1 ? filteredPins[currentIndex + 1] : null;
                    const tabLabel = TAB_ITEMS.find((t) => t.key === activeTab)?.label ?? '';
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginTop: 24,
                          paddingTop: 16,
                          borderTop: '1px solid #f3f4f6',
                        }}
                      >
                        {/* 前へ */}
                        <button
                          type="button"
                          disabled={!prevPin}
                          onClick={() => prevPin && onSelectPin(prevPin)}
                          aria-label="前の地点"
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 0,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: prevPin ? 'pointer' : 'default',
                            opacity: prevPin ? 1 : 0,
                          }}
                        >
                          <FaChevronLeft size={10} style={{ color: '#9ca3af', flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: '#6b7280',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textAlign: 'left',
                            }}
                          >
                            {prevPin?.title ?? ''}
                          </span>
                        </button>
                        {/* 中央ラベル */}
                        <div
                          style={{
                            flexShrink: 0,
                            textAlign: 'center',
                            padding: '0 12px',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', lineHeight: 1.3 }}>
                            {tabLabel}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', lineHeight: 1.3 }}>
                            {currentIndex + 1}/{filteredPins.length}
                          </div>
                        </div>
                        {/* 次へ */}
                        <button
                          type="button"
                          disabled={!nextPin}
                          onClick={() => nextPin && onSelectPin(nextPin)}
                          aria-label="次の地点"
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 6,
                            minHeight: 0,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: nextPin ? 'pointer' : 'default',
                            opacity: nextPin ? 1 : 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: '#6b7280',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textAlign: 'right',
                            }}
                          >
                            {nextPin?.title ?? ''}
                          </span>
                          <FaChevronRight size={10} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        </button>
                      </div>
                    );
                  })()}
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
                              <style.IconComponent
                                size={17}
                                color={isSelected ? style.color : '#9ca3af'}
                                style={{
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
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  ...(activeTab !== 'all' && subtitle
                                    ? { display: 'flex', alignItems: 'center', gap: 3 }
                                    : {}),
                                }}
                              >
                                {activeTab !== 'all' && subtitle ? (
                                  <>
                                    <FaMapMarkerAlt size={9} style={{ flexShrink: 0 }} />
                                    {pin.title}
                                  </>
                                ) : (
                                  [
                                    style.label,
                                    pin.folktaleTitle,
                                    pin.performingArtTitle,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')
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
