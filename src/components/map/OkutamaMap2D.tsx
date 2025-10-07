import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression, LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { FaMapSigns, FaMapMarkerAlt } from 'react-icons/fa';
import { PiCubeFocusFill } from 'react-icons/pi';
import { getSensorManager } from '../../services/sensors/SensorManager';
import 'leaflet/dist/leaflet.css';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any; // 型の都合でネストコンポーネントを any 扱い
import type { PinData } from '../../types/pins';
import { okutamaPins } from '../../data/okutama-pins';
import { pinTypeStyles } from '../../types/pins';

type OkutamaMap2DProps = {
  onRequest3D?: () => void;
};

export default function OkutamaMap2D({ onRequest3D }: OkutamaMap2DProps) {
  // ローカル歴史タイルの不透明度（UIで調整可能）
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.6);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [sheetMode, setSheetMode] = useState<'pin-list' | 'pin-detail'>('pin-list');
  const sheetContentRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const MapRefBinder = () => {
    const map = useMap();
    useEffect(() => {
      if (mapRef.current) return;
      mapRef.current = map;
    }, [map]);
    return null;
  };

  // カスタムアイコン（選択時に強調表示）
  const createCustomIcon = (isSelected: boolean, pinType: keyof typeof pinTypeStyles) => {
    const style = pinTypeStyles[pinType];
    const baseColor = style.color;
    const color = isSelected ? '#dc2626' : baseColor; // 選択時は赤系で強調
    const size = isSelected ? 32 : 28;
    const border = isSelected ? '3px solid #fecaca' : '3px solid white';
    const ringSize = 48; // 円環のサイズ
    const ring = isSelected
      ? `<div style="position:absolute; width:${ringSize}px; height:${ringSize}px; border-radius:50%; border:2px solid rgba(220,38,38,0.35); top:50%; left:50%; transform:translate(-50%, -50%);"></div>`
      : '';
    return L.divIcon({
      html: `
        <div style="position:relative; width:${ringSize}px; height:${ringSize}px; display:flex; align-items:center; justify-content:center;">
          ${ring}
          <div style="
            width:${size}px; height:${size}px; background:${color}; ${border ? `border:${border};` : ''}
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.3);
            position:relative; z-index:1;
          ">
            <span style="font-size:${isSelected ? '16px' : '14px'}; line-height:1;">${style.icon}</span>
          </div>
        </div>
      `,
      className: 'custom-pin',
      iconSize: [ringSize, ringSize],
      iconAnchor: [ringSize / 2, ringSize],
    });
  };
  // 一覧を開く
  const openPinList = () => {
    setSheetMode('pin-list');
    setSheetOpen(true);
  };
  // 一覧から選択 → 詳細 + 地図パン
  const handleSelectPinFromList = (pin: PinData) => {
    setSelectedPin(pin);
    setSheetMode('pin-detail');
    setSheetOpen(true);
    const coords = Array.isArray(pin.coordinates) ? pin.coordinates : [0, 0];
    if (Array.isArray(coords) && coords.length === 2) {
      mapRef.current?.flyTo(coords as any, 14, { duration: 0.6 });
    }
  };
  // 詳細→一覧に戻る
  const backToList = () => {
    setSheetMode('pin-list');
    setSelectedPin(null);
  };
  // 3D切替: クリック時に方位センサーの許可を要求し、許可時のみ遷移
  const handleRequest3DWithPermission = async () => {
    try {
      const permission = await getSensorManager().orientationService.requestPermission();
      if (permission === 'granted') {
        onRequest3D?.();
      } else {
        // 許可が得られない場合は何もしない（必要なら通知やシート表示へ）
      }
    } catch {
      // 例外時も遷移しない
    }
  };
  // iOSなどで100vhがアドレスバーで縮まないように調整
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // 奥多摩湖周辺のざっくり中心座標
  const center: LatLngExpression = [35.77386, 139.02469];
  // public配下のタイルは Vite の base に追従して配信される
  const tilesBase = import.meta.env.BASE_URL || '/';
  const localTilesUrl = `${tilesBase}tiles_okutama/{z}/{x}/{y}.png`;

  // タイルインデックス範囲 → 緯度経度境界
  // - tms: ディレクトリのYがTMSならXYZに反転
  // - paddingTiles: 見切れ回避やUIのための余白（タイル単位）
  const tileIndexToBounds = (
    z: number,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    options?: { tms?: boolean; paddingTiles?: { north?: number; south?: number; west?: number; east?: number } }
  ): LatLngBoundsExpression => {
    const n = 2 ** z;
    const toXyzY = (y: number) => (options?.tms ? (n - 1) - y : y);
    const xyzYMin = toXyzY(yMin);
    const xyzYMax = toXyzY(yMax);

    const tile2lon = (x: number) => (x / n) * 360 - 180;
    const tile2lat = (y: number) => {
      const nY = Math.PI - (2 * Math.PI * y) / n;
      return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(nY) - Math.exp(-nY)));
    };

    // 余白（必要に応じて微調整）
    const padW = options?.paddingTiles?.west ?? 0;
    const padE = options?.paddingTiles?.east ?? 0;
    const padN = options?.paddingTiles?.north ?? 0;
    const padS = options?.paddingTiles?.south ?? 0;

    const west = tile2lon(xMin - padW);
    const east = tile2lon(xMax + 1 + padE);
    const north = tile2lat(xyzYMin - padN);
    const south = tile2lat(xyzYMax + 1 + padS);
    return [
      [south, west],
      [north, east],
    ];
  };

  // 固定の表示範囲（z=14のタイルインデックス）。南へ余白を1.0タイル
  const okutamaBounds = tileIndexToBounds(14, 14516, 14522, 9936, 9940, {
    tms: true,
    paddingTiles: { south: 1.0 },
  });

  // ピンクリック時の処理
  const handlePinClick = (pin: PinData) => {
    setSelectedPin(pin);
    setSheetMode('pin-detail');
    setSheetOpen(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      {/* 全画面。ズームは固定、パンは境界内でのみ可能 */}
      <MapContainer
        center={center}
        zoom={14}
        bounds={okutamaBounds}
        maxBounds={okutamaBounds}
        maxBoundsViscosity={1.0}
        minZoom={14}
        maxZoom={20}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={false}
        keyboard={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapRefBinder />
        {/* ベース: OSM */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {/* オーバーレイ: ローカル歴史タイル（opacity は UI で調整） */}
        <TileLayer
          url={localTilesUrl}
          noWrap
          tms
          minZoom={12}
          maxZoom={20}
          opacity={overlayOpacity}
          zIndex={700}
        />

        {/* ピンマーカー */}
        {okutamaPins.map((pin) => {
          const style = pinTypeStyles[pin.type];
          const isSelected = selectedPin?.id === pin.id;
          return (
            <Marker
              key={pin.id}
              position={pin.coordinates}
              icon={createCustomIcon(isSelected, pin.type as keyof typeof pinTypeStyles)}
              eventHandlers={{
                click: () => handlePinClick(pin),
              }}
            >
            </Marker>
          );
        })}
      </MapContainer>

      {/* UI（透過スライダー / 3D切替）。mapより前面 */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          zIndex: 10000,
        }}
      >
        <button
          type="button"
          onClick={handleRequest3DWithPermission}
          style={{
            width: 72,
            height: 72,
            borderRadius: 9999,
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #e5e7eb',
            boxShadow: '0 3px 10px rgba(60,64,67,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          aria-label="3Dビューへ"
        >
          <PiCubeFocusFill size={64} />
        </button>
      </div>

      {/* 左下：ピン一覧（アイコン） */}
      <div
        style={{
          position: 'absolute',
          left: '16px',
          bottom: '80px',
          zIndex: 10000
        }}
      >
        <button
          type="button"
          aria-label="ピン一覧"
          onClick={openPinList}
          style={{
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 6px rgba(60,64,67,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <FaMapSigns size={22} />
        </button>
      </div>

      {/* Vaul Bottom Sheet: ピン情報表示 */}
      <VDrawer.Root open={sheetOpen} onOpenChange={(open: boolean) => { setSheetOpen(open); if (!open) { setSelectedPin(null); setSheetMode('pin-list'); mapRef.current?.closePopup(); } }}>
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
              boxShadow: '0 -8px 24px rgba(0,0,0,.2)'
            }}
            onOpenAutoFocus={(e: Event) => e.preventDefault()}
            onCloseAutoFocus={(e: Event) => e.preventDefault()}
          >
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#e5e7eb' }} />
            </div>
            {/* 固定ヘッダー */}
            <div style={{
              position: 'sticky',
              top: 0,
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 16px 16px 16px',
              zIndex: 1
            }}>
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
                      transition: 'all 0.2s ease'
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
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#111827', lineHeight: '1.35' }}>
                      {selectedPin.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {pinTypeStyles[selectedPin.type].label}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FaMapSigns size={24} color="#3c4043" />
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>一覧</h3>
                </div>
              )}
            </div>
            
            {/* スクロール可能なコンテンツ */}
            <div
              ref={sheetContentRef}
              style={{
                maxHeight: '50vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '0 16px 16px 16px',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y'
              }}
            >
              {sheetMode === 'pin-detail' && selectedPin ? (
                <div>
                  {selectedPin.image && (
                    <div style={{ marginBottom: '12px' }}>
                      <img
                        src={selectedPin.image}
                        alt={selectedPin.title}
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  )}
                  
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', lineHeight: '1.5', color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {selectedPin.description}
                  </p>
                  
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    座標: {selectedPin.coordinates[0].toFixed(6)}, {selectedPin.coordinates[1].toFixed(6)}
                  </div>
                  
                  {selectedPin.mapUrl && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => window.open(selectedPin.mapUrl, '_blank')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      >
                        <FaMapMarkerAlt size={16} />
                        現在の場所
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {sheetMode === 'pin-list' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', margin: '0 0 8px 0' }}>
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
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: 20 }}>{style.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
    </div>
  );
}


