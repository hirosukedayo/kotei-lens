import { Environment, Sky, Text, Billboard, useProgress, OrbitControls } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import type { WebGLSupport } from '../../utils/webgl-detector';
import {
  detectWebGLSupport,
  getRecommendedRenderer,
  getRendererConfig,
} from '../../utils/webgl-detector';
import LakeModel from '../3d/LakeModel';
import {
  gpsToWorldCoordinate,
  SCENE_CENTER,
} from '../../utils/coordinate-converter';
import type { Initial3DPosition } from '../map/OkutamaMap2D';
import { okutamaPins } from '../../data/okutama-pins';
import { type PinData, type PinType, pinTypeStyles } from '../../types/pins';
import PinListDrawer from '../ui/PinListDrawer';
import { FaMapSigns, FaCompass, FaEye, FaSlidersH, FaMountain } from 'react-icons/fa';
import {
  TERRAIN_SCALE_FACTOR,
  TERRAIN_CENTER_OFFSET,
  WATER_CENTER_OFFSET,
  TERRAIN_BASE_SCALE,
  TERRAIN_ORIGINAL_CENTER,
  CAMERA_HEIGHT_OFFSET,
  PIN_HEIGHT_OFFSET,
  DEFAULT_FOV,
} from '../../config/terrain-config';
import OrientationCamera from '../ar/OrientationCamera';
import ARBackground from '../ar/ARBackground';
import { useSensors } from '../../hooks/useSensors';
import SensorPermissionRequest from '../ui/SensorPermissionRequest';
import { getSensorManager } from '../../services/sensors/SensorManager';
import LoadingScreen from '../ui/LoadingScreen';
import CompassCalibration from '../ui/CompassCalibration';
import { trackPinSelect } from '../../utils/analytics';

// 日本語対応フォント（Noto Sans JP Regular）
const JAPANESE_FONT_URL =
  'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf';

interface Scene3DProps {
  initialPosition?: Initial3DPosition | null;
  selectedPin?: PinData | null;
  onSelectPin?: (pin: PinData) => void;
  onDeselectPin?: () => void;
}

// 地形の位置補正値を計算（スケール適用後の中心を原点に配置するため）
// position = -terrainCenterScaled + offset = -(terrainOriginalCenter * scale) + offset
// 地形の位置補正値を計算（スケール適用後の中心を原点に配置するため）
// position = -terrainCenterScaled + offset = -(terrainOriginalCenter * scale) + offset
// メモ化されていないと毎回新しい配列を返してしまい、LakeModelの再レンダリングを引き起こす
const useTerrainPosition = (): [number, number, number] => {
  return useMemo(() => {
    const scale = TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR;
    const terrainCenterScaled = {
      x: TERRAIN_ORIGINAL_CENTER.x * scale,
      y: TERRAIN_ORIGINAL_CENTER.y * scale,
      z: TERRAIN_ORIGINAL_CENTER.z * scale,
    };
    return [
      -terrainCenterScaled.x + TERRAIN_CENTER_OFFSET[0],
      -terrainCenterScaled.y + TERRAIN_CENTER_OFFSET[1],
      -terrainCenterScaled.z + TERRAIN_CENTER_OFFSET[2],
    ];
  }, []);
};

