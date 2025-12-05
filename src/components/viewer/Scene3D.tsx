import { Environment, Sky, DeviceOrientationControls, Text, Billboard } from '@react-three/drei';
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
  worldToGpsCoordinate,
  SCENE_CENTER,
} from '../../utils/coordinate-converter';
import type { Initial3DPosition } from '../map/OkutamaMap2D';
import { useDevModeStore } from '../../stores/devMode';
import { okutamaPins } from '../../data/okutama-pins';
import type { PinData } from '../../types/pins';
import PinListDrawer from '../ui/PinListDrawer';
import { FaMapSigns } from 'react-icons/fa';
import {
  TERRAIN_SCALE_FACTOR,
  TERRAIN_CENTER_OFFSET,
  WATER_CENTER_OFFSET,
  TERRAIN_BASE_SCALE,
  TERRAIN_ORIGINAL_CENTER,
  CAMERA_HEIGHT_OFFSET,
  PIN_HEIGHT_OFFSET,
} from '../../config/terrain-config';

interface Scene3DProps {
  initialPosition?: Initial3DPosition | null;
  selectedPin?: PinData | null;
}

// 地形の位置補正値を計算（スケール適用後の中心を原点に配置するため）
// position = -terrainCenterScaled + offset = -(terrainOriginalCenter * scale) + offset
const calculateTerrainPosition = (): [number, number, number] => {
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
};

// 3Dシーンコンポーネント
export default function Scene3D({ initialPosition, selectedPin: propSelectedPin }: Scene3DProps) {
  const { isDevMode } = useDevModeStore();
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [localSelectedPin, setLocalSelectedPin] = useState<PinData | null>(null);
  const selectedPin = propSelectedPin ?? localSelectedPin;
  const [webglSupport, setWebglSupport] = useState<WebGLSupport | null>(null);
  const [renderer, setRenderer] = useState<string>('webgl2');
  const [permissionGranted, setPermissionGranted] = useState(() => {
    // ローカルストレージから許可状態を復元
    const stored = localStorage.getItem('deviceOrientationPermission');
    console.log('保存された許可状態:', stored);
    return stored === 'granted';
  });
  const [isMobile, setIsMobile] = useState(false);
  const deviceOrientationControlsRef = React.useRef<any>(null);

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });

    // デバイス検出
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const mobile = isMobileDevice || isTouchDevice;
      setIsMobile(mobile);
      console.log('Device detection:', { isMobileDevice, isTouchDevice, isMobile: mobile });
      console.log('User Agent:', navigator.userAgent);
      console.log(
        'Touch support:',
        'ontouchstart' in window,
        'maxTouchPoints:',
        navigator.maxTouchPoints
      );
    };

    checkDevice();

    // デバイス向きイベントの状態を監視
    const checkOrientationPermission = () => {
      if (typeof DeviceOrientationEvent !== 'undefined') {
        // デバイス向きイベントが利用可能かテスト
        const testHandler = () => {
          console.log('デバイス向きイベントが利用可能です');
          setPermissionGranted(true);
          localStorage.setItem('deviceOrientationPermission', 'granted');
          window.removeEventListener('deviceorientation', testHandler);
        };

        window.addEventListener('deviceorientation', testHandler, { once: true });

        // 3秒後にタイムアウト
        setTimeout(() => {
          window.removeEventListener('deviceorientation', testHandler);
        }, 3000);
      }
    };

    // モバイルの場合のみチェック
    if (isMobile) {
      checkOrientationPermission();
    }
  }, [isMobile]);

  // デバイス向き許可のハンドラ
  const handleDeviceOrientationPermission = async () => {
    try {
      // デバイス向きイベントの許可をリクエスト
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          localStorage.setItem('deviceOrientationPermission', 'granted');
          console.log('デバイス向き許可が取得されました');
        } else {
          console.warn('デバイス向き許可が拒否されました');
        }
      } else {
        // 古いブラウザや許可が不要な場合
        setPermissionGranted(true);
        localStorage.setItem('deviceOrientationPermission', 'granted');
        console.log('デバイス向き許可が不要です');
      }
    } catch (error) {
      console.error('デバイス向き許可の取得に失敗:', error);
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
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <Canvas
        style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}
        camera={{
          position: initialCameraConfig.position,
          fov: 65,
          near: 0.1,
          far: 50000000, // スカイボックスと同じ範囲まで見える
        }}
        gl={getRendererConfig(renderer)}
      >
        <Suspense fallback={null}>
          {/* カメラの初期位置を明示的に設定 */}
          <CameraPositionSetter initialCameraConfig={initialCameraConfig} />
          {/* devモード時: カメラ位置を監視 */}
          {isDevMode && <CameraPositionTracker />}
          {/* PC用キーボード移動コントロール */}
          {!isMobile && <PCKeyboardControls />}
          {/* デバイス向きコントロール（モバイルのみ） */}
          {isMobile && permissionGranted && (
            <DeviceOrientationControls ref={deviceOrientationControlsRef} />
          )}
          {/* FPSスタイルカメラコントロール（PCのみ） */}
          {!isMobile && <FPSCameraControls />}
          {/* React Three Fiber標準のSkyコンポーネント - 広範囲のスカイボックス */}
          <Sky
            distance={50000} // 広範囲のスカイボックス（50km）
            sunPosition={[100, 50, 100]} // 太陽位置を調整
            inclination={0.49} // 太陽の高さを調整
            azimuth={0.25} // 太陽の方位角
          />

          {/* 環境マップ（反射などに使用） */}
          <Environment preset="sunset" />

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
            position={calculateTerrainPosition()}
            scale={[1, 1, 1]} // 全体のスケール
            rotation={[0, 0, 0]}
            visible={true}
            showTerrain={true} // 地形を表示
            showWater={true} // 水面を表示
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

          {/* devモード時: 2Dマップ上のピン位置を3Dビューに表示 */}
          {isDevMode && <PinMarkers3D selectedPin={selectedPin} />}

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
        onSelectPin={setLocalSelectedPin}
        onDeselectPin={() => setLocalSelectedPin(null)}
      />

      {/* デバイス向き許可ボタン（モバイルのみ） */}
      {isMobile && !permissionGranted && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 15px 0' }}>デバイス向きの許可が必要です</h3>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
            3Dビューでデバイスの向きに応じてカメラを制御するために、デバイス向きの許可が必要です。
          </p>
          <button
            type="button"
            onClick={handleDeviceOrientationPermission}
            style={{
              background: '#2B6CB0',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            デバイス向きを許可
          </button>
        </div>
      )}

      {/* devモード時: 座標情報を表示 */}
      {isDevMode && <CoordinateDebugInfo initialPosition={initialPosition} />}
    </div>
  );
}

