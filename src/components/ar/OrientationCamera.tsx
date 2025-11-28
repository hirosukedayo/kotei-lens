import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
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
  
  // 画面の向きによるオフセット調整（Three.js DeviceOrientationControls準拠）
  const screenOrientationOffset = useRef(0);

  // 画面の向きに基づくオフセット設定
  useEffect(() => {
    if (arMode) {
      // 画面の向きを取得（iOS Safari対応）
      const screenOrientation = window.screen?.orientation?.angle ?? 
                                (window as any).orientation ?? 0;
      
      // Three.js DeviceOrientationControls準拠のオフセット設定
      // 縦向き（portrait）では0、横向き（landscape）では90度オフセット
      screenOrientationOffset.current = screenOrientation === 0 ? 0 : Math.PI / 2;
    }
  }, [arMode]);

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
        // ARモード: Three.js DeviceOrientationControls準拠の座標変換
        // 回転順序: YXZ（Three.jsの標準）
        // euler.set(beta, alpha - offset, -gamma, 'YXZ')
        
        // デバイスが垂直に近いかどうかを判定（beta値で判定）
        const isNearVertical = Math.abs(betaRad - Math.PI / 2) < Math.PI / 6; // 30度以内
        
        // 垂直時のガンマ値フィルタリング
        let filteredGamma = gammaRad;
        if (isNearVertical) {
          // 垂直時はガンマの変化を大幅に抑制
          const gammaThreshold = Math.PI / 12; // 15度
          if (Math.abs(gammaRad) > gammaThreshold) {
            filteredGamma = Math.sign(gammaRad) * gammaThreshold;
          }
        }
        
        targetRotation.current = {
          // X軸: beta - π/2（背面カメラ調整）
          // デバイスの上ではなく背面から見るための-90度調整
          x: betaRad - Math.PI / 2,
          
          // Y軸: alphaからオフセットを引く（画面向きによる調整）
          y: alphaRad - screenOrientationOffset.current,
          
          // Z軸: フィルタリングされたガンマを反転
          z: -filteredGamma
        };
        
        // カメラの回転順序をYXZに設定
        camera.rotation.order = 'YXZ';
      } else {
        // 通常モード: 安全な制御（従来の方式）
        targetRotation.current = {
          x: betaRad * 0.1,
          y: alphaRad * 0.1,
          z: 0
        };
        
        // 通常モードではXYZ順序
        camera.rotation.order = 'XYZ';
      }
    }
  }, [deviceOrientation, enableRotation, arMode, camera]);

  // フレームごとにカメラの回転を滑らかに更新
  useFrame(() => {
    if (!enableRotation) return;

    const target = targetRotation.current;
    const current = currentRotation.current;
    
    // デバイスが垂直に近いかどうかを判定
    const isNearVertical = Math.abs(target.x) < Math.PI / 6; // 30度以内で垂直と判定
    
    // 垂直時はより強いスムージングを適用
    const adaptiveSmoothing = isNearVertical ? smoothing * 0.3 : smoothing;
    
    // 滑らかな補間（線形補間）
    current.x = lerp(current.x, target.x, adaptiveSmoothing);
    current.y = lerpAngle(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, adaptiveSmoothing);
    
    if (arMode) {
      // ARモード: 垂直時を考慮した制限
      const maxTilt = Math.PI / 2; // 90度制限
      current.x = Math.max(-maxTilt, Math.min(maxTilt * 0.8, current.x)); // 上向きは80%まで
      
      // 垂直時は傾きを更に制限
      const maxRoll = isNearVertical ? Math.PI / 12 : Math.PI / 4; // 垂直時15度、通常時45度
      current.z = Math.max(-maxRoll, Math.min(maxRoll, current.z));
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