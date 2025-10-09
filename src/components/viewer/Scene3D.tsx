import { Environment, Sky, DeviceOrientationControls, OrbitControls } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import React, { useState, useEffect, Suspense } from 'react';
import type { WebGLSupport } from '../../utils/webgl-detector';
import {
  detectWebGLSupport,
  getRecommendedRenderer,
  getRendererConfig,
} from '../../utils/webgl-detector';
import LakeModel from '../3d/LakeModel';

// 3Dシーンコンポーネント
export default function Scene3D() {
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
          position: [-63.43, 105.73, 1.65], // +Z方向を向くように配置
          fov: 65,
          near: 0.1,
          far: 50000000, // スカイボックスと同じ範囲まで見える
        }}
        gl={getRendererConfig(renderer)}
      >
        <Suspense fallback={null}>
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
          <LakeModel 
            position={[1552/2, 0, -1552/2]}
            scale={[1, 1, 1]} // 全体のスケール
            rotation={[0, 0, 0]}
            visible={true}
            showTerrain={true} // 地形を表示
            showWater={true} // 水面を表示
            terrainScale={[10, 10, 10]} // 地形のスケール
            waterScale={[10, 10, 10]} // 水面のスケール
            waterPosition={[0, 0, 0]} // 水面の位置
          />
          
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
    const up = new THREE.Vector3();
    
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


