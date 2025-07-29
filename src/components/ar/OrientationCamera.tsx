import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import type { Camera } from 'three';
import type { DeviceOrientation } from '../../types/sensors';

interface OrientationCameraProps {
  deviceOrientation: DeviceOrientation | null;
  enableRotation?: boolean;
  smoothing?: number; // 0-1の範囲、1が最も滑らか
}

export default function OrientationCamera({ 
  deviceOrientation, 
  enableRotation = true,
  smoothing = 0.1 
}: OrientationCameraProps) {
  const { camera } = useThree();
  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
  const currentRotation = useRef({ x: 0, y: 0, z: 0 });

  // デバイス方位が更新されたときにターゲット回転を計算
  useEffect(() => {
    if (!deviceOrientation || !enableRotation) return;

    const { alpha, beta, gamma } = deviceOrientation;
    
    if (alpha !== null && beta !== null && gamma !== null) {
      // デバイス方位からカメラ制御用の回転を計算
      // alpha: コンパス方向 (0°=北, 90°=東, 180°=南, 270°=西)
      // beta: デバイスの前後傾斜 (-180°〜180°, 0°=水平)
      // gamma: デバイスの左右傾斜 (-90°〜90°, 0°=水平)
      
      console.log('Device orientation raw:', { alpha, beta, gamma });
      
      // ラジアンに変換
      const alphaRad = (alpha * Math.PI) / 180;
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;
      
      // Three.jsのカメラ制御に適した座標系に変換
      // iOS縦持ち時の座標系をThree.jsのカメラ回転にマッピング
      targetRotation.current = {
        // X軸回転: デバイスの前後傾斜をカメラの上下回転に変換
        // betaが正の値の時（デバイスが手前に傾く）、カメラは下を向く
        x: -betaRad * 0.5, // 感度を半分に調整
        
        // Y軸回転: コンパス方向をカメラの左右回転に変換  
        // alphaが0°（北向き）の時、カメラも北を向く
        y: -alphaRad, // 反転してiOSの座標系をThree.jsに合わせる
        
        // Z軸回転: デバイスの左右傾斜をカメラの傾きに変換
        // gammaが正の値の時（デバイスが右に傾く）、カメラも右に傾く
        z: gammaRad * 0.3  // 感度を抑えて自然な動きに
      };
      
      console.log('Camera target rotation:', targetRotation.current);
    }
  }, [deviceOrientation, enableRotation]);

  // フレームごとにカメラの回転を滑らかに更新
  useFrame(() => {
    if (!enableRotation) return;

    const target = targetRotation.current;
    const current = currentRotation.current;
    
    // 滑らかな補間（線形補間）
    current.x = lerp(current.x, target.x, smoothing);
    current.y = lerpAngle(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, smoothing);
    
    // 回転制限を適用（極端な角度を防ぐ）
    const maxTilt = Math.PI / 3; // 60度制限
    current.x = Math.max(-maxTilt, Math.min(maxTilt, current.x));
    current.z = Math.max(-maxTilt, Math.min(maxTilt, current.z));
    
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