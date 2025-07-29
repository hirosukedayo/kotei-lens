import React, { useMemo } from 'react';
import { Text, Billboard, Sphere } from '@react-three/drei';
import { HISTORICAL_LOCATIONS, getLocationColor, getLocationPriority } from '../../data/historical-locations';
import { gpsToWorldCoordinate, shouldShowObject, calculateDistance } from '../../utils/coordinate-converter';
import type { GPSPosition } from '../../types/sensors';

interface LocationBasedObjectsProps {
  userPosition: GPSPosition | null;
  maxDistance?: number;  // 表示する最大距離（メートル）
  maxObjects?: number;   // 表示する最大オブジェクト数
}

interface LocationObject {
  id: string;
  name: string;
  worldPosition: { x: number; y: number; z: number };
  distance: number;
  color: string;
  priority: number;
}

export default function LocationBasedObjects({ 
  userPosition, 
  maxDistance = 2000,
  maxObjects = 10 
}: LocationBasedObjectsProps) {
  
  // ユーザー位置に基づいて表示すべきオブジェクトを計算
  const visibleObjects = useMemo<LocationObject[]>(() => {
    if (!userPosition) return [];

    const userGPS = {
      latitude: userPosition.latitude,
      longitude: userPosition.longitude,
      altitude: userPosition.altitude || 0
    };

    // 各歴史的地点を処理
    const objects = HISTORICAL_LOCATIONS
      .map(location => {
        const distance = calculateDistance(userGPS, location.gpsCoordinate);
        
        // 距離制限とGPS精度チェック
        if (distance > maxDistance || !shouldShowObject(userGPS, location.gpsCoordinate, userPosition.accuracy)) {
          return null;
        }

        // GPS座標を3D世界座標に変換
        const worldPosition = gpsToWorldCoordinate(location.gpsCoordinate);
        
        return {
          id: location.id,
          name: location.name,
          worldPosition,
          distance,
          color: getLocationColor(location.type),
          priority: getLocationPriority(location)
        };
      })
      .filter((obj): obj is LocationObject => obj !== null)
      .sort((a, b) => {
        // 優先度でソート、同じ優先度なら距離でソート
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.distance - b.distance;
      })
      .slice(0, maxObjects); // 最大表示数に制限

    return objects;
  }, [userPosition, maxDistance, maxObjects]);

  // ユーザー位置が不明な場合は何も表示しない
  if (!userPosition) {
    return null;
  }

  return (
    <group>
      {visibleObjects.map(obj => (
        <LocationMarker 
          key={obj.id}
          object={obj}
        />
      ))}
    </group>
  );
}

// 個別の位置マーカーコンポーネント
interface LocationMarkerProps {
  object: LocationObject;
}

function LocationMarker({ object }: LocationMarkerProps) {
  const { worldPosition, name, color, distance } = object;
  
  // 距離に応じてサイズを調整（近いものほど大きく）
  const scale = Math.max(0.3, Math.min(1.0, 500 / distance));
  
  return (
    <group position={[worldPosition.x, worldPosition.y, worldPosition.z]}>
      {/* 3Dマーカー（球体） */}
      <Sphere args={[2 * scale]} position={[0, 5, 0]}>
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </Sphere>
      
      {/* 位置を示す柱 */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.2 * scale, 0.2 * scale, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      
      {/* 常にカメラを向くテキストラベル */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          position={[0, 8, 0]}
          fontSize={1.5 * scale}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="black"
        >
          {name}
        </Text>
        
        {/* 距離表示 */}
        <Text
          position={[0, 6, 0]}
          fontSize={1 * scale}
          color="#cccccc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="black"
        >
          {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
        </Text>
      </Billboard>
    </group>
  );
}