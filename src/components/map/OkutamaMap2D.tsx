import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type OkutamaMap2DProps = {
  onRequest3D?: () => void;
};

export default function OkutamaMap2D({ onRequest3D }: OkutamaMap2DProps) {
  // ローカル歴史タイルの不透明度（UIで調整可能）
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.6);
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
        maxZoom={14}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        style={{ width: '100%', height: '100%' }}
      >
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
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#111827',
            padding: '8px 10px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label htmlFor="overlayOpacity" style={{ fontSize: '12px', fontWeight: 700 }}>
            透過
          </label>
          <input
            id="overlayOpacity"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
            style={{ width: '120px' }}
          />
          <span style={{ fontSize: '12px', width: '32px', textAlign: 'right' }}>
            {(overlayOpacity * 100).toFixed(0)}%
          </span>
        </div>
        <button
          type="button"
          onClick={onRequest3D}
          style={{
            padding: '10px 14px',
            backgroundColor: '#2B6CB0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          3Dビューへ
        </button>
      </div>
    </div>
  );
}