// カメラの初期位置を明示的に設定するコンポーネント
// 地形の高さに合わせてカメラの高さを調整
function CameraPositionSetter({
  initialCameraConfig,
}: {
  initialCameraConfig: { position: [number, number, number]; rotation: [number, number, number] };
}) {
  const { camera, scene } = useThree();
  const hasSetPosition = React.useRef(false);
  const frameCount = React.useRef(0);
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);

  // 地形が読み込まれるまで待機してからカメラ位置を設定
  useFrame(() => {
    if (hasSetPosition.current) return;

    frameCount.current += 1;
    const cameraX = initialCameraConfig.position[0];
    const cameraZ = initialCameraConfig.position[2];
    let finalCameraY = initialCameraConfig.position[1]; // デフォルトの高さ

    // シーン内の地形オブジェクトを検索
    // 地形はGroup内のprimitiveとして配置されているため、実際のMeshを再帰的に検索
    let terrainMesh: THREE.Mesh | null = null;
    const foundMeshes: Array<{
      name: string;
      size: { x: number; y: number; z: number };
      type: string;
      hasGeometry: boolean;
    }> = [];

    scene.traverse((child) => {
      // GroupやObject3Dではなく、実際のMeshを探す
      if (child instanceof THREE.Mesh && child.geometry) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        const meshName = child.name || '(無名)';
        foundMeshes.push({
          name: meshName,
          size: { x: size.x, y: size.y, z: size.z },
          type: child.type,
          hasGeometry: child.geometry !== null,
        });

        // 地形のMeshを探す（名前で判定、または適切なサイズのMesh）
        // バウンディングボックスを除外するため、サイズ制限を追加
        if (!terrainMesh) {
          if (meshName === 'Displacement.001' || meshName === 'Displacement') {
            terrainMesh = child;
          } else if (
            size.x > 100 &&
            size.z > 100 &&
            size.x < 10000 &&
            size.z < 10000 &&
            size.y < 1000
          ) {
            // 100m以上10000m未満のサイズで、高さが1000m未満のMeshを地形として扱う
            // これにより、異常に大きなバウンディングボックスを除外
            terrainMesh = child;
          }
        }
      }
    });

    if (terrainMesh) {
      // 地形オブジェクトの情報を取得
      const mesh = terrainMesh as THREE.Mesh;
      const terrainBox = new THREE.Box3().setFromObject(mesh);
      const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
      const terrainSize = terrainBox.getSize(new THREE.Vector3());
      const terrainWorldPosition = new THREE.Vector3();
      mesh.getWorldPosition(terrainWorldPosition);
      const terrainName = mesh.name || '(無名)';

      // 高い位置から下方向にレイを飛ばして地形との交差を計算
      const rayStartY = 1000;
      const rayStart = new THREE.Vector3(cameraX, rayStartY, cameraZ);
      const rayDirection = new THREE.Vector3(0, -1, 0);

      raycaster.set(rayStart, rayDirection);

      // 地形のMeshの実際のジオメトリと交差するように、再帰的検索を無効化
      // 第2引数をfalseにして、このMesh自体のみを対象とする
      let intersects = raycaster.intersectObject(mesh, false);

      // 交差が見つからない場合、子要素を再帰的に検索
      if (intersects.length === 0 && mesh.children.length > 0) {
        // 子要素の中から実際のMeshを探す
        const childMeshes: THREE.Mesh[] = [];
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            childMeshes.push(child);
          }
        });

        // 子要素のMeshに対してRaycastingを実行
        for (const childMesh of childMeshes) {
          const childIntersects = raycaster.intersectObject(childMesh, false);
          if (childIntersects.length > 0) {
            intersects = childIntersects;
            break; // 最初に見つかった交差点を使用
          }
        }
      }

      if (intersects.length > 0) {
        const firstIntersect = intersects[0];
        const terrainHeight = firstIntersect.point.y;
        finalCameraY = terrainHeight + CAMERA_HEIGHT_OFFSET;

        camera.position.set(cameraX, finalCameraY, cameraZ);
        hasSetPosition.current = true;

        console.log('=== カメラ高さを地形に合わせて調整（成功） ===');
        console.log('フレーム数:', frameCount.current);
        console.log('カメラ位置（X, Z）:', cameraX.toFixed(2), cameraZ.toFixed(2));
        console.log('地形オブジェクト:', terrainName);
        console.log('地形のローカル位置:', {
          x: mesh.position.x.toFixed(2),
          y: mesh.position.y.toFixed(2),
          z: mesh.position.z.toFixed(2),
        });
        console.log('地形のワールド位置:', {
          x: terrainWorldPosition.x.toFixed(2),
          y: terrainWorldPosition.y.toFixed(2),
          z: terrainWorldPosition.z.toFixed(2),
        });
        console.log('地形のバウンディングボックス中心:', {
          x: terrainCenter.x.toFixed(2),
          y: terrainCenter.y.toFixed(2),
          z: terrainCenter.z.toFixed(2),
        });
        console.log('地形のサイズ:', {
          x: terrainSize.x.toFixed(2),
          y: terrainSize.y.toFixed(2),
          z: terrainSize.z.toFixed(2),
        });
        console.log('レイの開始位置:', {
          x: rayStart.x.toFixed(2),
          y: rayStart.y.toFixed(2),
          z: rayStart.z.toFixed(2),
        });
        console.log('レイの方向:', {
          x: rayDirection.x.toFixed(2),
          y: rayDirection.y.toFixed(2),
          z: rayDirection.z.toFixed(2),
        });
        console.log('交差点の数:', intersects.length);
        console.log('最初の交差点:', {
          point: {
            x: firstIntersect.point.x.toFixed(2),
            y: firstIntersect.point.y.toFixed(2),
            z: firstIntersect.point.z.toFixed(2),
          },
          distance: firstIntersect.distance.toFixed(2),
        });
        console.log('地形の高さ（交差点のY座標）:', terrainHeight.toFixed(2), 'm');
        console.log('調整後のカメラ高さ:', finalCameraY.toFixed(2), 'm');
        console.log('デフォルトの高さ:', initialCameraConfig.position[1].toFixed(2), 'm');
        console.log('=====================================');
        return;
      }

      // 交差が見つからない場合のログ（初回のみ）
      if (frameCount.current === 1) {
        console.log('=== カメラ高さ調整（交差なし） ===');
        console.log('地形オブジェクト:', terrainName);
        console.log('地形のローカル位置:', {
          x: mesh.position.x.toFixed(2),
          y: mesh.position.y.toFixed(2),
          z: mesh.position.z.toFixed(2),
        });
        console.log('地形のワールド位置:', {
          x: terrainWorldPosition.x.toFixed(2),
          y: terrainWorldPosition.y.toFixed(2),
          z: terrainWorldPosition.z.toFixed(2),
        });
        console.log('地形のバウンディングボックス中心:', {
          x: terrainCenter.x.toFixed(2),
          y: terrainCenter.y.toFixed(2),
          z: terrainCenter.z.toFixed(2),
        });
        console.log('地形のサイズ:', {
          x: terrainSize.x.toFixed(2),
          y: terrainSize.y.toFixed(2),
          z: terrainSize.z.toFixed(2),
        });
        console.log('レイの開始位置:', {
          x: rayStart.x.toFixed(2),
          y: rayStart.y.toFixed(2),
          z: rayStart.z.toFixed(2),
        });
        console.log('レイの方向:', {
          x: rayDirection.x.toFixed(2),
          y: rayDirection.y.toFixed(2),
          z: rayDirection.z.toFixed(2),
        });
        console.log('交差点の数:', 0);
      }
    } else {
      // 地形が見つからない場合のログ（10フレームごと）
      if (frameCount.current === 1 || frameCount.current % 10 === 0) {
        console.log('=== カメラ高さ調整（地形検索中） ===');
        console.log('フレーム数:', frameCount.current);
        console.log('見つかったMeshの数:', foundMeshes.length);
        if (foundMeshes.length > 0) {
          console.log('見つかったMesh:', foundMeshes);
        }
      }
    }

    // タイムアウト処理
    const maxFrames = 100;
    if (frameCount.current >= maxFrames) {
      camera.position.set(cameraX, finalCameraY, cameraZ);
      hasSetPosition.current = true;
      console.warn('=== カメラ高さ調整（タイムアウト） ===');
      console.warn('地形との交差が見つかりませんでした。デフォルトの高さを使用します。');
      console.warn('見つかったMesh:', foundMeshes);
      console.warn('最終的なカメラ位置:', [
        cameraX.toFixed(2),
        finalCameraY.toFixed(2),
        cameraZ.toFixed(2),
      ]);
    }
  });

  return null;
}

