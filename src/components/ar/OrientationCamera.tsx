import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { DeviceOrientation } from '../../types/sensors';

interface OrientationCameraProps {
  deviceOrientation: DeviceOrientation | null;
  enableRotation?: boolean;
  smoothing?: number; // 0-1の範囲、1が最も滑らか
  arMode?: boolean; // ARモード：より直接的な制御
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
  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
  const currentRotation = useRef({ x: 0, y: 0, z: 0 });

  // 画面の向きによるオフセット調整
  const screenOrientation = useRef(0);
  const initialHeadingOffset = useRef<number | null>(null);

  // 画面の向きの監視
  useEffect(() => {
    const updateOrientation = () => {
      const angle = window.screen?.orientation?.angle ?? (window as any).orientation ?? 0;
      screenOrientation.current = (angle * Math.PI) / 180;
    };

    window.addEventListener('orientationchange', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    updateOrientation();

    return () => {
      window.removeEventListener('orientationchange', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  // デバイス方位の更新処理
  useEffect(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma, webkitCompassHeading } = deviceOrientation;

    if (alpha !== null && beta !== null && gamma !== null) {
      // 初回のみコンパス方位でオフセットを計算
      if (initialHeadingOffset.current === null) {
        if (webkitCompassHeading !== undefined) {
          // iOS: webkitCompassHeadingを使用 (0度 = 北)
          // webkitCompassHeadingは時計回り、alphaは反時計回り
          initialHeadingOffset.current = (webkitCompassHeading + alpha) % 360;
        } else if (deviceOrientation.absolute) {
          // Android/Others: absolute alphaを使用
          initialHeadingOffset.current = 0; // すでに北基準
        } else {
          initialHeadingOffset.current = 0;
        }
        console.log('Initial heading offset calibrated:', initialHeadingOffset.current);
      }

      // ラジアンに変換
      const alphaRad = (alpha * Math.PI) / 180;
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;
      const initialOffsetRad = ((initialHeadingOffset.current || 0) * Math.PI) / 180;
      const manualRad = (manualHeadingOffset * Math.PI) / 180;

      if (arMode) {
        // 安定版 (a625957) のロジックに回帰
        // デバイスが垂直に近いかどうかを判定（beta値で判定）
        const isNearVertical = Math.abs(betaRad - Math.PI / 2) < Math.PI / 6;

        // 垂直時のガンマ値フィルタリング
        let filteredGamma = gammaRad;
        if (isNearVertical) {
          const gammaThreshold = Math.PI / 12;
          if (Math.abs(gammaRad) > gammaThreshold) {
            filteredGamma = Math.sign(gammaRad) * gammaThreshold;
          }
        }

        targetRotation.current = {
          // X軸: beta - π/2（背面カメラ向きに調整）
          x: betaRad - Math.PI / 2,

          // Y軸: alphaから「初期オフセット」「画面回転分」「手動オフセット」を引く
          y: alphaRad - initialOffsetRad - screenOrientation.current - manualRad,

          // Z軸: フィルタリングされたガンマを反転
          z: -filteredGamma,
        };

        camera.rotation.order = 'YXZ';
      } else {
        targetRotation.current = {
          x: betaRad * 0.1,
          y: alphaRad * 0.1,
          z: 0,
        };
        camera.rotation.order = 'XYZ';
      }
    }
  }, [deviceOrientation, enableRotation, arMode, camera, manualHeadingOffset]);

  // フレームごとにカメラの回転を滑らかに更新
  useFrame(() => {
    if (!enableRotation) return;

    const target = targetRotation.current;
    const current = currentRotation.current;

    // 滑らかな補間
    current.x = lerp(current.x, target.x, smoothing);
    current.y = lerpAngle(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, smoothing);

    camera.rotation.set(current.x, current.y, current.z);
  });

  return null; // このコンポーネントは視覚的な要素を持たない
}

// 線形補間関数
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// 角度の線形補間（360度の境界を考慮）
function lerpAngle(start: number, end: number, factor: number): number {
  let diff = end - start;

  // 最短経路を選択（360度境界を考慮）
  if (diff > Math.PI) {
    diff -= 2 * Math.PI;
  } else if (diff < -Math.PI) {
    diff += 2 * Math.PI;
  }

  return start + diff * factor;
}

// カメラ制御のユーティリティフック
// eslint-disable-next-line react-refresh/only-export-components
export function useOrientationCamera(
  deviceOrientation: DeviceOrientation | null,
  options: {
    enableRotation?: boolean;
    smoothing?: number;
    lockVertical?: boolean; // 垂直回転をロック
    lockHorizontal?: boolean; // 水平回転をロック
  } = {}
) {
  const { camera } = useThree();
  const {
    enableRotation = true,
    smoothing = 0.1,
    lockVertical = false,
    lockHorizontal = false,
  } = options;

  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
  const currentRotation = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma } = deviceOrientation;

    if (alpha !== null && beta !== null && gamma !== null) {
      const alphaRad = (alpha * Math.PI) / 180;
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;

      // ロック設定を考慮して更新
      if (!lockVertical) {
        targetRotation.current.x = betaRad;
      }
      if (!lockHorizontal) {
        targetRotation.current.y = alphaRad + Math.PI;
      }
      targetRotation.current.z = -gammaRad;
    }
  }, [deviceOrientation, enableRotation, lockVertical, lockHorizontal]);

  useFrame(() => {
    if (!enableRotation) return;

    const target = targetRotation.current;
    const current = currentRotation.current;

    current.x = lerp(current.x, target.x, smoothing);
    current.y = lerpAngle(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, smoothing);

    camera.rotation.set(current.x, current.y, current.z);
  });

  return {
    currentRotation: currentRotation.current,
    targetRotation: targetRotation.current,
    isTracking: enableRotation && deviceOrientation !== null,
  };
}
