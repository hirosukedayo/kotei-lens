import { Environment, Sky } from '@react-three/drei';
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
  // GPS/ARモードは一旦削除し、常に手動操作のみとする

  useEffect(() => {
    detectWebGLSupport().then((support) => {
      setWebglSupport(support);
      const recommended = getRecommendedRenderer(support);
      setRenderer(recommended);
      console.log('WebGL Support:', support);
      console.log('Recommended Renderer:', recommended);
    });
  }, []);

  // センサー機能は停止（GPS/AR非対応の当面構成）

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
          <DeviceYawRotator />
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

      {/* GPSモードUIは削除 */}
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

// デバイスの向き（方位）で画面の向き（ヨー）だけを制御
function DeviceYawRotator() {
  const { camera } = useThree();
  const targetQuatRef = React.useRef(new THREE.Quaternion());
  const eulerRef = React.useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const smooth = 0.15; // スムージング係数（0-1）

  React.useEffect(() => {
    const toRad = (deg: number | null) => (deg === null ? 0 : (deg * Math.PI) / 180);
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // ヨー（方位）
      // @ts-ignore iOS拡張
      const hasWebkit = typeof e.webkitCompassHeading === 'number';
      // @ts-ignore
      const heading = hasWebkit ? (360 - e.webkitCompassHeading) : (e.alpha ?? 0);
      const yaw = toRad(heading);
      // ピッチ（上下）
      const pitch = toRad(e.beta ?? 0);
      // ロール（傾き）
      const roll = toRad(e.gamma ?? 0);

      // Three.jsのカメラに適した回転順で適用（Y: yaw, X: pitch, Z: roll）
      const euler = eulerRef.current;
      euler.set(pitch, yaw, -roll, 'YXZ');
      targetQuatRef.current.setFromEuler(euler);
    };

    const type: keyof WindowEventMap = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, handleOrientation as EventListener);
    return () => window.removeEventListener(type, handleOrientation as EventListener);
  }, []);

  // 毎フレーム、ターゲット回転にスムーズ追従
  useFrame(() => {
    camera.quaternion.slerp(targetQuatRef.current, smooth);
  });
  return null;
}
