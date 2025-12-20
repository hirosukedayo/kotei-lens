import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { DeviceOrientation } from '../../types/sensors';

interface OrientationCameraProps {
  deviceOrientation: DeviceOrientation | null;
  enableRotation?: boolean;
  smoothing?: number; // 0-1の範囲、1が最も速い
  arMode?: boolean; // ARモード：背面カメラ補正を含む
  manualHeadingOffset?: number; // 手動補正（度数法）
}

export default function OrientationCamera({
  deviceOrientation,
  enableRotation = true,
  smoothing = 0.1,
  arMode = false,
  manualHeadingOffset = 0,
}: OrientationCameraProps) {
  const { camera } = useThree();

  // 描画パフォーマンス向上のための事前アロケーション
  const euler = useRef(new THREE.Euler());
  const q_device = useRef(new THREE.Quaternion());
  const q_world = useRef(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))); // - PI/2 around X (look forward)
  const q_screen = useRef(new THREE.Quaternion());
  const q_final = useRef(new THREE.Quaternion());
  const zee = useRef(new THREE.Vector3(0, 0, 1));

  // 画面の向き（ラジアン）
  const screenOrientation = useRef(0);

  // 画面の向き（角度）の監視
  useEffect(() => {
    const updateOrientation = () => {
      // window.orientation は非推奨だが、古いブラウザ用。window.screen.orientation が推奨。
      const angle = window.screen?.orientation?.angle ?? (window as any).orientation ?? 0;
      screenOrientation.current = THREE.MathUtils.degToRad(angle);
    };

    window.addEventListener('orientationchange', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    updateOrientation();

    return () => {
      window.removeEventListener('orientationchange', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  // フレームごとにカメラの回転を更新
  useFrame(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma } = deviceOrientation;
    if (alpha === null || beta === null || gamma === null) return;

    // 手動補正を alpha に適用
    const alphaRad = THREE.MathUtils.degToRad(alpha + manualHeadingOffset);
    const betaRad = THREE.MathUtils.degToRad(beta);
    const gammaRad = THREE.MathUtils.degToRad(gamma);
    const orientRad = screenOrientation.current;

    if (arMode) {
      // DeviceOrientationControls の標準的な Quaternion 計算ロジック
      // 順序 YXZ: 'ZXY' for the device orientation
      euler.current.set(betaRad, alphaRad, -gammaRad, 'YXZ');
      q_device.current.setFromEuler(euler.current);

      // デバイス座標系を世界座標系（カメラが前を見る向き）に変換
      q_final.current.copy(q_device.current).multiply(q_world.current);

      // 画面の回転（ポートレート/ランドスケープ）を適用
      q_screen.current.setFromAxisAngle(zee.current, -orientRad);
      q_final.current.multiply(q_screen.current);

      // 滑らかな補間
      camera.quaternion.slerp(q_final.current, smoothing);
    } else {
      // 非ARモード：シンプルな傾き表現
      euler.current.set(betaRad * 0.1, alphaRad * 0.1, 0, 'XYZ');
      camera.quaternion.slerp(q_final.current.setFromEuler(euler.current), smoothing);
    }
  });

  return null;
}

// カメラ制御のユーティリティフック
// eslint-disable-next-line react-refresh/only-export-components
export function useOrientationCamera(
  deviceOrientation: DeviceOrientation | null,
  options: {
    enableRotation?: boolean;
    smoothing?: number;
    arMode?: boolean;
    manualHeadingOffset?: number;
  } = {}
) {
  const { camera } = useThree();
  const {
    enableRotation = true,
    smoothing = 0.1,
    arMode = true,
    manualHeadingOffset = 0,
  } = options;

  const euler = useRef(new THREE.Euler());
  const q_device = useRef(new THREE.Quaternion());
  const q_world = useRef(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
  const q_screen = useRef(new THREE.Quaternion());
  const q_final = useRef(new THREE.Quaternion());
  const zee = useRef(new THREE.Vector3(0, 0, 1));
  const screenOrientation = useRef(0);

  useEffect(() => {
    const update = () => {
      const angle = window.screen?.orientation?.angle ?? (window as any).orientation ?? 0;
      screenOrientation.current = THREE.MathUtils.degToRad(angle);
    };
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);

  useFrame(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma } = deviceOrientation;
    if (alpha === null || beta === null || gamma === null) return;

    const alphaRad = THREE.MathUtils.degToRad(alpha + manualHeadingOffset);
    const betaRad = THREE.MathUtils.degToRad(beta);
    const gammaRad = THREE.MathUtils.degToRad(gamma);
    const orientRad = screenOrientation.current;

    if (arMode) {
      euler.current.set(betaRad, alphaRad, -gammaRad, 'YXZ');
      q_device.current.setFromEuler(euler.current);
      q_final.current.copy(q_device.current).multiply(q_world.current);
      q_screen.current.setFromAxisAngle(zee.current, -orientRad);
      q_final.current.multiply(q_screen.current);
      camera.quaternion.slerp(q_final.current, smoothing);
    } else {
      euler.current.set(betaRad * 0.1, alphaRad * 0.1, 0, 'XYZ');
      camera.quaternion.slerp(q_final.current.setFromEuler(euler.current), smoothing);
    }
  });

  return {
    isTracking: enableRotation && deviceOrientation !== null,
  };
}
