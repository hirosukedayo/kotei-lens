import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import type { Camera } from 'three';
import type { DeviceOrientation } from '../../types/sensors';

interface OrientationCameraProps {
  deviceOrientation: DeviceOrientation | null;
  enableRotation?: boolean;
  smoothing?: number; // 0-1の範囲、1が最も滑らか
  arMode?: boolean; // ARモード：より直接的な制御
}

export default function OrientationCamera({ 
  deviceOrientation, 
  enableRotation = true,
  smoothing = 0.1,
  arMode = false
}: OrientationCameraProps) {
  const { camera } = useThree();
  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
  const currentRotation = useRef({ x: 0, y: 0, z: 0 });

  // デバイス方位が更新されたときにターゲット回転を計算
  useEffect(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma } = deviceOrientation;
    
    if (alpha !== null && beta !== null && gamma !== null) {
      // ラジアンに変換
      const alphaRad = (alpha * Math.PI) / 180;
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;
      
      if (arMode) {
        // ARモード: iOS DeviceOrientationとThree.jsの座標軸マッピング
        // iOS: alpha=コンパス, beta=前後傾斜(-180~180), gamma=左右傾斜(-90~90)
        // Three.js: x=pitch(上下), y=yaw(左右), z=roll(傾き)
        
        // iPhoneを縦持ちで背面カメラの向きに合わせる座標変換
        targetRotation.current = {
          // X軸(pitch): iOSのbeta → Three.jsのX軸 (前後傾斜)
          // iPhoneが下向き(beta=90°)のときカメラも下向き(x=π/2)
          x: (betaRad - Math.PI / 2), // beta=0°(水平)のとき x=-π/2、beta=90°(下向き)のとき x=0°
          
          // Y軸(yaw): iOSのalpha → Three.jsのY軸 (左右回転)
          // 背面カメラは画面と逆向きなので180度回転
          y: -alphaRad + Math.PI,
          
          // Z軸(roll): iOSのgamma → Three.jsのZ軸 (傾き)
          z: -gammaRad
        };
      } else {
        // 通常モード: 安全な制御（従来の方式）
        targetRotation.current = {
          x: betaRad * 0.1,
          y: alphaRad * 0.1,
          z: 0
        };
      }
    }
  }, [deviceOrientation, enableRotation, arMode]);

  // フレームごとにカメラの回転を滑らかに更新
  useFrame(() => {
    if (!enableRotation) return;

    const target = targetRotation.current;
    const current = currentRotation.current;
    
    // 滑らかな補間（線形補間）
    current.x = lerp(current.x, target.x, smoothing);
    current.y = lerpAngle(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, smoothing);
    
    if (arMode) {
      // ARモード: より自由な回転を許可（ただし極端な角度は制限）
      const maxTilt = Math.PI / 2; // 90度制限
      current.x = Math.max(-maxTilt, Math.min(maxTilt * 0.8, current.x)); // 上向きは80%まで
      current.z = Math.max(-maxTilt * 0.5, Math.min(maxTilt * 0.5, current.z)); // 傾きは50%まで
    } else {
      // 通常モード: 厳しい制限
      const maxTilt = Math.PI / 3; // 60度制限
      current.x = Math.max(-maxTilt, Math.min(maxTilt, current.x));
      current.z = Math.max(-maxTilt, Math.min(maxTilt, current.z));
    }
    
    // カメラの回転を適用
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
    lockHorizontal = false
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
    isTracking: enableRotation && deviceOrientation !== null
  };
}