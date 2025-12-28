import { Environment, Sky, Text, Billboard, useProgress } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import React, { useState, useEffect, Suspense, useMemo } from 'react';
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
  worldToGpsCoordinate,
  calculateDistance,
} from '../../utils/coordinate-converter';
import type { Initial3DPosition } from '../map/OkutamaMap2D';
import { okutamaPins } from '../../data/okutama-pins';
import type { PinData, PinType } from '../../types/pins';
import PinListDrawer from '../ui/PinListDrawer';
import { FaMapSigns, FaCompass, FaEye, FaEyeSlash } from 'react-icons/fa';
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
  const handleSelectPin = propOnSelectPin ?? setLocalSelectedPin;
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

  const [isWireframe, setIsWireframe] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [waterLevelOffset, setWaterLevelOffset] = useState(0);
  const [cameraHeightOffset, setCameraHeightOffset] = useState(0);

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
    if (initialPosition) {
      // GPS座標を3D座標に変換
      const worldPos = gpsToWorldCoordinate({
        latitude: initialPosition.latitude,
        longitude: initialPosition.longitude,
        altitude: 0, // 標高は後で地形に合わせて調整
      });

      // カメラの高さを調整（デフォルト値、地形の高さに合わせて後で調整される）
      const cameraHeight = worldPos.y + 105.73;

      // 回転はDeviceOrientationControlsが自動的に制御するため、初期回転は設定しない
      return {
        position: [worldPos.x, cameraHeight, worldPos.z] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      };
    }

    // デフォルト位置
    return {
      position: [-63.43, 105.73, 1.65] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
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
          }}
          // キャンセル時は一旦キャリブレーション済みとする（元の画面に戻るため）
          // または、再調整ボタンから呼ばれた場合の分岐が必要だが、
          // シンプルにウィンドウを閉じる＝キャリブレーション完了（現状維持）とみなす
          onClose={() => setIsCalibrated(true)}
          initialOffset={manualHeadingOffset}
          orientation={sensorData.orientation}
          compassHeading={sensorData.compassHeading}
        />
      )}

      <Canvas
        style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'relative', zIndex: 1 }}
        camera={{
          position: initialCameraConfig.position,
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
          {/* PC用キーボード移動コントロール */}
          {!isMobile && <PCKeyboardControls />}
          {/* デバイス向きコントロール（モバイルのみ、かつ許可済み） */}
          {isMobile && permissionGranted && sensorData.orientation && (
            <OrientationCamera
              deviceOrientation={sensorData.orientation}
              arMode={true}
              manualHeadingOffset={manualHeadingOffset}
              baseHeadingOffset={initialPosition?.headingOffset ?? 0}
            />
          )}
          {/* FPSスタイルカメラコントロール（PCのみ） */}
          {!isMobile && <FPSCameraControls />}

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
          <Environment preset="sunset" background={false} />

          {/* 環境光を強化 */}
          <ambientLight intensity={0.6} color="#ffffff" />

          {/* 指向性ライト（太陽光）を追加 */}
          <directionalLight
            position={[1000, 100, 50]}
            intensity={1.0}
            color="#ffffff"
            castShadow={true}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />

          {/* 湖の3Dモデル - 地形と水面を独立して制御 */}
          {/* 地形の中心点を[0, 0, 0]に配置するため、positionをTERRAIN_SCALE_FACTORに応じて動的に計算 */}
          <LakeModel
            position={terrainPosition}
            scale={[1, 1, 1]} // 全体のスケール
            rotation={[0, 0, 0]}
            visible={true}
            showTerrain={true} // 地形を表示
            showWater={true} // 水面を表示
            wireframe={isWireframe}
            waterLevelOffset={waterLevelOffset}
            terrainScale={[
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
            ]} // 地形のスケール（TERRAIN_SCALE_FACTORで調整可能）
            waterScale={[
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
              TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR,
            ]} // 水面のスケール（地形と同じスケール）
            waterPosition={WATER_CENTER_OFFSET} // 水面の位置（WATER_CENTER_OFFSETで調整可能）
          />

          {/* 2Dマップ上のピン位置を3Dビューに表示 */}
          <PinMarkers3D selectedPin={selectedPin} />

          {/* 画角(FOV)を動的に更新するコンポーネント */}
          <FovAdjuster fov={fov} />

          {/* カメラコントロールは無効化（OrbitControls削除） */}
        </Suspense>
      </Canvas>

      {/* 左下：ピン一覧（アイコン） */}
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

      {/* デバッグボタン（左上） */}
      {isMobile && permissionGranted && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '12px',
            }}
          >
            {showDebug ? 'Debug OFF' : 'Debug ON'}
          </button>
        </div>
      )}

      {/* デバッグパネル */}
      {showDebug && sensorData.orientation && (
        <div
          style={{
            position: 'fixed',
            top: '50px',
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
          gap: '10px',
        }}
      >
        {/* キャリブレーション再実行ボタン */}
        {isMobile && permissionGranted && (
          <button
            type="button"
            onClick={() => setIsCalibrated(false)}
            style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              width: '40px',
              height: '40px',
              minHeight: '40px',
              padding: 0,
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
            }}
            title="方位を再調整"
          >
            <FaCompass size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsControlsVisible(!isControlsVisible)}
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            width: '40px',
            height: '40px',
            minHeight: '40px',
            padding: 0,
            borderRadius: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
          }}
          title={isControlsVisible ? 'コントロールを隠す' : 'コントロールを表示'}
        >
          {isControlsVisible ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
        </button>
      </div>

      {/* 手動補正 & FOVスライダーコンテナ */}
      {isMobile && permissionGranted && isControlsVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '150px', // ピンリストの上
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '400px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            padding: '16px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* 方位補正スライダーはキャリブレーション画面に移動したため削除 */}

          {/* 画角(FOV)スライダー */}

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
            <button
              type="button"
              onClick={() => setIsWireframe(!isWireframe)}
              style={{
                background: isWireframe ? '#2B6CB0' : 'rgba(255,255,255,0.2)',
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
              線画: {isWireframe ? 'ON' : 'OFF'}
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
      const cameraX = initialCameraConfig.position[0];
      const cameraZ = initialCameraConfig.position[2];
      const newY = baseTerrainHeightRef.current + CAMERA_HEIGHT_OFFSET + heightOffset;
      camera.position.set(cameraX, newY, cameraZ);
    }
  }, [heightOffset, initialCameraConfig.position, camera]);

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

    // 高速化: まず名前で検索（これが最も速い）
    // LakeModel側で 'Displacement.001' という名前のオブジェクトを扱っている
    let terrainMesh: THREE.Mesh | null = null;
    const knownTerrainName = 'Displacement.001';

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
        console.warn('Terrain not found, forcing camera position and ready state');
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

      console.warn('=== カメラ高さ調整（タイムアウト） ===');
      if (onReady) onReady();
    }
  });

  return null;
}

