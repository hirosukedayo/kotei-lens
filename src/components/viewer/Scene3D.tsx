import { Environment, Sky, DeviceOrientationControls } from '@react-three/drei';
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
import { gpsToWorldCoordinate, worldToGpsCoordinate, SCENE_CENTER } from '../../utils/coordinate-converter';
import type { Initial3DPosition } from '../map/OkutamaMap2D';
import { useDevModeStore } from '../../stores/devMode';
import { okutamaPins } from '../../data/okutama-pins';

interface Scene3DProps {
  initialPosition?: Initial3DPosition | null;
}

// 3Dシーンコンポーネント
export default function Scene3D({ initialPosition }: Scene3DProps) {
  const { isDevMode } = useDevModeStore();
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
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const mobile = isMobileDevice || isTouchDevice;
      setIsMobile(mobile);
      console.log('Device detection:', { isMobileDevice, isTouchDevice, isMobile: mobile });
      console.log('User Agent:', navigator.userAgent);
      console.log('Touch support:', 'ontouchstart' in window, 'maxTouchPoints:', navigator.maxTouchPoints);
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
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
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
      
      // カメラの高さを調整（以前の位置と同じ105.73m）
      // 以前の位置: [-63.43, 105.73, 1.65] を基準に、GPS座標から計算した位置に移動
      const cameraHeight = worldPos.y + 105.73;
      
      // 回転はDeviceOrientationControlsが自動的に制御するため、初期回転は設定しない
      // 以前の位置では回転が[0, 0, 0]だった
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
          {/* devモード時: カメラ位置を監視 */}
          {isDevMode && <CameraPositionTracker />}
          {/* PC用キーボード移動コントロール */}
          {!isMobile && <PCKeyboardControls />}
          {/* デバイス向きコントロール（モバイルのみ） */}
          {isMobile && permissionGranted && <DeviceOrientationControls ref={deviceOrientationControlsRef} />}
          {/* FPSスタイルカメラコントロール（PCのみ） */}
          {!isMobile && <FPSCameraControls />}
          {/* React Three Fiber標準のSkyコンポーネント - 適切なサイズ */}
          <Sky 
            distance={1000} // 適切な距離に調整
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
          {/* 地形の中心点（terrainScale適用前の中心: [-7760.500746543941, 1845.8277086543676, 7760.500746543941]）を[0, 0, 0]に配置するため、positionを調整 */}
          {/* terrainScale=[10,10,10]適用後、中心は[-77605.00746543941, 18458.277086543676, 77605.00746543941]になる */}
          {/* これを原点に配置するため、positionで補正 */}
          <LakeModel 
            position={[77605.00746543941, 0, -77605.00746543941]}
            scale={[1, 1, 1]} // 全体のスケール
            rotation={[0, 0, 0]}
            visible={true}
            showTerrain={true} // 地形を表示
            showWater={true} // 水面を表示
            terrainScale={[10, 10, 10]} // 地形のスケール
            waterScale={[10, 10, 10]} // 水面のスケール
            waterPosition={[0, 0, 0]} // 水面の位置
          />
          
          {/* devモード時: 2Dマップ上のピン位置を3Dビューに表示 */}
          {isDevMode && <PinMarkers3D />}
          
          {/* カメラコントロールは無効化（OrbitControls削除） */}
        </Suspense>
      </Canvas>

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
  initialPosition 
}: { 
  initialPosition?: Initial3DPosition | null 
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
        pitchRef.current = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitchRef.current - deltaY));
        
        // カメラの回転を更新（Z軸回転は0に固定）
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawRef.current;
        camera.rotation.x = pitchRef.current;
        camera.rotation.z = 0;
        
        // カメラ位置と回転をコンソールに出力
        console.log('FPS Camera:', {
          position: [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)],
          rotation: [camera.rotation.x.toFixed(2), camera.rotation.y.toFixed(2), camera.rotation.z.toFixed(2)],
          yaw: yawRef.current.toFixed(2),
          pitch: pitchRef.current.toFixed(2)
        });
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
function PinMarkers3D() {
  const pinPositions = useMemo(() => {
    const positions = okutamaPins.map((pin) => {
      const [latitude, longitude] = pin.coordinates;
      const worldPos = gpsToWorldCoordinate(
        { latitude, longitude, altitude: 0 },
        SCENE_CENTER
      );
      // 地形の高さを考慮して、マーカーを少し上に配置
      return {
        id: pin.id,
        title: pin.title,
        position: [worldPos.x, worldPos.y + 2000, worldPos.z] as [number, number, number],
        gps: { latitude, longitude },
        worldPos,
      };
    });
    
    // devモード時: ピンの位置をログに出力
    console.log('=== ピンの3D座標 ===');
    for (const pin of positions) {
      console.log(`${pin.title} (${pin.id}):`, {
        GPS: pin.gps,
        '3D座標': pin.worldPos,
        'マーカー位置': pin.position,
      });
    }
    console.log('SCENE_CENTER（小河内神社）:', SCENE_CENTER);
    console.log('=====================================');
    
    return positions;
  }, []);

  return (
    <>
      {pinPositions.map((pin) => (
        <group key={pin.id} position={pin.position}>
          {/* マーカー（赤い球体） */}
          <mesh>
            <sphereGeometry args={[50, 16, 16]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
          {/* ラベル（テキスト） */}
          <mesh position={[0, 100, 0]}>
            <planeGeometry args={[500, 100]} />
            <meshBasicMaterial color="rgba(0, 0, 0, 0.7)" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}


