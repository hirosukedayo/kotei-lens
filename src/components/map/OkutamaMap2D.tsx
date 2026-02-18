import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import type { LatLngExpression, LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { FaMapSigns, FaLocationArrow, FaMapMarkerAlt, FaCompass, FaPlus, FaMinus } from 'react-icons/fa';
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

import { preloadLakeModel } from '../3d/LakeModel';
import { useDevModeStore } from '../../stores/devMode';
import 'leaflet/dist/leaflet.css';
import type { PinData } from '../../types/pins';
import type { GPSPosition } from '../../types/sensors';
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

// 選択ピンのリップルエフェクト（requestAnimationFrame駆動でiOS Safariでも確実に動作）
const PinRippleEffect = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = 1400; // ms
    const maxScale = 2.2;
    const baseSize = 40;
    const ringCount = 2;
    const stagger = 500; // ms（2つ目のリングの遅延）

    let startTime: number | null = null;

    const draw = (timestamp: number) => {
      if (!startTime) startTime = timestamp;

      // キャンバスサイズをリップル最大径に合わせる
      const canvasSize = baseSize * maxScale + 8;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      // マップ上の座標をピクセル位置に変換してキャンバスを配置
      // iconAnchorが下端中央 [28, 56] なので、ピンの円の中心は point.y - 28 の位置
      const point = map.latLngToContainerPoint(position);
      const pinCenterY = point.y - 28; // ringSize(56) / 2
      canvas.style.left = `${point.x - canvasSize / 2}px`;
      canvas.style.top = `${pinCenterY - canvasSize / 2}px`;

      ctx.clearRect(0, 0, canvasSize, canvasSize);
      const cx = canvasSize / 2;
      const cy = canvasSize / 2;

      for (let i = 0; i < ringCount; i++) {
        const elapsed = timestamp - startTime - i * stagger;
        if (elapsed < 0) continue;

        const progress = (elapsed % duration) / duration; // 0-1
        const eased = 1 - (1 - progress) * (1 - progress); // ease-out
        const scale = 1 + (maxScale - 1) * eased;
        const opacity = 0.7 * (1 - eased);
        const radius = (baseSize / 2) * scale;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 73, 0, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    // マップ移動時にもキャンバス位置を更新
    const onMove = () => {
      // draw内で毎フレーム位置更新しているので追加処理は不要
    };
    map.on('move', onMove);

    return () => {
      cancelAnimationFrame(animRef.current);
      map.off('move', onMove);
    };
  }, [map, position]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    />
  );
};

// 現在地マーカーコンポーネント（Google Maps風: 中心にドット + 方位方向にグラデーション扇形）
const CurrentLocationMarker = ({
  gps,
  compassHeading,
  hasHeading,
}: {
  gps: GPSPosition;
  compassHeading: number | null;
  hasHeading: boolean;
}) => {
  const icon = useMemo(() => {
    const gpsSpeed = gps.speed ?? 0;
    const gpsHeading = gps.heading;

    // 1m/s (時速3.6km) 以上で移動中はGPSの進行方向を優先
    const isMoving = gpsSpeed > 1.0;
    const displayHeading = (isMoving && gpsHeading != null && !Number.isNaN(gpsHeading))
      ? gpsHeading
      : (compassHeading ?? 0);

    // 視野角(度) と SVG上の半径
    const fovDeg = 70;
    const r = 40; // 扇形の半径
    const cx = 50;
    const cy = 50;
    const halfFov = fovDeg / 2;

    // 扇形のパス（12時方向=上を0度として左右に広がる）
    const startAngle = -90 - halfFov;
    const endAngle = -90 + halfFov;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = fovDeg > 180 ? 1 : 0;

    const conePath = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

    // 方位が有効な場合のみ扇形を描画
    const showCone = hasHeading && compassHeading !== null;

    const coneHtml = showCone
      ? `<path d="${conePath}" fill="url(#headingCone)" transform="rotate(${displayHeading}, ${cx}, ${cy})" />`
      : '';

    // ユニークIDを生成（複数マーカー対策）
    const gradId = 'headingCone';

    return L.divIcon({
      html: `
        <div style="position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center;">
          <svg
            viewBox="0 0 100 100"
            width="120"
            height="120"
            style="
              overflow: visible;
              filter: drop-shadow(0 1px 3px rgba(0,0,0,0.25));
            "
          >
            <defs>
              <radialGradient id="${gradId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="#4285F4" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#4285F4" stop-opacity="0.03" />
              </radialGradient>
            </defs>
            <!-- 視野の扇形（方位連動） -->
            ${coneHtml}
            <!-- 外側の光彩 -->
            <circle cx="${cx}" cy="${cy}" r="10" fill="rgba(66,133,244,0.15)" />
            <!-- 中心のドット -->
            <circle cx="${cx}" cy="${cy}" r="7" fill="#4285F4" stroke="white" stroke-width="2.5" />
          </svg>
        </div>
      `,
      className: 'gps-marker',
      iconSize: [120, 120],
      iconAnchor: [60, 60],
    });
  }, [gps, compassHeading, hasHeading]);

  return <Marker position={[gps.latitude, gps.longitude]} icon={icon} />;
};