// FPSスタイルカメラコントロール
function FPSCameraControls() {
  const { camera } = useThree();
  const [isPointerLocked, setIsPointerLocked] = React.useState(false);
  const pitchRef = React.useRef(0);
  const yawRef = React.useRef(0);

  React.useEffect(() => {
    // URLパラメータからの初期位置設定
    camera.rotation.order = 'YXZ';
    camera.rotation.x = 0;
    camera.rotation.y = 0;
    camera.rotation.z = 0;

    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement !== null);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isPointerLocked) {
        const sensitivity = 0.002;
        const deltaX = event.movementX * sensitivity;
        const deltaY = event.movementY * sensitivity;

        yawRef.current -= deltaX;
        pitchRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchRef.current - deltaY));

        // カメラの回転を更新（Z軸回転は0に固定）
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawRef.current;
        camera.rotation.x = pitchRef.current;
        camera.rotation.z = 0;
      }
    };

    const handleClick = (event: MouseEvent) => {
      // UI要素（ボタンなど）がクリックされた場合はポインターロックをリクエストしない
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.closest('button') !== null ||
        target.closest('[role="button"]') !== null ||
        target.style.zIndex !== '' ||
        target.closest('[style*="z-index"]') !== null
      ) {
        return;
      }

      if (!isPointerLocked) {
        document.body.requestPointerLock();
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick);
    };
  }, [camera, isPointerLocked]);

  return null;
}