// 3Dシーンコンポーネント
export default function Scene3D({
  initialPosition,
  selectedPin: propSelectedPin,
  onSelectPin: propOnSelectPin,
  onDeselectPin: propOnDeselectPin,
}: Scene3DProps) {
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [localSelectedPin, setLocalSelectedPin] = useState<PinData | null>(null);
  const selectedPin = propSelectedPin ?? localSelectedPin;
  const baseSelectPin = propOnSelectPin ?? setLocalSelectedPin;
  const handleSelectPin = useCallback((pin: PinData) => {
    baseSelectPin(pin);
    trackPinSelect(pin.id, pin.title, pin.type, '3d');
  }, [baseSelectPin]);
  // 3Dラベルからの選択: ドロワーを先に開いてからピンを選択（画像表示のタイミング問題を回避）
  const handleSelectPinFrom3D = useCallback((pin: PinData) => {
    setSheetOpen(true);
    requestAnimationFrame(() => {
      handleSelectPin(pin);
    });
  }, [handleSelectPin]);
  const handleDeselectPin = propOnDeselectPin ?? (() => setLocalSelectedPin(null));
  const [webglSupport, setWebglSupport] = useState<WebGLSupport | null>(null);
  const [renderer, setRenderer] = useState<string>('webgl2');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // センサーフックの使用
  const { sensorData, startSensors } = useSensors();
  const terrainPosition = useTerrainPosition();
  const [manualHeadingOffset, setManualHeadingOffset] = useState(0);
  const [fov, setFov] = useState(DEFAULT_FOV);
  const [showDebug, setShowDebug] = useState(false);
  const [isArBackgroundActive, setIsArBackgroundActive] = useState(true);
  // 初期位置決定後かつ権限許可後にキャリブレーションを行う
  const [isCalibrated, setIsCalibrated] = useState(false);
  // 3Dビュー内から再調整する場合のフラグ（手動モードで直接開始）
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  const [isControlsVisible] = useState(false); // デフォルトで非表示
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [waterLevelOffset, setWaterLevelOffset] = useState(0);
  const [cameraHeightOffset, setCameraHeightOffset] = useState(0);
  // 地形モデル調整
  const [terrainOffsetX, setTerrainOffsetX] = useState(0);
  const [terrainOffsetZ, setTerrainOffsetZ] = useState(0);
  const [terrainScaleOffset, setTerrainScaleOffset] = useState(0); // -50〜+50 の%オフセット

  // FBXオブジェクト表示切り替え用State
  const [fbxObjectNames, setFbxObjectNames] = useState<string[]>([]);
  const [fbxHiddenObjects, setFbxHiddenObjects] = useState<Set<string>>(new Set());
  const stableFbxHiddenObjects = useMemo(() => fbxHiddenObjects, [fbxHiddenObjects]);

  const handleFbxObjectsLoaded = useCallback((names: string[]) => {
    setFbxObjectNames(names);
  }, []);

  // Cube系をグループ化した表示用リスト
  const fbxDisplayGroups = useMemo(() => {
    const cubeNames = fbxObjectNames.filter(n => n.startsWith('Cube'));
    const otherNames = fbxObjectNames.filter(n => !n.startsWith('Cube'));
    const groups: { label: string; names: string[] }[] = otherNames.map(n => ({ label: n, names: [n] }));
    if (cubeNames.length > 0) {
      groups.push({ label: `Cube (${cubeNames.length}個)`, names: cubeNames });
    }
    return groups;
  }, [fbxObjectNames]);

  const toggleFbxGroup = useCallback((names: string[]) => {
    setFbxHiddenObjects(prev => {
      const next = new Set(prev);
      const allHidden = names.every(n => next.has(n));
      for (const name of names) {
        if (allHidden) {
          next.delete(name);
        } else {
          next.add(name);
        }
      }
      return next;
    });
  }, []);

  // UIドラッグ移動用State
  const [uiPosition, setUiPosition] = useState({ x: 20, y: 80 }); // 初期位置 (左上)
  const [isDraggingUi, setIsDraggingUi] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const handleUiDragStart = (e: React.MouseEvent) => {
    setIsDraggingUi(true);
    dragOffsetRef.current = {
      x: e.clientX - uiPosition.x,
      y: e.clientY - uiPosition.y
    };
  };

  useEffect(() => {
    const handleUiDragMove = (e: MouseEvent) => {
      if (isDraggingUi) {
        setUiPosition({
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y
        });
      }
    };

    const handleUiDragEnd = () => {
      setIsDraggingUi(false);
    };

    if (isDraggingUi) {
      window.addEventListener('mousemove', handleUiDragMove);
      window.addEventListener('mouseup', handleUiDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleUiDragMove);
      window.removeEventListener('mouseup', handleUiDragEnd);
    };
  }, [isDraggingUi]);

  // 描画準備完了フラグ
  const [isReady, setIsReady] = useState(false);


  // Failsafe: progressが100%になってもisReadyにならない場合の強制解除
  // CameraPositionSetterが失敗している可能性があるため
  const { progress: loadProgress } = useProgress();

  useEffect(() => {
    if (loadProgress === 100 && !isReady) {
      const timer = setTimeout(() => {
        console.warn('Force setting isReady to true due to timeout');
        setIsReady(true);
      }, 5000); // 5秒後に強制解除
      return () => clearTimeout(timer);
    }
  }, [loadProgress, isReady]);
  useEffect(() => {
    // PCの場合はキャリブレーション不要
    if (!isMobile) {
      setIsCalibrated(true);
    }
  }, [isMobile]);

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });
    // モバイル判定
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsMobile(isMobileDevice);

      // PCの場合は常に権限ありとする
      if (!isMobileDevice) {
        setPermissionGranted(true);
      } else {
        // モバイルの場合、既にキャッシュされているか確認
        // OkutamaMap2Dからの遷移なら cache: 'granted' のはず
        // ただしiOSではコンポーネントマウント時に再度ユーザー操作なしで requestPermission すると失敗する可能性があるため
        // startSensors() 内で OrientationService がキャッシュを見てスキップする仕組みが重要
        const manager = getSensorManager();
        const orientationState = manager.orientationService.getPermissionState?.();

        if (orientationState === 'granted') {
          setPermissionGranted(true);
        }
      }
    };
    checkMobile();

    // センサー開始
    const initSensors = async () => {
      try {
        await startSensors();

        // startSensorsが成功したということは権限OK
        if (isMobile) {
          const manager = getSensorManager();
          const p = manager.orientationService.getPermissionState?.();
          if (p === 'granted') {
            setPermissionGranted(true);
          }
        }
      } catch (e) {
        console.warn('Auto-start sensors failed (expected if verification needed):', e);
        // ここでエラーになっても、未許可フラグのままならモーダルが出るのでOK
      }
    };

    initSensors();

    return () => {
      // クリーンアップはuseSensors内で自動で行われるが、明示的に止める必要があれば記述
    };
  }, [isMobile, startSensors]); // 初回のみ + 依存配列
  // デバイス向き許可のハンドラ
  const handleDeviceOrientationPermission = async () => {
    try {
      await startSensors();
      setPermissionGranted(true);
    } catch (error) {
      console.error('センサー開始エラー:', error);
    }
  };

  // 初期位置と方位からカメラの初期位置と回転を計算
  const initialCameraConfig = useMemo(() => {
    // 通常モード: ユーザー位置（または初期位置）にカメラを配置
    // 初期位置が指定されていればそれを使用、なければシーン中心（奥多摩駅など）

    // シーン中心 (gpsToWorldCoordinateの第2引数と同じ)
    const center = SCENE_CENTER;

    // ふれあい館のピンを探す（デフォルト用）
    // ID: fureaikant-miharashidai (ふれあい館前の見晴台)
    const fureaiPin = okutamaPins.find(p => p.id === 'fureaikant-miharashidai') || okutamaPins[0];

    // 初期位置 (GPS) - useLocationなどから渡される想定
    // 指定がない場合はふれあい館付近を使用
    const startGps = initialPosition || {
      latitude: fureaiPin.coordinates[0],
      longitude: fureaiPin.coordinates[1],
      altitude: 0
    };

    // ワールド座標に変換
    const worldPos = gpsToWorldCoordinate(
      {
        latitude: startGps.latitude,
        longitude: startGps.longitude,
        altitude: 0
      },
      center
    );

    // デフォルトの高さ (地形データロード前なので仮決定、後でCameraPositionSetterが地形に合わせて調整)
    // 地形が見つからない場合のフォールバックとしても機能
    // ユーザー要望により -350 に設定
    const initialY = -350;

    return {
      position: [worldPos.x, initialY, worldPos.z] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number], // 南向き (180度回転)
    };
  }, [initialPosition]);

  if (!webglSupport) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#2B6CB0',
          color: 'white',
          fontSize: '18px',
        }}
      >
        3D環境を初期化中...
      </div>
    );
  }

  if (renderer === 'none') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F44336',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2>WebGL未対応</h2>
        <p>お使いのブラウザまたはデバイスは3D表示に対応していません。</p>
        <p>Chrome、Firefox、Safari等の最新ブラウザでお試しください。</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', backgroundColor: 'transparent' }}>
      {/* AR背景: 権限許可後のみ表示して、重複許可要求（ブラウザダイアログ）を防ぐ */}
      {isArBackgroundActive && isMobile && permissionGranted && <ARBackground active={true} />}

      {/* ローディング画面 */}
      <LoadingScreen isReady={isReady} />

      {/* 方位キャリブレーション画面 */}
      {isMobile && permissionGranted && !isCalibrated && isReady && (
        <CompassCalibration
          onCalibrationComplete={(offset) => {
            setManualHeadingOffset(offset);
            setIsCalibrated(true);
            setIsRecalibrating(false);
          }}
          // キャンセル時は一旦キャリブレーション済みとする（元の画面に戻るため）
          onClose={() => {
            setIsCalibrated(true);
            setIsRecalibrating(false);
          }}
          initialOffset={manualHeadingOffset}
          orientation={sensorData.orientation}
          compassHeading={sensorData.compassHeading}
          startInManualMode={isRecalibrating}
          onOffsetChange={isRecalibrating ? (offset) => setManualHeadingOffset(offset) : undefined}
        />
      )}

      <Canvas
        onPointerMissed={() => {
          if (selectedPin) {
            setSheetOpen(false);
          }
        }}
        style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'relative', zIndex: 1 }}
        camera={{
          position: initialCameraConfig.position,
          rotation: initialCameraConfig.rotation, // 回転も適用
          fov: fov,
          near: 0.1,
          far: 50000000, // スカイボックスと同じ範囲まで見える
        }}
        gl={{ ...getRendererConfig(renderer), alpha: true }}
      >
        <Suspense fallback={null}>
          {/* カメラの初期位置を明示的に設定（動的高さ調整対応） */}
          {/* ローディング完了まで位置設定を行わないように制御可能だが、CameraPositionSetter内部でメッシュ検出を行っているので */}
          {/* 基本的にはそのままで良いが、念のため遅延させるフラグを渡すことも検討 */}
          <CameraPositionSetter
            initialCameraConfig={initialCameraConfig}
            heightOffset={cameraHeightOffset}
            onReady={() => {
              // 少し遅延させてからReadyにする（描画安定待ち）
              setTimeout(() => setIsReady(true), 500);
            }}
          />
          {/* PC用キーボード移動コントロール（OrbitControls使用時は無効） */}
          {/* {!isMobile && <PCKeyboardControls />} */}

          {/* デバイス向きコントロール（モバイルのみ、かつ許可済み） */}
          {isMobile && permissionGranted && sensorData.orientation && (
            <OrientationCamera
              deviceOrientation={sensorData.orientation}
              arMode={true}
              manualHeadingOffset={manualHeadingOffset}
              baseHeadingOffset={initialPosition?.headingOffset ?? 0}
            />
          )}

          {/* OrbitControls（PCのみ）: マウスドラッグで回転、ホイールでズーム、右クリックでパン */}
          {!isMobile && (
            <OrbitControls
              makeDefault
              target={[0, 0, 0]}
              enableDamping={true}
              dampingFactor={0.1}
            />
          )}

          {/* React Three Fiber標準のSkyコンポーネント - 広範囲のスカイボックス */}
          {(!isArBackgroundActive || !isMobile) && (
            <Sky
              distance={50000} // 広範囲のスカイボックス（50km）
              sunPosition={[100, 50, 100]} // 太陽位置を調整
              inclination={0.49} // 太陽の高さを調整
              azimuth={0.25} // 太陽の方位角
            />
          )}

          {/* ARモード時は背景を確実に透明にする */}
          {isArBackgroundActive && isMobile && <SceneBackgroundCleaner />}

          {/* 環境マップ（反射などに使用）- 背景には表示しない */}
          <Environment preset="city" background={false} />

          {/* 環境光 */}
          <ambientLight intensity={0.3} color="#ffffff" />

          {/* 距離フォグ */}
          <fog attach="fog" args={['#c8ddf0', 500, 10000]} />

          {/* 太陽光（Skyの太陽位置と方向を揃える） */}
          <directionalLight
            position={[500, 800, 500]}
            intensity={1.5}
            color="#fff5e6"
          />

          {/* 湖の3Dモデル - 地形と水面を独立して制御 */}
          {/* 地形の中心点を[0, 0, 0]に配置するため、positionをTERRAIN_SCALE_FACTORに応じて動的に計算 */}
          <LakeModel
            position={[
              terrainPosition[0] + terrainOffsetX,
              terrainPosition[1],
              terrainPosition[2] + terrainOffsetZ,
            ]}
            scale={[1, 1, 1]}
            rotation={[0, 0, 0]}
            visible={true}
            waterLevelOffset={waterLevelOffset}
            terrainScale={(() => {
              const s = TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR * (1 + terrainScaleOffset / 100);
              return [s, s, s] as [number, number, number];
            })()}
            waterPosition={WATER_CENTER_OFFSET}
            hiddenObjects={stableFbxHiddenObjects}
            onObjectsLoaded={handleFbxObjectsLoaded}
          />

          {/* 2Dマップ上のピン位置を3Dビューに表示 */}
          <PinMarkers3D selectedPin={selectedPin} onSelectPin={handleSelectPinFrom3D} />

          {/* 画角(FOV)を動的に更新するコンポーネント */}
          <FovAdjuster fov={fov} />



          {/* マウス操作用カメラコントロール (削除済み) */}
        </Suspense>
      </Canvas>

      {/* 左下：ピン一覧（アイコン） - コントロール表示時のみ表示 */}
      {/* 左下：ピン一覧（アイコン） - 常に表示 */}
      <div
        style={{
          position: 'fixed',
          left: '16px',
          bottom: '80px',
          zIndex: 10000,
        }}
      >
        <button
          type="button"
          aria-label="ピン一覧"
          onClick={() => setSheetOpen(true)}
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
        onOpenChange={setSheetOpen}
        selectedPin={selectedPin}
        onSelectPin={handleSelectPin}
        onDeselectPin={handleDeselectPin}
      />

      {/* デバイス向き許可ボタン（モバイルのみ）- 統一UIに置換 */}
      {isMobile && !permissionGranted && (
        <SensorPermissionRequest
          onPermissionsGranted={() => {
            handleDeviceOrientationPermission();
          }}
          onPermissionsDenied={(errors: string[]) => {
            console.error('Permissions denied:', errors);
            // 拒否された場合でも一応表示は維持するか、あるいは警告を出す
          }}
        />
      )}

      {/* 左上：コントロール表示ボタン（機能を集約）- PCでも表示 (一時的に非表示) */}
      {/* <div
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 1000,
        }}
      >
        <button
          type="button"
          onClick={() => setIsControlsVisible(!isControlsVisible)}
          style={{
            background: isControlsVisible ? '#3b82f6' : 'rgba(0,0,0,0.5)',
            color: 'white',
            border: isControlsVisible ? '1px solid #60a5fa' : 'none',
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '12px',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {isControlsVisible ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
          <span style={{ fontWeight: 'bold' }}>{isControlsVisible ? '非表示' : '設定・調整'}</span>
        </button>
      </div> */}

      {/* 手動補正 & ワイヤーフレーム位置調整コンテナ */}
      {isControlsVisible && (
        <div
          style={{
            position: 'fixed',
            top: uiPosition.y,
            left: uiPosition.x,
            // bottom: '150px', // ピンリストの上 -> 削除
            // left: '50%', // -> 削除
            // transform: 'translateX(-50%)', // -> 削除
            width: '90%',
            maxWidth: '500px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'rgba(0,0,0,0.8)', // 少し濃くする
            backdropFilter: 'blur(12px)',
            padding: '20px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {/* Debug Info Toggle in Panel */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              style={{
                background: showDebug ? '#48bb78' : 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              デバッグ情報: {showDebug ? 'ON' : 'OFF'}
            </button>
          </div>

          <h3
            onMouseDown={handleUiDragStart}
            style={{
              color: 'white',
              margin: '0 0 10px 0',
              fontSize: '14px',
              borderBottom: '1px solid #555',
              paddingBottom: '5px',
              cursor: isDraggingUi ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            カメラ調整 (ドラッグ移動可)
          </h3>

          {/* 画角(FOV)スライダー */}
          <div style={{ width: '100%' }}>
            <div
              style={{
                color: 'white',
                fontSize: '12px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaEye /> 画角 (FOV): {fov}°
              </div>
              <button
                type="button"
                onClick={() => setFov(DEFAULT_FOV)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              value={fov}
              onChange={(e) => setFov(Number(e.target.value))}
              style={{ width: '100%', height: '4px' }}
            />
          </div>

          {/* 水面高度調整スライダー */}
          <div style={{ width: '100%' }}>
            <div
              style={{
                color: 'white',
                fontSize: '12px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaEye style={{ transform: 'rotate(180deg)', color: '#3182ce' }} /> 水面高度: {waterLevelOffset > 0 ? `+${waterLevelOffset}` : waterLevelOffset}m
              </div>
              <button
                type="button"
                onClick={() => setWaterLevelOffset(0)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min="-10"
              max="20"
              step="0.5"
              value={waterLevelOffset}
              onChange={(e) => setWaterLevelOffset(Number(e.target.value))}
              style={{ width: '100%', height: '4px', accentColor: '#3182ce' }}
            />
          </div>

          {/* AR背景トグル & ワイヤーフレーム */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsArBackgroundActive(!isArBackgroundActive)}
              style={{
                background: isArBackgroundActive ? '#2B6CB0' : 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: '11px',
                padding: '6px 12px',
                borderRadius: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flex: 1,
                maxWidth: '120px',
              }}
            >
              AR背景: {isArBackgroundActive ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* カメラ高度調整スライダー */}
          <div style={{ width: '100%' }}>
            <div
              style={{
                color: 'white',
                fontSize: '12px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FaEye style={{ transform: 'rotate(90deg)', color: '#48bb78' }} /> カメラ高度: {cameraHeightOffset > 0 ? `+${cameraHeightOffset}` : cameraHeightOffset}m
              </div>
              <button
                type="button"
                onClick={() => setCameraHeightOffset(0)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min="-5"
              max="20"
              step="0.5"
              value={cameraHeightOffset}
              onChange={(e) => setCameraHeightOffset(Number(e.target.value))}
              style={{ width: '100%', height: '4px', accentColor: '#48bb78' }}
            />
          </div>
        </div>
      )}

      {/* デバッグパネル (表示条件を追加：コントロールが表示されている時、またはDebugがONの時？ -> 集約するならコントロール表示時のみにするか、あるいはオーバーレイは独立させるか) */}
      {/* ユーザーの意図は「ボタンを一つにする」なので、オーバーレイ自体の表示は独立していてもいいが、切り替えスイッチはパネル内に入れる */}
      {showDebug && sensorData.orientation && (
        <div
          style={{
            position: 'fixed',
            top: '60px', // ボタンの下
            left: '16px',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff00',
            padding: '10px',
            borderRadius: '5px',
            fontSize: '10px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          <div>Alpha: {sensorData.orientation.alpha?.toFixed(2)}</div>
          <div>Beta: {sensorData.orientation.beta?.toFixed(2)}</div>
          <div>Gamma: {sensorData.orientation.gamma?.toFixed(2)}</div>
          <div>Heading: {sensorData.compassHeading?.toFixed(2) ?? 'N/A'}</div>
          <div>Offset: {manualHeadingOffset.toFixed(0)}</div>
          <div>Abs: {sensorData.orientation.absolute ? 'Yes' : 'No'}</div>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          bottom: '80px', // 右下に配置（左下のピン一覧と高さを合わせる）
          right: '16px',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
        }}
      >
        {/* カメラ調整パネル（ポップアップ） */}
        {showCameraControls && (
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '16px',
              padding: '16px',
              width: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {/* 画角(FOV) */}
            <div>
              <div style={{ color: 'white', fontSize: '11px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FaEye size={12} /> 画角: {fov}°
                </div>
                <button
                  type="button"
                  onClick={() => setFov(DEFAULT_FOV)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  リセット
                </button>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: '#60a5fa' }}
              />
            </div>

            {/* カメラ高さ */}
            <div>
              <div style={{ color: 'white', fontSize: '11px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FaEye size={12} style={{ transform: 'rotate(90deg)' }} /> 高さ: {cameraHeightOffset > 0 ? `+${cameraHeightOffset}` : cameraHeightOffset}m
                </div>
                <button
                  type="button"
                  onClick={() => setCameraHeightOffset(0)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  リセット
                </button>
              </div>
              <input
                type="range"
                min="-500"
                max="500"
                step="1"
                value={cameraHeightOffset}
                onChange={(e) => setCameraHeightOffset(Number(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: '#48bb78' }}
              />
            </div>

            {/* 地形モデル調整 */}
            <div>
              <div style={{ color: 'white', fontSize: '11px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FaMountain size={12} /> 地形調整
                </div>
                <button
                  type="button"
                  onClick={() => { setTerrainOffsetX(0); setTerrainOffsetZ(0); setTerrainScaleOffset(0); }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  リセット
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', marginBottom: '2px' }}>
                    X: {terrainOffsetX > 0 ? `+${terrainOffsetX}` : terrainOffsetX}
                  </div>
                  <input type="range" min="-200" max="200" step="1" value={terrainOffsetX}
                    onChange={(e) => setTerrainOffsetX(Number(e.target.value))}
                    style={{ width: '100%', height: '4px', accentColor: '#f87171' }} />
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', marginBottom: '2px' }}>
                    Z: {terrainOffsetZ > 0 ? `+${terrainOffsetZ}` : terrainOffsetZ}
                  </div>
                  <input type="range" min="-200" max="200" step="1" value={terrainOffsetZ}
                    onChange={(e) => setTerrainOffsetZ(Number(e.target.value))}
                    style={{ width: '100%', height: '4px', accentColor: '#60a5fa' }} />
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', marginBottom: '2px' }}>
                    スケール: {terrainScaleOffset > 0 ? `+${terrainScaleOffset}` : terrainScaleOffset}%
                  </div>
                  <input type="range" min="-50" max="50" step="1" value={terrainScaleOffset}
                    onChange={(e) => setTerrainScaleOffset(Number(e.target.value))}
                    style={{ width: '100%', height: '4px', accentColor: '#c084fc' }} />
                </div>
              </div>
            </div>

            {/* FBXオブジェクト表示切り替え */}
            {fbxObjectNames.length > 0 && (
              <div>
                <div style={{ color: 'white', fontSize: '11px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FaMountain size={12} /> オブジェクト表示
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {fbxDisplayGroups.map((group) => {
                    const isHidden = group.names.every(n => fbxHiddenObjects.has(n));
                    return (
                      <button
                        key={group.label}
                        type="button"
                        onClick={() => toggleFbxGroup(group.names)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '10px',
                          cursor: 'pointer',
                          background: isHidden ? 'rgba(255,255,255,0.05)' : 'rgba(96,165,250,0.3)',
                          color: isHidden ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '8px' }}>{isHidden ? '○' : '●'}</span>
                        {group.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* カメラ調整ボタン */}
        <button
          type="button"
          onClick={() => setShowCameraControls(!showCameraControls)}
          style={{
            background: showCameraControls ? 'rgba(96,165,250,0.8)' : 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            minWidth: '60px',
            gap: '4px',
          }}
          title="カメラ調整"
        >
          <FaSlidersH size={20} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>カメラ</span>
        </button>

        {/* キャリブレーション再実行ボタン */}
        {isMobile && permissionGranted && (
          <button
            type="button"
            onClick={() => {
              setIsRecalibrating(true);
              setIsCalibrated(false);
            }}
            style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
              minWidth: '60px',
              gap: '4px',
            }}
            title="方位を再調整"
          >
            <FaCompass size={20} />
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>調整</span>
          </button>
        )}
      </div>


    </div>
  );
}

// シーンの背景をクリアするコンポーネント
function SceneBackgroundCleaner() {
  const { scene } = useThree();
  useEffect(() => {
    const originalBackground = scene.background;
    scene.background = null; // 背景を透明に
    return () => {
      scene.background = originalBackground;
    };
  }, [scene]);
  return null;
}

// 画角(FOV)を動的に更新するためのコンポーネント
function FovAdjuster({ fov }: { fov: number }) {
  const { camera } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);

  return null;
}

// カメラの初期位置を明示的に設定するコンポーネント
// 地形の高さに合わせてカメラの高さを調整
function CameraPositionSetter({
  initialCameraConfig,
  heightOffset = 0,
  onReady,
}: {
  initialCameraConfig: { position: [number, number, number]; rotation: [number, number, number] };
  heightOffset?: number;
  onReady?: () => void;
}) {
  const { camera, scene } = useThree();
  const hasSetPosition = React.useRef(false);
  const frameCount = React.useRef(0);
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const baseTerrainHeightRef = React.useRef<number | null>(null);

  // 高さオフセットが変更されたときにカメラ位置を更新
  useEffect(() => {
    if (baseTerrainHeightRef.current !== null) {
      const newY = baseTerrainHeightRef.current + CAMERA_HEIGHT_OFFSET + heightOffset;
      // X/Z は現在のカメラ位置を維持（初期位置に戻さない）
      camera.position.setY(newY);
    }
  }, [heightOffset, camera]);

  // 地形が読み込まれるまで待機してからカメラ位置を設定
  // useProgressフックを使用してロード状態を監視
  const { progress } = useProgress();

  useFrame(() => {
    // 位置が設定済みならスキップ
    if (hasSetPosition.current) return;

    // ロード完了チェック: progressが100%なら処理を開始する
    // activeはずっとtrueのままになるケースがあるため(texture decoding等)、
    // progressが100になったらフレームカウントを開始する
    if (progress < 100) return;

    frameCount.current += 1;

    // 負荷軽減: 30フレームに1回だけ処理を実行（約0.5秒ごと）
    // ただし、最初の数フレームは即座に実行して早期発見を試みる
    if (frameCount.current > 10 && frameCount.current % 30 !== 0) return;

    const cameraX = initialCameraConfig.position[0];
    const cameraZ = initialCameraConfig.position[2];
    let finalCameraY = initialCameraConfig.position[1]; // デフォルトの高さ

    // 調整モードなどで上空から俯瞰する場合（Y > 500）は地形判定をスキップしてその高さを維持する
    if (finalCameraY > 500) {
      baseTerrainHeightRef.current = finalCameraY - CAMERA_HEIGHT_OFFSET - heightOffset;
      camera.position.set(cameraX, finalCameraY, cameraZ);
      hasSetPosition.current = true;
      console.log('[Camera] 固定高さモード: カメラ高さ =', finalCameraY.toFixed(2), 'm');
      if (onReady) onReady();
      return;
    }

    // 高速化: まず名前で検索（これが最も速い）
    // LakeModel側で 'GroundModeling03_Scaling' という名前のオブジェクトを扱っている
    let terrainMesh: THREE.Mesh | null = null;
    const knownTerrainName = 'GroundModeling03_Scaling001';

    // シーンから直接取得を試みる
    const namedMesh = scene.getObjectByName(knownTerrainName);
    if (namedMesh && namedMesh instanceof THREE.Mesh) {
      terrainMesh = namedMesh;
    }

    // 名前で見つからない場合のみ、高負荷な全探索を行う（ただし頻度は低い）
    if (!terrainMesh) {
      // スケールに応じてサイズ判定を調整
      const baseSizeLimit = 100;
      const maxSizeLimit = 10000;
      const maxHeightLimit = 1000;
      const scaledMaxHeightLimit = maxHeightLimit * TERRAIN_SCALE_FACTOR * 2;

      // デバッグ: シーン内の全メッシュをリストアップ（初回のみ）
      if (frameCount.current <= 10) {
        const meshNames: string[] = [];
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshNames.push(child.name || '(unnamed)');
          }
        });
        console.log('[Camera] シーン内メッシュ一覧:', meshNames.join(', '));
      }

      scene.traverse((child) => {
        if (terrainMesh) return; // 既に見つかっていればスキップ

        // GroupやObject3Dではなく、実際のMeshを探す
        if (child instanceof THREE.Mesh && child.geometry) {
          // 名前チェック（バックアップ）
          if (child.name === 'Displacement' || child.name === knownTerrainName) {
            terrainMesh = child;
            return;
          }

          // バウンディングボックス計算は重いので、名前チェックで弾かれた場合のみ行う
          const box = new THREE.Box3().setFromObject(child);
          const size = box.getSize(new THREE.Vector3());

          if (
            size.x > baseSizeLimit &&
            size.z > baseSizeLimit &&
            size.x < maxSizeLimit * TERRAIN_SCALE_FACTOR &&
            size.z < maxSizeLimit * TERRAIN_SCALE_FACTOR &&
            size.y < scaledMaxHeightLimit
          ) {
            terrainMesh = child;
          }
        }
      });
    }

    if (terrainMesh) {
      const mesh = terrainMesh as THREE.Mesh;

      // 高い位置から下方向にレイを飛ばして地形との交差を計算
      // 地形のバウンディングボックスの最大Y座標を取得し、その上からレイを飛ばす
      const terrainBox = new THREE.Box3().setFromObject(mesh);
      const terrainMaxY = terrainBox.max.y;
      const rayStartY = terrainMaxY + 1000 * TERRAIN_SCALE_FACTOR;
      const rayStart = new THREE.Vector3(cameraX, rayStartY, cameraZ);
      const rayDirection = new THREE.Vector3(0, -1, 0);

      raycaster.set(rayStart, rayDirection);

      // 地形のMeshの実際のジオメトリと交差するように、再帰的検索を無効化
      let intersects = raycaster.intersectObject(mesh, false);

      // 交差が見つからない場合、子要素を再帰的に検索
      if (intersects.length === 0 && mesh.children.length > 0) {
        // 子要素のMeshに対してRaycasting
        const childMeshes: THREE.Mesh[] = [];
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) childMeshes.push(child);
        });

        for (const childMesh of childMeshes) {
          const childIntersects = raycaster.intersectObject(childMesh, false);
          if (childIntersects.length > 0) {
            intersects = childIntersects;
            break;
          }
        }
      }

      if (intersects.length > 0) {
        const firstIntersect = intersects[0];
        const terrainHeight = firstIntersect.point.y;
        baseTerrainHeightRef.current = terrainHeight;
        finalCameraY = terrainHeight + CAMERA_HEIGHT_OFFSET + heightOffset;

        camera.position.set(cameraX, finalCameraY, cameraZ);
        hasSetPosition.current = true;

        console.log('=== カメラ高さを地形に合わせて調整（成功） ===');
        console.log('地形の高さ:', terrainHeight.toFixed(2), 'm');
        console.log('調整後のカメラ高さ:', finalCameraY.toFixed(2), 'm');

        if (onReady) onReady();
        return;
      }
    } else {
      // 地形が見つからない場合のログ（頻度を下げる）
      if (frameCount.current % 60 === 0) {
        console.log('=== カメラ高さ調整（地形検索中） ===', frameCount.current);
      }

      // タイムアウト前でも、一定時間経過したら強制的にセットしてReadyにする
      // そうしないとローディングが終わらない
      if (frameCount.current > 150 && !hasSetPosition.current) {
        console.warn('[Camera] 地形未検出、強制配置: カメラ高さ =', (finalCameraY + 100).toFixed(2), 'm');
        camera.position.set(cameraX, finalCameraY + 100, cameraZ);
        hasSetPosition.current = true;
        if (onReady) onReady();
      }
    }

    // 最終タイムアウト処理
    const maxFrames = 300; // 5秒程度（60fps想定）→ 10秒程度に延長
    if (frameCount.current >= maxFrames) {
      camera.position.set(cameraX, finalCameraY, cameraZ);
      hasSetPosition.current = true;
      baseTerrainHeightRef.current = finalCameraY - CAMERA_HEIGHT_OFFSET - heightOffset;

      console.warn('[Camera] タイムアウト: カメラ高さ =', finalCameraY.toFixed(2), 'm');
      if (onReady) onReady();
    }
  });

  return null;
}

// FPSスタイルカメラコントロール（OrbitControls使用時は無効化）
// function FPSCameraControls() { ... }

// PC用キーボード移動コントロール（OrbitControls使用時は無効化）
// function PCKeyboardControls() { ... }

// 2Dマップ上のピン位置を3Dビューに表示するコンポーネント
function PinMarkers3D({
  selectedPin,
  onSelectPin,
}: {
  selectedPin?: PinData | null;
  onSelectPin?: (pin: PinData) => void;
}) {
  const { scene, camera } = useThree();
  const [visibleLabelIds, setVisibleLabelIds] = React.useState<Set<string>>(new Set());
  const pinHeightsRef = useRef<Map<string, number>>(new Map());

  const pinBasePositions = useMemo(() => {
    return okutamaPins.map((pin) => {
      const [latitude, longitude] = pin.coordinates;
      const worldPos = gpsToWorldCoordinate({ latitude, longitude, altitude: 0 }, SCENE_CENTER);
      return {
        id: pin.id,
        title: pin.title,
        type: pin.type,
        basePosition: [worldPos.x, worldPos.y, worldPos.z] as [number, number, number],
        gps: { latitude, longitude },
        worldPos,
      };
    });
  }, []);

  const handleHeightResolved = useCallback((pinId: string, height: number) => {
    pinHeightsRef.current.set(pinId, height);
  }, []);

  // ラベル重なり判定による複数ラベル表示（8フレームに1回）
  const frameCounter = React.useRef(0);
  const tmpVec3 = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    frameCounter.current += 1;
    if (frameCounter.current % 8 !== 0) return;

    const camPos = camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    // 1. 候補ピンを収集しスコア計算
    const candidates: { id: string; score: number; screenX: number; screenY: number }[] = [];

    for (const pin of pinBasePositions) {
      if (pin.type === 'debug') continue;

      const dx = pin.basePosition[0] - camPos.x;
      const dz = pin.basePosition[2] - camPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 100 || dist > 5000) continue;

      const toPin = new THREE.Vector3(dx, 0, dz).normalize();
      const dot = forward.dot(toPin);
      if (dot <= 0) continue;

      // ピンの実際の高さを取得（未解決ならbasePositionのYを使う）
      const pinY = pinHeightsRef.current.get(pin.id) ?? pin.basePosition[1];
      tmpVec3.set(pin.basePosition[0], pinY, pin.basePosition[2]);
      tmpVec3.project(camera);

      // NDC範囲外ならスキップ
      if (tmpVec3.x < -1.2 || tmpVec3.x > 1.2 || tmpVec3.y < -1.2 || tmpVec3.y > 1.2 || tmpVec3.z > 1) continue;

      const centerScore = dot;
      const distBonus = 0.2 * (1 - Math.min((dist - 100) / 4900, 1));
      const score = centerScore + distBonus;

      candidates.push({
        id: pin.id,
        score,
        screenX: tmpVec3.x,
        screenY: tmpVec3.y,
      });
    }

    // 2. スコア順にソート
    candidates.sort((a, b) => b.score - a.score);

    // 3. 貪欲法でラベル配置（AABB重なり判定）
    // ラベルのNDC空間でのおおよそサイズ
    const labelW = 0.15;
    const labelH = 0.06;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const newVisibleIds = new Set<string>();

    // 選択ピンは常に表示
    if (selectedPin) {
      const sel = candidates.find((c) => c.id === selectedPin.id);
      if (sel) {
        newVisibleIds.add(sel.id);
        placed.push({ x: sel.screenX, y: sel.screenY, w: labelW, h: labelH });
      }
    }

    for (const c of candidates) {
      if (newVisibleIds.has(c.id)) continue;

      // AABB重なり判定
      let overlaps = false;
      for (const p of placed) {
        if (
          Math.abs(c.screenX - p.x) < (labelW + p.w) * 0.5 &&
          Math.abs(c.screenY - p.y) < (labelH + p.h) * 0.5
        ) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        newVisibleIds.add(c.id);
        placed.push({ x: c.screenX, y: c.screenY, w: labelW, h: labelH });
      }
    }

    // Set内容が変わらない場合はsetStateをスキップ
    const prev = visibleLabelIds;
    if (newVisibleIds.size !== prev.size || [...newVisibleIds].some((id) => !prev.has(id))) {
      setVisibleLabelIds(newVisibleIds);
    }
  });

  return (
    <>
      {pinBasePositions.map((pin) => (
        <PinMarker
          key={pin.id}
          id={pin.id}
          title={pin.title}
          type={pin.type}
          basePosition={pin.basePosition}
          scene={scene}
          isSelected={selectedPin?.id === pin.id}
          showLabel={visibleLabelIds.has(pin.id) || selectedPin?.id === pin.id}
          onHeightResolved={handleHeightResolved}
          onSelect={onSelectPin}
        />
      ))}
    </>
  );
}

// 距離にかかわらず一定の見た目サイズで表示されるテキスト
function FixedSizeText({
  text,
  pinWorldPosition,
  isSelected = false,
  onClick,
}: {
  text: string;
  pinWorldPosition: [number, number, number];
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const groupRef = React.useRef<THREE.Group>(null);
  const { camera } = useThree();
  const baseDistance = 500;

  useFrame(() => {
    if (!groupRef.current) return;
    const pinPos = new THREE.Vector3(...pinWorldPosition);
    const dist = camera.position.distanceTo(pinPos);
    const s = dist / baseDistance;
    groupRef.current.scale.setScalar(s);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <Text
        font={JAPANESE_FONT_URL}
        fontSize={isSelected ? 14 : 10}
        color="rgba(255,255,255,0.75)"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={isSelected ? 0.8 : 0.3}
        outlineColor="rgba(0,0,0,0.5)"
        material-fog={false}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onClick?.();
        }}
      >
        {text}
      </Text>
    </group>
  );
}

// 個別のピンマーカーコンポーネント（地形の高さを計算）
function PinMarker({
  id,
  title,
  type,
  basePosition,
  scene,
  isSelected = false,
  showLabel = false,
  onHeightResolved,
  onSelect,
}: {
  id: string;
  title: string;
  type: PinType;
  basePosition: [number, number, number];
  scene: THREE.Scene;
  isSelected?: boolean;
  showLabel?: boolean;
  onHeightResolved?: (pinId: string, height: number) => void;
  onSelect?: (pin: PinData) => void;
}) {
  const [pinHeight, setPinHeight] = React.useState<number | null>(null);
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const frameCount = React.useRef(0);
  const groupRef = React.useRef<THREE.Group>(null);

  const pinColor = pinTypeStyles[type].color;

  const handleClick = useCallback(() => {
    if (!onSelect) return;
    const pinData = okutamaPins.find((p) => p.id === id);
    if (pinData) onSelect(pinData);
  }, [onSelect, id]);

  // 地形レイキャストでピンの高さを決定
  useFrame(() => {
    if (pinHeight !== null) return;

    frameCount.current += 1;
    if (frameCount.current > 10 && frameCount.current % 30 !== 0) return;

    const knownTerrainName = 'GroundModeling03_Scaling001';
    let terrainMesh: THREE.Mesh | null = null;
    const namedObj = scene.getObjectByName(knownTerrainName);
    if (namedObj && namedObj instanceof THREE.Mesh) {
      terrainMesh = namedObj;
    }

    if (!terrainMesh) {
      if (frameCount.current >= 300) {
        console.warn(`[PinMarker] ${id}: Terrain not found, using fallback height`);
        const fallback = -350;
        setPinHeight(fallback);
        onHeightResolved?.(id, fallback);
      }
      return;
    }

    const terrainBox = new THREE.Box3().setFromObject(terrainMesh);
    const rayStartY = terrainBox.max.y + 1000 * TERRAIN_SCALE_FACTOR;
    const rayStart = new THREE.Vector3(basePosition[0], rayStartY, basePosition[2]);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    raycaster.set(rayStart, rayDirection);

    let intersects = raycaster.intersectObject(terrainMesh, false);
    if (intersects.length === 0 && terrainMesh.children.length > 0) {
      const childMeshes: THREE.Mesh[] = [];
      terrainMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) childMeshes.push(child);
      });
      for (const childMesh of childMeshes) {
        const childIntersects = raycaster.intersectObject(childMesh, false);
        if (childIntersects.length > 0) {
          intersects = childIntersects;
          break;
        }
      }
    }

    if (intersects.length > 0) {
      const terrainHeight = intersects[0].point.y;
      const h = terrainHeight + PIN_HEIGHT_OFFSET;
      setPinHeight(h);
      onHeightResolved?.(id, h);
    } else if (frameCount.current >= 300) {
      console.warn(`[PinMarker] ${id}: Raycast missed terrain, using fallback height`);
      const fallback = -350;
      setPinHeight(fallback);
      onHeightResolved?.(id, fallback);
    }
  });

  // カメラとの距離を計算して表示・非表示を切り替え
  useFrame(({ camera }) => {
    if (groupRef.current && pinHeight !== null) {
      const pinPosition = new THREE.Vector3(basePosition[0], pinHeight, basePosition[2]);
      const distSq = camera.position.distanceToSquared(pinPosition);
      groupRef.current.visible = distSq >= 10000 && distSq < 25000000;
    }
  });

  if (pinHeight === null) {
    return null;
  }

  // ラベル高さ（ピン位置からのオフセット）
  const labelY = 150;

  const PinLabel = () => (
    <FixedSizeText
      text={title}
      pinWorldPosition={[basePosition[0], pinHeight, basePosition[2]]}
      isSelected={isSelected}
      onClick={handleClick}
    />
  );

  return (
    <group ref={groupRef} key={id} position={[basePosition[0], pinHeight, basePosition[2]]}>
      {/* デバッグピン: 小さな球体のみ */}
      {type === 'debug' && (
        <mesh>
          <sphereGeometry args={[3.3, 16, 16]} />
          <meshStandardMaterial
            color={pinColor}
            emissive={pinColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* 通常ピン: ラベル */}
      {type !== 'debug' && showLabel && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false} position={[0, labelY, 0]}>
          <PinLabel />
        </Billboard>
      )}
    </group>
  );
}
