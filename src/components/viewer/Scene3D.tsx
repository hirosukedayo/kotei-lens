import { Environment, Sky, DeviceOrientationControls } from '@react-three/drei';
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
  const [permissionGranted, setPermissionGranted] = useState(false);
  const deviceOrientationControlsRef = React.useRef<any>(null);

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });
  }, []);

  // デバイス向き許可のハンドラ
  const handleDeviceOrientationPermission = () => {
    if (deviceOrientationControlsRef.current) {
      deviceOrientationControlsRef.current.connect();
      setPermissionGranted(true);
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
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{
          position: [-141.07, -71.11, -9.7], // 人の目線程度の高さでモデル手前に配置
          fov: 65,
          near: 0.1,
          far: 50000000, // スカイボックスと同じ範囲まで見える
        }}
        gl={getRendererConfig(renderer)}
      >
        <Suspense fallback={null}>
          <KeyboardPanLogger />
          <DeviceOrientationControls ref={deviceOrientationControlsRef} />
          {/* React Three Fiber標準のSkyコンポーネント - 超巨大サイズ */}
          <Sky 
            distance={45000000} // 45,000km（地球の円周より大きい）
            sunPosition={[1000, 200, 1000]}
            inclination={0.6}
            azimuth={0.25}
          />
          
          {/* 環境マップ（オプション：反射などに使用） */}
          {/* <Environment preset="sunset" /> */}

          {/* 環境光を追加 */}
          <ambientLight intensity={0.4} color="#ffffff" />

          {/* 湖の3Dモデル */}
          <LakeModel 
            position={[0, 0, 0]}
            scale={[10, 10, 10]}
            rotation={[0, 0, 0]}
            visible={true}
          />
          
          {/* 水面は非表示に変更 */}
          
          {/* カメラコントロールは無効化（OrbitControls削除） */}
        </Suspense>
      </Canvas>

      {/* デバイス向き許可ボタン */}
      {!permissionGranted && (
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

// キーボードで縦横のみ移動し、変更毎に設定をログ出力
function KeyboardPanLogger() {
  const { camera } = useThree();
  React.useEffect(() => {
    const step = 2;
    const dir = new THREE.Vector3();
    const right = new THREE.Vector3();
    const handleKey = (e: KeyboardEvent) => {
      let moved = false;
      switch (e.key) {
        case 'ArrowLeft':
          camera.position.x -= step;
          moved = true;
          break;
        case 'ArrowRight':
          camera.position.x += step;
          moved = true;
          break;
        case 'ArrowUp':
          camera.position.y += step;
          moved = true;
          break;
        case 'ArrowDown':
          camera.position.y -= step;
          moved = true;
          break;
        // 前進・後退（カメラの向きに沿ってZを含む前後移動）
        case 'w':
        case 'W':
          camera.getWorldDirection(dir).normalize();
          camera.position.addScaledVector(dir, step);
          moved = true;
          break;
        case 's':
        case 'S':
          camera.getWorldDirection(dir).normalize();
          camera.position.addScaledVector(dir, -step);
          moved = true;
          break;
        // 水平ストレーフ（A/D）: カメラ右方向ベクトルで左右移動
        case 'a':
        case 'A':
          camera.getWorldDirection(dir).normalize();
          right.set(dir.z, 0, -dir.x).normalize();
          camera.position.addScaledVector(right, -step);
          moved = true;
          break;
        case 'd':
        case 'D':
          camera.getWorldDirection(dir).normalize();
          right.set(dir.z, 0, -dir.x).normalize();
          camera.position.addScaledVector(right, step);
          moved = true;
          break;
        default:
          break;
      }
      if (moved) {
        camera.updateProjectionMatrix();
        // 設定ログ（貼り付けしやすい形式）
        console.log('Camera config:', {
          position: [Number(camera.position.x.toFixed(2)), Number(camera.position.y.toFixed(2)), Number(camera.position.z.toFixed(2))],
          near: camera.near,
          far: camera.far,
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [camera]);
  return null;
}