// Drawer表示中にマップのタッチドラッグを無効化するコンポーネント
// vaulのドラッグとLeafletのパンが競合するのを防ぐ
const MapTouchGuard = ({ drawerOpen }: { drawerOpen: boolean }) => {
  const map = useMap();

  useEffect(() => {
    if (drawerOpen) {
      map.dragging.disable();
      map.touchZoom.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
    }
  }, [map, drawerOpen]);

  return null;
};

// 地図クリックイベントを捕捉するコンポーネント
const MapClickHandler = ({ onClick }: { onClick: () => void }) => {
  const map = useMap();
  const handlerRef = React.useRef(onClick);

  React.useEffect(() => {
    handlerRef.current = onClick;
  }, [onClick]);

  React.useEffect(() => {
    const handleMapClick = () => {
      handlerRef.current?.();
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map]);

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
  // 段階的パーミッションステップ管理
  type PermissionStep = 'check' | 'location' | 'heading' | 'outside' | 'done';
  const [permissionStep, setPermissionStep] = useState<PermissionStep>('check');
  // エリア外かどうか (null = まだGPS未取得で未判定)
  const [isOutsideArea, setIsOutsideArea] = useState<boolean | null>(null);
  // エリア外モーダルを一度表示したかどうか
  const hasShownOutsideModalRef = useRef(false);
  // 3Dモード前のキャリブレーション中かどうか
  const [isCalibrating, setIsCalibrating] = useState(false);
  // 方位許可の状態管理
  const [headingPermission, setHeadingPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');


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



  // カスタムアイコン（選択時に強調表示）- メモ化で不要な再生成を回避
  const createCustomIcon = useCallback((isSelected: boolean, pinType: keyof typeof pinTypeStyles) => {
    const style = pinTypeStyles[pinType];
    const baseColor = style.color;
    const color = isSelected ? '#ff4900' : baseColor; // 選択時の強調色
    const size = isSelected ? 40 : 36;
    const border = isSelected ? '3px solid #ffb899' : '3px solid white';
    const ringSize = 56; // 円環のサイズ
    return L.divIcon({
      html: `
        <div style="position:relative; width:${ringSize}px; height:${ringSize}px; display:flex; align-items:center; justify-content:center; overflow:visible;">
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
  }, []);
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

  // 方位許可状態の初期チェック
  useEffect(() => {
    const checkHeadingPermission = async () => {
      const state = await sensorManager.orientationService.checkPermission();
      if (state === 'granted') {
        setHeadingPermission('granted');
      } else if (state === 'denied') {
        setHeadingPermission('denied');
      } else {
        setHeadingPermission('prompt');
      }
    };
    checkHeadingPermission();
  }, [sensorManager.orientationService]);

  // マウント時: 既存の権限状態を確認し、適切なステップに遷移
  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時に1回だけ実行する初期化処理
  useEffect(() => {
    const checkExistingPermissions = async () => {
      const gpsPermission = await sensorManager.locationService.checkPermission();
      const orientationPermission = await sensorManager.orientationService.checkPermission();
      const needsHeadingPrompt = orientationPermission === 'prompt';

      if (gpsPermission === 'granted') {
        startSensors();
        if (needsHeadingPrompt) {
          setPermissionStep('heading');
        } else {
          setPermissionStep('done');
        }
      } else {
        setPermissionStep('location');
      }
    };
    checkExistingPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 方位許可をリクエスト（ユーザーインタラクション内で呼ぶ）
  const requestHeadingPermission = useCallback(async () => {
    try {
      const permission = await sensorManager.orientationService.requestPermission();
      setHeadingPermission(permission);
      if (permission === 'granted') {
        // センサーを再起動して方位トラッキングを開始
        await startSensors(true, true);
      }
    } catch {
      setHeadingPermission('denied');
    }
  }, [sensorManager.orientationService, startSensors]);

  // Step 1: 位置情報の許可ボタン押下（GPSのみ開始、方位・モーションは触らない）
  const handleLocationPermissionRequest = useCallback(async () => {
    // GPSだけを開始（startSensorsは方位やモーションも開始してOSプロンプトが出るため直接呼ぶ）
    // useSensorsのGPSコールバックは後のステップでstartSensors経由で接続される
    if (sensorManager.locationService.isAvailable()) {
      sensorManager.locationService.startWatching(() => {});
    }

    const orientationState = sensorManager.orientationService.getPermissionState();
    const isIOS =
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof (window.DeviceOrientationEvent as any).requestPermission === 'function';
    const needsHeadingPrompt = isIOS && orientationState !== 'granted';
    if (needsHeadingPrompt) {
      setPermissionStep('heading');
    } else {
      // 非iOS or 方位既許可 → 全センサーを開始（非iOSではOSプロンプトなし）
      startSensors(false, true);
      setPermissionStep('done');
    }
  }, [sensorManager, startSensors]);

  // Step 2: 方位センサーの許可ボタン押下
  const handleHeadingPermissionRequest = useCallback(async () => {
    await requestHeadingPermission();
    // requestHeadingPermissionは許可時にstartSensors(true, true)を呼ぶ。
    // 拒否時にもGPSコールバック接続のためstartSensorsを呼ぶ（autoRequest=falseで追加プロンプトなし）
    startSensors(false, false);
    if (isOutsideArea === true) {
      hasShownOutsideModalRef.current = true;
      setPermissionStep('outside');
    } else {
      setPermissionStep('done');
    }
  }, [requestHeadingPermission, startSensors, isOutsideArea]);

  // Step 2: 方位スキップ
  const handleHeadingPermissionSkip = useCallback(() => {
    // 方位をスキップしてもGPSコールバック接続のためstartSensorsを呼ぶ
    // autoRequest=falseで方位・モーションのOSプロンプトは出ない
    startSensors(false, false);
    if (isOutsideArea === true) {
      hasShownOutsideModalRef.current = true;
      setPermissionStep('outside');
    } else {
      setPermissionStep('done');
    }
  }, [startSensors, isOutsideArea]);

  // Step 3: エリア外モーダルのOK
  const handleOutsideDismiss = useCallback(() => {
    setPermissionStep('done');
  }, []);

  // GPS位置が更新されたときにエリア判定と中心位置を更新
  useEffect(() => {
    const gpsPosition = sensorData.gps;
    // 起動時の最初のGPS取得時のみ、自動センタリングとエリア判定を行う
    if (!gpsPosition || hasInitialCenterSet) return;

    const isInArea = sensorManager.locationService.isInOkutamaArea(gpsPosition);

    if (isInArea) {
      const newCenter: LatLngExpression = [gpsPosition.latitude, gpsPosition.longitude];
      setCenter(newCenter);
      mapRef.current?.flyTo(newCenter, 14, { duration: 0.6 });
    } else {
      const startCenter: LatLngExpression = [DEFAULT_START_POSITION.latitude, DEFAULT_START_POSITION.longitude];
      setCenter(startCenter);
      mapRef.current?.flyTo(startCenter, 14, { duration: 0.6 });
    }
    setIsOutsideArea(!isInArea);
    setHasInitialCenterSet(true);
  }, [sensorData.gps, sensorManager.locationService, hasInitialCenterSet]);

  // GPS遅延対応: ステップが done のときにエリア外と判明したら outside モーダルを表示
  useEffect(() => {
    if (isOutsideArea === true && permissionStep === 'done' && !hasShownOutsideModalRef.current) {
      hasShownOutsideModalRef.current = true;
      setPermissionStep('outside');
    }
  }, [isOutsideArea, permissionStep]);
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: 'calc(var(--vh, 1vh) * 100)' }}>
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
        <MapTouchGuard drawerOpen={sheetOpen} />

        {/* ベース: CARTO ダークスタイル（dark_nolabels, OSMベース） */}
        <MapClickHandler onClick={handleMapClick} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          className="base-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
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
            <CurrentLocationMarker gps={sensorData.gps} compassHeading={sensorData.compassHeading} hasHeading={headingPermission === 'granted'} />
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

        {/* 選択ピンのリップルエフェクト（Canvas + rAF でiOS Safari対応） */}
        {selectedPin && (
          <PinRippleEffect position={selectedPin.coordinates as [number, number]} />
        )}
      </MapContainer>

      {/* Step 1: 位置情報の許可モーダル */}
      {permissionStep === 'location' && (
        <div
          aria-labelledby="location-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '32px 28px 24px',
              maxWidth: 'min(380px, 88vw)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 12 }}><FaMapMarkerAlt size={32} color="#3b82f6" /></div>
            <h3 id="location-modal-title" style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
              位置情報の許可
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>
              現在地を地図に表示するために、位置情報へのアクセスを許可してください。
            </p>
            <button
              type="button"
              className="modal-btn-primary"
              onClick={handleLocationPermissionRequest}
            >
              許可する
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 方位センサーの許可モーダル */}
      {permissionStep === 'heading' && (
        <div
          aria-labelledby="heading-modal-title"
          onKeyDown={(e) => { if (e.key === 'Escape') handleHeadingPermissionSkip(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '32px 28px 24px',
              maxWidth: 'min(380px, 88vw)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 12 }}><FaCompass size={32} color="#3b82f6" /></div>
            <h3 id="heading-modal-title" style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
              方位センサーの許可
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>
              向いている方向を地図に表示するために、方位センサーへのアクセスを許可してください。
            </p>
            <button
              type="button"
              className="modal-btn-primary"
              onClick={handleHeadingPermissionRequest}
              style={{ marginBottom: 12 }}
            >
              許可する
            </button>
            <button
              type="button"
              className="modal-btn-skip"
              onClick={handleHeadingPermissionSkip}
            >
              スキップ
            </button>
          </div>
        </div>
      )}

      {/* Step 3: エリア外モーダル */}
      {permissionStep === 'outside' && (
        <div
          aria-labelledby="outside-modal-title"
          onKeyDown={(e) => { if (e.key === 'Escape') handleOutsideDismiss(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '32px 28px 24px',
              maxWidth: 'min(380px, 88vw)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 12 }}><FaMapMarkerAlt size={32} color="#f59e0b" /></div>
            <h3 id="outside-modal-title" style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
              体験エリアの外にいます
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>
              小河内神社付近（奥多摩湖周辺）に近づくと、かつての村の姿を重ねて見ることができます。
            </p>
            <button
              type="button"
              className="modal-btn-primary"
              onClick={handleOutsideDismiss}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* UI（3D切替）。mapより前面。ボトムシート表示中はフェードアウト */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          opacity: sheetOpen ? 0 : 1,
          pointerEvents: sheetOpen ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        {(() => {
          // GPSが未取得、またはエリア外の場合は3Dモードを無効化
          const gps = sensorData.gps;
          const inArea = gps != null && sensorManager.locationService.isInOkutamaArea(gps);
          const disabled = !inArea;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="map-btn map-btn--pill"
                onClick={handleRequest3DWithPermission}
                disabled={disabled}
                aria-label="3Dビューへ"
                style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              >
                <PiCubeFocusFill size={26} />
                3Dモード
              </button>
              {disabled && (
                <span style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap',
                }}>
                  奥多摩湖の近くで試してみてね！
                </span>
              )}
            </div>
          );
        })()}
      </div>




      {/* 右下：ズームコントロール & 現在地ボタン */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          right: '16px',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '16px',
        }}
      >
        {/* ズームイン */}
        <button
          type="button"
          className="map-btn map-btn--round"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="ズームイン"
        >
          <FaPlus size={20} />
        </button>

        {/* ズームアウト */}
        <button
          type="button"
          className="map-btn map-btn--round"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="ズームアウト"
        >
          <FaMinus size={20} />
        </button>

        {/* 現在地へ戻るボタン（エリア内のみ表示） */}
        {sensorData.gps && !isOutsideArea && (
          <button
            type="button"
            className="map-btn map-btn--round"
            onClick={() => {
              if (sensorData.gps) {
                mapRef.current?.flyTo([sensorData.gps.latitude, sensorData.gps.longitude], 16, { duration: 1.0 });
              }
            }}
            style={{ color: '#3b82f6' }}
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
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          zIndex: 10000,
        }}
      >
        <button
          type="button"
          className="map-btn map-btn--round"
          aria-label="ピン一覧"
          onClick={openPinList}
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