// PC用キーボード移動コントロール
function PCKeyboardControls() {
  const { camera } = useThree();
  React.useEffect(() => {
    const moveSpeed = 5;
    const dir = new THREE.Vector3();
    const right = new THREE.Vector3();

    const handleKey = (e: KeyboardEvent) => {
      let moved = false;
      switch (e.key) {
        // 前進・後退（カメラの向きに沿って移動）
        case 'w':
        case 'W':
          camera.getWorldDirection(dir).normalize();
          camera.position.addScaledVector(dir, moveSpeed);
          moved = true;
          break;
        case 's':
        case 'S':
          camera.getWorldDirection(dir).normalize();
          camera.position.addScaledVector(dir, -moveSpeed);
          moved = true;
          break;
        // 左右移動（カメラの右方向）
        case 'a':
        case 'A':
          camera.getWorldDirection(dir).normalize();
          right.set(dir.z, 0, -dir.x).normalize();
          camera.position.addScaledVector(right, -moveSpeed);
          moved = true;
          break;
        case 'd':
        case 'D':
          camera.getWorldDirection(dir).normalize();
          right.set(dir.z, 0, -dir.x).normalize();
          camera.position.addScaledVector(right, moveSpeed);
          moved = true;
          break;
        // 上下移動
        case 'q':
        case 'Q':
          camera.position.y += moveSpeed;
          moved = true;
          break;
        case 'e':
        case 'E':
          camera.position.y -= moveSpeed;
          moved = true;
          break;
        default:
          break;
      }
      if (moved) {
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [camera]);
  return null;
}

// devモード時: 2Dマップ上のピン位置を3Dビューに表示するコンポーネント
function PinMarkers3D({
  selectedPin,
}: {
  selectedPin?: PinData | null;
}) {
  const { scene } = useThree();
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

  // 各ピンの地形高さを計算して配置
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
          pinGpsPosition={pin.gps}
        />
      ))}
    </>
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
  pinGpsPosition,
}: {
  id: string;
  title: string;
  type: PinType;
  basePosition: [number, number, number];
  scene: THREE.Scene;
  isSelected?: boolean;
  pinGpsPosition?: { latitude: number; longitude: number };
}) {
  const [pinHeight, setPinHeight] = React.useState<number | null>(null);
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const frameCount = React.useRef(0);
  const groupRef = React.useRef<THREE.Group>(null);
  const lightBeamRef = React.useRef<THREE.Mesh>(null);
  const lightBeamIntensity = React.useRef(0.5);

  useFrame(() => {
    // 地形の高さを一度だけ計算
    if (pinHeight !== null) return;

    frameCount.current += 1;
    const [pinX, , pinZ] = basePosition;

    // シーン内の地形オブジェクトを検索
    let terrainMesh: THREE.Mesh | null = null;

    // スケールに応じてサイズ判定を調整
    const baseSizeLimit = 100;
    const maxSizeLimit = 10000;
    const maxHeightLimit = 1000;
    const scaledMaxHeightLimit = maxHeightLimit * TERRAIN_SCALE_FACTOR * 2; // スケールに応じて調整（余裕を持たせる）

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        const meshName = child.name || '(無名)';

        // 地形のMeshを探す（名前で判定、または適切なサイズのMesh）
        if (!terrainMesh) {
          if (meshName === 'Displacement.001' || meshName === 'Displacement') {
            terrainMesh = child;
          } else if (
            size.x > baseSizeLimit &&
            size.z > baseSizeLimit &&
            size.x < maxSizeLimit * TERRAIN_SCALE_FACTOR &&
            size.z < maxSizeLimit * TERRAIN_SCALE_FACTOR &&
            size.y < scaledMaxHeightLimit
          ) {
            // スケールに応じてサイズ制限を調整
            terrainMesh = child;
          }
        }
      }
    });

    if (terrainMesh) {
      const mesh = terrainMesh as THREE.Mesh;
      const terrainBox = new THREE.Box3().setFromObject(mesh);

      // 高い位置から下方向にレイを飛ばして地形との交差を計算
      // 地形のバウンディングボックスの最大Y座標を取得し、その上からレイを飛ばす
      // スケールに応じてオフセットを調整
      const terrainMaxY = terrainBox.max.y;
      const rayStartY = terrainMaxY + 1000 * TERRAIN_SCALE_FACTOR; // スケールに応じてレイの開始位置を調整
      const rayStart = new THREE.Vector3(pinX, rayStartY, pinZ);
      const rayDirection = new THREE.Vector3(0, -1, 0);

      raycaster.set(rayStart, rayDirection);
      let intersects = raycaster.intersectObject(mesh, false);

      // 交差が見つからない場合、子要素を再帰的に検索
      if (intersects.length === 0 && mesh.children.length > 0) {
        const childMeshes: THREE.Mesh[] = [];
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            childMeshes.push(child);
          }
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
        const finalHeight = terrainHeight + PIN_HEIGHT_OFFSET;
        setPinHeight(finalHeight);
      } else if (frameCount.current >= 100) {
        // タイムアウト: デフォルトの高さを使用
        setPinHeight(basePosition[1] + PIN_HEIGHT_OFFSET);
      }
    } else if (frameCount.current >= 100) {
      // 地形が見つからない場合: デフォルトの高さを使用
      setPinHeight(basePosition[1] + PIN_HEIGHT_OFFSET);
    }
  });

  // 光の柱のアニメーション
  useFrame((state) => {
    if (isSelected && lightBeamRef.current) {
      // 光の強度をアニメーション（sin波で脈動）
      const time = state.clock.elapsedTime;
      lightBeamIntensity.current = 0.5 + Math.sin(time * 2) * 0.3;

      const material = lightBeamRef.current.material as THREE.MeshStandardMaterial;
      if (material) {
        material.emissiveIntensity = lightBeamIntensity.current;
        material.opacity = 0.3 + Math.sin(time * 2) * 0.2;
      }
    }
  });

  // カメラとの距離を計算して表示・非表示を切り替え（50m未満は非表示）
  useFrame(({ camera }) => {
    if (groupRef.current && pinHeight !== null) {
      // 3D空間上の位置を基準に距離を計算
      const pinPosition = new THREE.Vector3(basePosition[0], pinHeight, basePosition[2]);
      // 二乗距離で判定（1m = 1m^2）
      // ユーザー要望により 200m (200 * 200) 以内は非表示に変更
      const distSq = camera.position.distanceToSquared(pinPosition);
      groupRef.current.visible = distSq >= 40000;
    }
  });

  // 高さが計算されるまで表示しない
  if (pinHeight === null) {
    return null;
  }

  // カメラとの距離を計算するコンポーネント（GPS座標ベース）
  const DistanceLabel = () => {
    const { camera } = useThree();
    const [distance, setDistance] = React.useState<number | null>(null);

    useFrame(() => {
      if (!pinGpsPosition) return;

      // カメラのワールド座標を取得
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);

      // カメラの3D座標をGPS座標に変換
      const cameraGps = worldToGpsCoordinate(
        { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z },
        SCENE_CENTER
      );

      // GPS座標ベースで距離を計算（Haversine公式）
      const dist = calculateDistance(cameraGps, pinGpsPosition);
      setDistance(dist);
    });

    let labelText = title;
    if (distance !== null && pinGpsPosition) {
      const distanceKm = distance / 1000;
      // 1km未満はm単位、1km以上はkm単位で表示
      const distanceText =
        distanceKm < 1 ? `${Math.round(distance)}m` : `${distanceKm.toFixed(1)}km`;
      labelText = `${title}\n${distanceText}`;
    }

    return (
      <Text
        position={[50, 100, 0]}
        fontSize={40}
        color="white"
        anchorX="left"
        anchorY="middle"
        outlineWidth={2}
        outlineColor="black"
      >
        {labelText}
      </Text>
    );
  };

  return (
    <group ref={groupRef} key={id} position={[basePosition[0], pinHeight, basePosition[2]]}>
      {/* 選択時: 光の柱（三角錐） */}
      {isSelected && (
        <mesh ref={lightBeamRef} position={[0, 250, 0]}>
          <coneGeometry args={[15, 1000, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#3b82f6"
            emissiveIntensity={0.5}
            transparent={true}
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* マーカー（選択時は位置を上げる） */}
      <mesh position={[0, isSelected ? 20 : 0, 0]}>
        {/* デバッグピンは小さく表示 */}
        <sphereGeometry args={[type === 'debug' ? 10 : 30, 16, 16]} />
        <meshStandardMaterial
          color={type === 'debug' ? '#333333' : '#ef4444'}
          emissive={type === 'debug' ? '#000000' : '#ef4444'}
          emissiveIntensity={isSelected ? 0.8 : 0.5}
        />
      </mesh>
      {/* ラベル（テキスト） - 常にカメラを向く (デバッグピン以外) */}
      {type !== 'debug' && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <DistanceLabel />
        </Billboard>
      )}
    </group>
  );
}
