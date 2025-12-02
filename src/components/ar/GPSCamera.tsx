import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { GPSPosition } from '../../types/sensors';
import { gpsToWorldCoordinate } from '../../utils/coordinate-converter';

interface GPSCameraProps {
  gpsPosition: GPSPosition | null;
  enablePositioning?: boolean;
  smoothing?: number; // 0-1の範囲、位置の滑らかな移動
}

export default function GPSCamera({
  gpsPosition,
  enablePositioning = true,
  smoothing = 0.1,
}: GPSCameraProps) {
  const { camera } = useThree();
  const targetPosition = useRef({ x: 0, y: 50, z: 200 }); // デフォルト位置
  const currentPosition = useRef({ x: 0, y: 50, z: 200 });

  // GPS位置が更新されたときにターゲット位置を計算
  useEffect(() => {
    if (!gpsPosition || !enablePositioning) return;

    // GPS座標を3D世界座標に変換
    const worldPosition = gpsToWorldCoordinate({
      latitude: gpsPosition.latitude,
      longitude: gpsPosition.longitude,
      altitude: gpsPosition.altitude || 0,
    });

    // カメラの高さを調整（地面から少し上に）
    targetPosition.current = {
      x: worldPosition.x,
      y: Math.max(worldPosition.y + 10, 10), // 最低10m上に
      z: worldPosition.z,
    };

    // GPS位置更新ログ（必要時のみ有効化）
    // console.log('GPS Camera position updated:', {
    //   gps: { lat: gpsPosition.latitude, lng: gpsPosition.longitude, alt: gpsPosition.altitude },
    //   world: worldPosition,
    //   camera: targetPosition.current,
    //   accuracy: gpsPosition.accuracy
    // });
  }, [gpsPosition, enablePositioning]);

  // フレームごとにカメラの位置を滑らかに更新
  useFrame(() => {
    if (!enablePositioning) return;

    const target = targetPosition.current;
    const current = currentPosition.current;

    // 滑らかな補間（線形補間）
    current.x = lerp(current.x, target.x, smoothing);
    current.y = lerp(current.y, target.y, smoothing);
    current.z = lerp(current.z, target.z, smoothing);

    // カメラの位置を適用
    camera.position.set(current.x, current.y, current.z);
  });

  return null; // このコンポーネントは視覚的な要素を持たない
}

// 線形補間関数
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}
