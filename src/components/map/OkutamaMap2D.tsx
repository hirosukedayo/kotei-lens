import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap, ZoomControl } from 'react-leaflet';
import type { LatLngExpression, LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { FaMapSigns, FaLocationArrow } from 'react-icons/fa';
import { PiCubeFocusFill } from 'react-icons/pi';
import SensorPermissionRequest from '../ui/SensorPermissionRequest';
import { useSensors } from '../../hooks/useSensors';
import CompassCalibration from '../ui/CompassCalibration';
import {
  DEFAULT_START_POSITION,
  worldToGpsCoordinate,
  SCENE_CENTER,
} from '../../utils/coordinate-converter';
import { TERRAIN_SCALE_FACTOR, TERRAIN_CENTER_OFFSET } from '../../config/terrain-config';
import { Toast } from '../ui/Toast';
import { preloadLakeModel } from '../3d/LakeModel';
import { useDevModeStore } from '../../stores/devMode';
import 'leaflet/dist/leaflet.css';
import type { PinData } from '../../types/pins';
import type { GPSPosition, DeviceOrientation } from '../../types/sensors';
import { okutamaPins } from '../../data/okutama-pins';
import { debugPins } from '../../data/debug-pins';
import { pinTypeStyles } from '../../types/pins';
import PinListDrawer from '../ui/PinListDrawer';

export interface Initial3DPosition {
  latitude: number;
  longitude: number;
  heading?: number; // デバイスの方位角（度、0-360、北が0）
  headingOffset?: number; // キャリブレーション時の (Compass - Alpha) 差分
}

type OkutamaMap2DProps = {
  onRequest3D?: (initialPosition: Initial3DPosition) => void;
  selectedPin?: PinData | null;
  onSelectPin?: (pin: PinData) => void;
  onDeselectPin?: () => void;
};

// 現在地マーカーコンポーネント
const CurrentLocationMarker = ({
  gps,
  orientation,
}: {
  gps: GPSPosition;
  orientation: DeviceOrientation | null;
}) => {
  const icon = useMemo(() => {
    const gpsSpeed = gps.speed ?? 0;
    const gpsHeading = gps.heading;
    const compassHeading = orientation?.webkitCompassHeading ?? orientation?.alpha;

    // 1m/s (時速3.6km) 以上で移動中はGPSの進行方向を優先
    const isMoving = gpsSpeed > 1.0;
    const displayHeading = (isMoving && gpsHeading != null && !Number.isNaN(gpsHeading))
      ? gpsHeading
      : (compassHeading ?? 0);

    return L.divIcon({
      html: `
        <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
          <svg
            viewBox="0 0 24 24"
            width="36"
            height="36"
            style="
              transform: rotate(${displayHeading}deg);
              transition: transform 0.2s ease-out;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            "
          >
            <!-- ナビゲーション矢印 (FaLocationArrow風) -->
            <path
              d="M12 2L4.5 20.29C4.24 20.89 4.96 21.46 5.54 21.12L12 17.25L18.46 21.12C19.04 21.46 19.76 20.89 19.5 20.29L12 2Z"
              fill="#3b82f6"
              stroke="white"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      `,
      className: 'gps-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, [gps, orientation]);

  return <Marker position={[gps.latitude, gps.longitude]} icon={icon} />;
};

// 地図クリックイベントを捕捉するコンポーネント
const MapClickHandler = ({ onClick }: { onClick: () => void }) => {
  const map = useMap();
  const handlerRef = React.useRef(onClick);

  React.useEffect(() => {
    handlerRef.current = onClick;
  }, [onClick]);

  React.useEffect(() => {
    // Leafletのネイティブイベントリスナーを使用
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      console.log(`[DEBUG] Map instance click: ${e.latlng}`);
      if (handlerRef.current) {
        handlerRef.current();
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map]);

  // グローバルクリック監視（デバッグ用）
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      console.log('[DEBUG] Global click target:', e.target);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return null;
};

export default function OkutamaMap2D({
  onRequest3D,
  selectedPin: propSelectedPin,
  onSelectPin: propOnSelectPin,
  onDeselectPin: propOnDeselectPin,
}: OkutamaMap2DProps) {
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [sheetMode, setSheetMode] = useState<'pin-list' | 'pin-detail'>('pin-list');
  const pinClickGuardRef = useRef(false);
  // propsから選択ピンを取得、なければローカルstateを使用
  const [localSelectedPin, setLocalSelectedPin] = useState<PinData | null>(null);
  const selectedPin = propSelectedPin ?? localSelectedPin;
  const setSelectedPin = propOnSelectPin ?? setLocalSelectedPin;
  // 選択解除ハンドラのメモ化（依存配列の警告回避とパフォーマンス最適化）
  const defaultDeselect = React.useCallback(() => setLocalSelectedPin(null), []);
  const onDeselectPin = propOnDeselectPin ?? defaultDeselect;
  const mapRef = useRef<LeafletMap | null>(null);

  // GPS位置取得とセンサー管理
  const { sensorData, startSensors, sensorManager } = useSensors();
  // Devモード状態
  const { isDevMode } = useDevModeStore();
  // エリア外トースト表示フラグ
  const [showOutsideToast, setShowOutsideToast] = useState(false);
  // 3Dモード前のキャリブレーション中かどうか
  const [isCalibrating, setIsCalibrating] = useState(false);


  // 起動時の自動センタリング・トースト制御が完了したかどうか
  const [hasInitialCenterSet, setHasInitialCenterSet] = useState(false);

  // 画面中心位置（初期値は奥多摩湖の碑）
  const [center, setCenter] = useState<LatLngExpression>([
    DEFAULT_START_POSITION.latitude,
    DEFAULT_START_POSITION.longitude,
  ]);
  const MapRefBinder = () => {
    const map = useMap();
    useEffect(() => {
      if (mapRef.current) return;
      mapRef.current = map;
    }, [map]);
    return null;
  };

  // 地図クリック時のハンドリング（シートを閉じる）
  // 地図クリック時のハンドリング（シートを閉じる）
  const handleMapClick = React.useCallback(() => {
    // 地図の背景をクリックしたときのみ実行
    // マーカークリック時は stopPropagation しているのでここには来ないはずだが念のため
    if (sheetOpen) {
      setSheetOpen(false);
      // ドロワーが閉じるアニメーション（約300ms）を待ってから選択解除する
      setTimeout(() => {
        onDeselectPin();
      }, 300);
    }
  }, [sheetOpen, onDeselectPin]);



  // カスタムアイコン（選択時に強調表示）
  const createCustomIcon = (isSelected: boolean, pinType: keyof typeof pinTypeStyles) => {
    const style = pinTypeStyles[pinType];
    const baseColor = style.color;
    const color = isSelected ? '#ff4900' : baseColor; // 選択時の強調色
    const size = isSelected ? 40 : 36;
    const border = isSelected ? '3px solid #ffb899' : '3px solid white';
    const ringSize = 56; // 円環のサイズ
    const ripple = isSelected
      ? `<style>
          @keyframes pin-ripple {
            0% { width:${size}px; height:${size}px; opacity:0.7; }
            100% { width:${ringSize * 1.6}px; height:${ringSize * 1.6}px; opacity:0; }
          }
        </style>
        <div style="position:absolute; border-radius:50%; border:2px solid rgba(255,73,0,0.5); top:50%; left:50%; transform:translate(-50%,-50%); animation:pin-ripple 1.4s ease-out infinite;"></div>
        <div style="position:absolute; border-radius:50%; border:2px solid rgba(255,73,0,0.5); top:50%; left:50%; transform:translate(-50%,-50%); animation:pin-ripple 1.4s ease-out 0.5s infinite;"></div>`
      : '';
    return L.divIcon({
      html: `
        <div style="position:relative; width:${ringSize}px; height:${ringSize}px; display:flex; align-items:center; justify-content:center; overflow:visible;">
          ${ripple}
          <div style="
            width:${size}px; height:${size}px; background:${color}; ${border ? `border:${border};` : ''}
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.3);
            position:relative; z-index:1;
          ">
            <i class="ph-fill ph-${style.icon}" style="font-size:20px; color:#fff; line-height:1;"></i>
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
    setSheetOpen(true);
  };
  // 一覧から選択 → 詳細 + 地図パン
  // Drawerが画面下半分を占めるため、ピンを画面上部寄りに表示する
  const handleSelectPin = (pin: PinData) => {
    setSelectedPin(pin);
    const coords = Array.isArray(pin.coordinates) ? pin.coordinates : [0, 0];
    if (Array.isArray(coords) && coords.length === 2 && mapRef.current) {
      const map = mapRef.current;
      const currentZoom = map.getZoom() ?? 14;
      // ピンの位置をピクセル座標に変換し、画面の下方向にオフセットして
      // 実際のピンが画面上部 1/4 あたりに表示されるようにする
      const targetPoint = map.project(coords as [number, number], currentZoom);
      const mapHeight = map.getSize().y;
      // Drawer が最大 50vh を占めるので、その1/4(画面高さの12.5%)分だけ上にずらす
      targetPoint.y += mapHeight * 0.125;
      const offsetLatLng = map.unproject(targetPoint, currentZoom);
      map.flyTo(offsetLatLng, currentZoom, { duration: 0.6 });
    }
  };
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // 3D切替: クリック時にセンサー権限を確認
  const handleRequest3DWithPermission = async () => {
    // 3Dボタンを押した直後にモデルのプリロードを開始（キャリブレーション等の待ち時間を有効活用）
    preloadLakeModel();

    // 既に許可済みかチェック (キャッシュを利用)
    const orientationPermission = sensorManager.orientationService.getPermissionState?.() || 'unknown';
    // const gpsPermission = 'granted'; // GPSは基本的にavailableなら使えることが多いが、ここで厳密にチェックしてもよい

    // 簡易チェック: Orientationが許可済みなら即遷移 (iOS対策)
    // GPSやMotionは必須ではない、あるいはOrientation許可時に一括で処理される想定
    if (orientationPermission === 'granted') {
      // モバイルの場合はキャリブレーション（水平安定化）を挟む
      const ua = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      if (isMobile) {
        setIsCalibrating(true);
      } else {
        // PCなどは即座に遷移（ヘディングオフセットなし）
        transitionTo3D();
      }
    } else {
      // 未許可なら統一モーダルを表示
      setShowPermissionModal(true);
    }
  };

  const transitionTo3D = (headingOffset?: number) => {
    // 2Dマップの現在の中心位置を取得（マップインスタンスから直接取得）
    const currentCenter = mapRef.current?.getCenter();
    const commonProps = {
      heading: sensorData.orientation?.alpha ?? undefined,
      headingOffset: headingOffset,
    };

    if (currentCenter) {
      const initialPosition: Initial3DPosition = {
        latitude: currentCenter.lat,
        longitude: currentCenter.lng,
        ...commonProps,
      };
      onRequest3D?.(initialPosition);
    } else {
      // マップが初期化されていない場合は、stateのcenterを使用
      const centerLatLng = Array.isArray(center) ? center : [center.lat, center.lng];
      const initialPosition: Initial3DPosition = {
        latitude: centerLatLng[0],
        longitude: centerLatLng[1],
        ...commonProps,
      };
      onRequest3D?.(initialPosition);
    }
  };

  // キャリブレーション完了時のハンドラ
  const handleCalibrationComplete = (manualOffset: number) => {
    setIsCalibrating(false);

    // キャリブレーション時点での 方位（絶対）とAlpha（相対）の差分を計算
    // offset = Compass - Alpha
    // これにより、3Dモードでは (CurrentAlpha + offset) = CurrentCompass となる
    const compass = (sensorData.compassHeading ?? 0) + manualOffset;
    const alpha = sensorData.orientation?.alpha ?? 0;

    let offset = compass - alpha;
    // 正規化 (0-360)
    while (offset < 0) offset += 360;
    offset = offset % 360;

    transitionTo3D(offset);
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

  // GPS位置取得とエリア判定、画面中心位置の設定
  useEffect(() => {
    // センサーを開始
    startSensors();
  }, [startSensors]);

  // GPS位置が更新されたときにエリア判定と中心位置を更新
  useEffect(() => {
    const gpsPosition = sensorData.gps;
    // 起動時の最初のGPS取得時のみ、自動センタリングとトースト制御を行う
    if (!gpsPosition || hasInitialCenterSet) return;

    const isInArea = sensorManager.locationService.isInOkutamaArea(gpsPosition);

    if (isInArea) {
      // エリア内の場合：GPS位置を中心に設定
      const newCenter: LatLngExpression = [gpsPosition.latitude, gpsPosition.longitude];
      setCenter(newCenter);
      // マップの中心位置を更新
      mapRef.current?.flyTo(newCenter, 14, { duration: 0.6 });
      // エリア内なのでトーストは非表示
      setShowOutsideToast(false);
    } else {
      // エリア外の場合：初期位置（奥多摩湖の碑）を中心に設定
      const startCenter: LatLngExpression = [DEFAULT_START_POSITION.latitude, DEFAULT_START_POSITION.longitude];
      setCenter(startCenter);
      mapRef.current?.flyTo(startCenter, 14, { duration: 0.6 });
      // エリア外トーストを表示
      setShowOutsideToast(true);
    }
    setHasInitialCenterSet(true);
  }, [sensorData.gps, sensorManager.locationService, hasInitialCenterSet]);
  // public配下のタイルは Vite の base に追従して配信される
  const tilesBase = import.meta.env.BASE_URL || '/';
  const localTilesUrl = `${tilesBase}tiles/{z}/{x}/{y}.png`;

  // 固定の表示範囲（緯度経度）。
  // 体験エリア + 小河内神社 + その周辺を十分に含むよう、以前よりかなり広めに設定
  // south, west / north, east の順
  const okutamaBounds: LatLngBoundsExpression = [
    [35.73, 138.97], // 南西（少し広めに）
    [35.84, 139.11], // 北東（少し広めに）
  ];

  // devモード時: 3Dモデルの範囲を2Dマップ上に描画
  // 実際の地形のバウンディングボックス（terrainScale=[10,10,10]適用後）:
  // ログから取得した実際のサイズ: {x: 1490.0001525878906, y: 204.09059524536133, z: 1490.0001525878906}
  // 中心点: {x: -744.9999975831743, y: 177.19751206980436, z: 744.9999975831743}
  // LakeModel 側で position={[744.9999975831743, -177.19751206980436, -744.9999975831743]} を指定している。
  // したがって、現在の3D空間では地形の中心が原点(0,0,0)に一致しており、
  // バウンディングボックスは原点を中心とした対称な範囲として扱える。
  // terrainScale適用後の実際のサイズ: 1490.0001525878906 ユニット（約1.5km）
  const modelBounds = useMemo(() => {
    if (!isDevMode) return null;

    // 地形のバウンディングボックスの半サイズ（x,z方向）
    // terrainScale適用後の実際のサイズ: 1490.0001525878906（TERRAIN_SCALE_FACTOR=1.0の場合）
    // ログから取得した実際の値を使用し、TERRAIN_SCALE_FACTORでスケール調整
    const baseHalfSize = 1490.0001525878906 / 2;
    const halfSize = baseHalfSize * TERRAIN_SCALE_FACTOR;

    // 地形の中心位置オフセットを考慮
    // TERRAIN_CENTER_OFFSETで地形の中心がずれている場合、矩形もずらす必要がある
    const centerOffsetX = TERRAIN_CENTER_OFFSET[0];
    const centerOffsetZ = TERRAIN_CENTER_OFFSET[2];

    // 現在の3D空間では地形中心がTERRAIN_CENTER_OFFSET分ずれているため、
    // バウンディングボックスの四隅は中心オフセットを考慮して計算する。
    const corners3D = [
      { x: centerOffsetX - halfSize, y: 0, z: centerOffsetZ - halfSize }, // 北西
      { x: centerOffsetX + halfSize, y: 0, z: centerOffsetZ - halfSize }, // 北東
      { x: centerOffsetX + halfSize, y: 0, z: centerOffsetZ + halfSize }, // 南東
      { x: centerOffsetX - halfSize, y: 0, z: centerOffsetZ + halfSize }, // 南西
    ];

    // 3D座標をGPS座標に変換
    const cornersGPS = corners3D.map((corner) => {
      const gps = worldToGpsCoordinate(corner, SCENE_CENTER);
      return [gps.latitude, gps.longitude] as [number, number];
    });

    return cornersGPS;
  }, [isDevMode]);

  // デバッグ用: レンダリング条件の監視
  useEffect(() => {
    console.log('[DEBUG] OkutamaMap2D State:', { isDevMode, hasBounds: !!modelBounds });
  }, [isDevMode, modelBounds]);

  // ピンクリック時の処理（同じピンを再度クリックすると選択解除）
  const handlePinClick = (pin: PinData) => {
    if (selectedPin?.id === pin.id) {
      // 同じピンを再度クリックした場合は選択解除
      onDeselectPin();
      setSheetOpen(false);
    } else {
      // 新しいピンを選択 — vaulの外クリック閉じを一時的にブロック
      pinClickGuardRef.current = true;
      setTimeout(() => { pinClickGuardRef.current = false; }, 300);
      handleSelectPin(pin);
      setSheetOpen(true);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      {/* 全画面。ズームは固定、パンは境界内でのみ可能 */}
      <MapContainer
        center={center}
        zoom={14}
        maxBounds={okutamaBounds}
        maxBoundsViscosity={0.5}
        // もう少し引きで見られるように、最小ズームを 13 まで許可
        minZoom={13}
        maxZoom={20}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={false}
        keyboard={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapRefBinder />
        <ZoomControl position="bottomright" />
        {/* ベース: Stamen Toner Lite（セピア調フィルタ適用） */}
        <MapClickHandler onClick={handleMapClick} />
        <TileLayer
          url={`https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
          className="base-tiles"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {/* オーバーレイ: ローカル歴史タイル（opacity は UI で調整） */}
        <TileLayer
          url={localTilesUrl}
          noWrap
          /* tms */
          minZoom={12}
          maxZoom={20}
          opacity={1}
          zIndex={700}
        />



        {/* devモード時: 3Dモデルの範囲を矩形で表示 */}
        {isDevMode && modelBounds && (
          <Polygon
            positions={modelBounds}
            pathOptions={{
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.2,
              weight: 2,
              dashArray: '10, 5',
            }}
          />
        )}

        {/* GPS位置マーカー（エリア内の場合、またはdevモードの場合に表示） */}
        {sensorData.gps &&
          (sensorManager.locationService.isInOkutamaArea(sensorData.gps) || isDevMode) && (
            <CurrentLocationMarker gps={sensorData.gps} orientation={sensorData.orientation} />
          )}

        {/* ピンマーカー */}
        {(isDevMode ? [...okutamaPins, ...debugPins] : okutamaPins).map((pin) => {
          const isSelected = selectedPin?.id === pin.id;
          return (
            <Marker
              key={pin.id}
              position={pin.coordinates}
              icon={createCustomIcon(isSelected, pin.type as keyof typeof pinTypeStyles)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent);
                  handlePinClick(pin);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* エリア外トースト */}
      <Toast
        open={showOutsideToast}
        onClose={() => setShowOutsideToast(false)}
        variant="warning"
        message="現在、体験エリアの外にいます。小河内神社付近（奥多摩湖周辺）に近づくと、かつての村の姿を重ねて見ることができます。"
      />

      {/* UI（3D切替）。mapより前面 */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
        }}
      >
        <button
          type="button"
          onClick={handleRequest3DWithPermission}
          style={{
            padding: '14px 32px',
            borderRadius: 9999,
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #e5e7eb',
            boxShadow: '0 3px 10px rgba(60,64,67,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          aria-label="3Dビューへ"
        >
          <PiCubeFocusFill size={26} />
          3Dモード
        </button>
      </div>



      {/* 古地図透明度調整スライダー（右下、アイコンベース） & 現在地ボタン */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '16px',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '16px', // ボタンとスライダーの間隔を広げる
        }}
      >
        {/* 現在地へ戻るボタン */}
        {sensorData.gps && (
          <button
            type="button"
            onClick={() => {
              if (sensorData.gps) {
                mapRef.current?.flyTo([sensorData.gps.latitude, sensorData.gps.longitude], 16, { duration: 1.0 });
              }
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: '#ffffff',
              color: '#3b82f6',
              border: '1px solid #e5e7eb',
              boxShadow: '0 3px 10px rgba(60,64,67,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="現在地へ戻る"
          >
            <FaLocationArrow size={24} />
          </button>
        )}

      </div>

      {/* 画面中央：中抜き十字マーク（記事表示中はフェードアウト） */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '30px',
          height: '30px',
          zIndex: 10000,
          pointerEvents: 'none',
          opacity: (sheetOpen && sheetMode === 'pin-detail') ? 0 : 1,
          transition: 'opacity 0.5s ease',
        }}
      >
        {/* 上 */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '2px', height: '10px', backgroundColor: 'rgba(128,128,128,0.7)', }} />
        {/* 下 */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '2px', height: '10px', backgroundColor: 'rgba(128,128,128,0.7)', }} />
        {/* 左 */}
        <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: '10px', height: '2px', backgroundColor: 'rgba(128,128,128,0.7)', }} />
        {/* 右 */}
        <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', width: '10px', height: '2px', backgroundColor: 'rgba(128,128,128,0.7)', }} />
      </div>

      {/* 左下：ピン一覧（アイコン） */}
      <div
        style={{
          position: 'absolute',
          left: '16px',
          bottom: '24px',
          zIndex: 10000,
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
            cursor: 'pointer',
          }}
        >
          <FaMapSigns size={22} />
        </button>
      </div>

      {/* ピンリストDrawer */}
      <PinListDrawer
        open={sheetOpen}
        onOpenChange={(open) => {
          // ピン選択直後のvaul外クリック閉じを無視
          if (!open && pinClickGuardRef.current) return;
          setSheetOpen(open);
          if (!open) {
            mapRef.current?.closePopup();
          }
        }}
        selectedPin={selectedPin}
        onSelectPin={handleSelectPin}
        onDeselectPin={onDeselectPin}
        onSheetModeChange={setSheetMode}
      />

      {/* センサー権限要求モーダル (統一UI) */}
      {showPermissionModal && (
        <SensorPermissionRequest
          onPermissionsGranted={() => {
            console.log('Permissions granted callback triggered'); // Debug log
            setShowPermissionModal(false);

            // モバイル判定を再度行う
            const ua = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

            if (isMobile) {
              console.log('Mobile detected, starting calibration'); // Debug log
              // 許可直後にセンサーを強制再開（リスナーをアタッチするため）
              // force=true, autoRequest=true
              startSensors(true, true).then(() => {
                setIsCalibrating(true);
              });
            } else {
              console.log('Desktop detected, transitioning to 3D directly'); // Debug log
              transitionTo3D();
            }
          }}
          onPermissionsDenied={(errors) => {
            console.warn('Permissions denied or partially failed:', errors);
            setShowPermissionModal(false);
            // 拒否されても、ユーザーが「許可せずに開始」を選んだ場合などはここに来る可能性がある
            // あるいは明示的な拒否。
            // ここでは「機能制限付きで開始しますか？」等の確認を出してもいいが
            // 一旦、ユーザーが意図して閉じた/拒否したなら何もしない（3Dには行かない）のが基本
            // ただし「許可せずに開始」ボタンは onPermissionsGranted を呼ぶ実装になっているので注意
          }}
        />
      )}

      {/* 3D遷移前キャリブレーション (Auto Mode Only) */}
      {isCalibrating && (
        <CompassCalibration
          onCalibrationComplete={handleCalibrationComplete}
          onClose={() => setIsCalibrating(false)}
          initialOffset={0}
          orientation={sensorData.orientation}
          compassHeading={sensorData.compassHeading}
          allowManualAdjustment={false} // 2Dマップ上では手動調整（風景合わせ）はできないので隠す
        />
      )}
    </div >
  );
}