// カメラ位置を監視してstateに保存するコンポーネント
function CameraPositionTracker() {
  const { camera } = useThree();
  const loggedRef = React.useRef(false);

  useFrame(() => {
    const pos = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    // グローバル変数に保存
    (window as any).__cameraPosition3D = pos;

    // 初回のみログに出力
    if (!loggedRef.current) {
      console.log('=== カメラの初期位置 ===');
      console.log('3D座標:', pos);
      console.log('期待値（小河内神社、高さ105.73m）: { x: 0, y: 105.73, z: 0 }');
      console.log('差:', {
        x: pos.x,
        y: pos.y - 105.73,
        z: pos.z,
      });
      const distance = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      console.log('原点からの距離:', distance.toFixed(2), 'm');
      console.log('=====================================');
      loggedRef.current = true;
    }
  });

  return null;
}

// devモード時: 座標情報を表示するコンポーネント
function CoordinateDebugInfo({
  initialPosition,
}: {
  initialPosition?: Initial3DPosition | null;
}) {
  const [cameraPos3D, setCameraPos3D] = useState({ x: 0, y: 0, z: 0 });
  const [cameraPosGPS, setCameraPosGPS] = useState({ latitude: 0, longitude: 0, altitude: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const pos = (window as any).__cameraPosition3D;
      if (pos) {
        setCameraPos3D(pos);
        // 3D座標をGPS座標に変換
        const gps = worldToGpsCoordinate({ x: pos.x, y: pos.y, z: pos.z });
        setCameraPosGPS({
          latitude: gps.latitude,
          longitude: gps.longitude,
          altitude: gps.altitude ?? 0,
        });
      }
    }, 100); // 100msごとに更新

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 10000,
        maxWidth: '90vw',
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#10b981' }}>
        DEV MODE - 座標情報
      </div>

      {initialPosition && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>2Dマップの中心位置:</div>
          <div>緯度: {initialPosition.latitude.toFixed(6)}</div>
          <div>経度: {initialPosition.longitude.toFixed(6)}</div>
          {initialPosition.heading !== undefined && (
            <div>方位角: {initialPosition.heading.toFixed(1)}°</div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>3Dカメラ位置:</div>
        <div>X: {cameraPos3D.x.toFixed(2)}m</div>
        <div>Y: {cameraPos3D.y.toFixed(2)}m</div>
        <div>Z: {cameraPos3D.z.toFixed(2)}m</div>
      </div>

      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>3D位置をGPS座標に変換:</div>
        <div>緯度: {cameraPosGPS.latitude.toFixed(6)}</div>
        <div>経度: {cameraPosGPS.longitude.toFixed(6)}</div>
        <div>標高: {cameraPosGPS.altitude.toFixed(2)}m</div>
      </div>
    </div>
  );
}

// FPSスタイルカメラコントロール
function FPSCameraControls() {
  const { camera } = useThree();
  const [isPointerLocked, setIsPointerLocked] = React.useState(false);
  const pitchRef = React.useRef(0);
  const yawRef = React.useRef(0);

  React.useEffect(() => {
    // カメラの初期設定
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

    const handleClick = () => {
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
function PinMarkers3D({ selectedPin }: { selectedPin?: PinData | null }) {
  const { scene } = useThree();
  const pinBasePositions = useMemo(() => {
    return okutamaPins.map((pin) => {
      const [latitude, longitude] = pin.coordinates;
      const worldPos = gpsToWorldCoordinate({ latitude, longitude, altitude: 0 }, SCENE_CENTER);
      return {
        id: pin.id,
        title: pin.title,
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
          basePosition={pin.basePosition}
          scene={scene}
          isSelected={selectedPin?.id === pin.id}
        />
      ))}
    </>
  );
}

// 個別のピンマーカーコンポーネント（地形の高さを計算）
function PinMarker({
  id,
  title,
  basePosition,
  scene,
  isSelected = false,
}: {
  id: string;
  title: string;
  basePosition: [number, number, number];
  scene: THREE.Scene;
  isSelected?: boolean;
}) {
  const [pinHeight, setPinHeight] = React.useState<number | null>(null);
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const frameCount = React.useRef(0);

  useFrame(() => {
    // 地形の高さを一度だけ計算
    if (pinHeight !== null) return;

    frameCount.current += 1;
    const [pinX, , pinZ] = basePosition;

    // シーン内の地形オブジェクトを検索
    let terrainMesh: THREE.Mesh | null = null;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        const meshName = child.name || '(無名)';

        if (!terrainMesh) {
          if (meshName === 'Displacement.001' || meshName === 'Displacement') {
            terrainMesh = child;
          } else if (
            size.x > 100 &&
            size.z > 100 &&
            size.x < 10000 &&
            size.z < 10000 &&
            size.y < 1000
          ) {
            terrainMesh = child;
          }
        }
      }
    });

    if (terrainMesh) {
      const mesh = terrainMesh as THREE.Mesh;

      // 高い位置から下方向にレイを飛ばして地形との交差を計算
      const rayStartY = 1000;
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

  // 高さが計算されるまで表示しない
  if (pinHeight === null) {
    return null;
  }

  return (
    <group key={id} position={[basePosition[0], pinHeight, basePosition[2]]}>
      {/* マーカー（選択時は大きく、色も変更） */}
      <mesh>
        <sphereGeometry args={[isSelected ? 70 : 50, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#dc2626' : '#ef4444'}
          emissive={isSelected ? '#dc2626' : '#ef4444'}
          emissiveIntensity={isSelected ? 0.8 : 0.5}
        />
      </mesh>
      {/* ラベル（テキスト） - 常にカメラを向く */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, 100, 0]}
          fontSize={40}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={2}
          outlineColor="black"
        >
          {title}
        </Text>
      </Billboard>
    </group>
  );
}
