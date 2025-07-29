// GPS座標と3D空間座標の変換ユーティリティ

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// 小河内ダム周辺の基準座標（奥多摩湖）
export const OKUTAMA_DAM_CENTER: GPSCoordinate = {
  latitude: 35.7858, // 北緯35度47分09秒
  longitude: 139.0411, // 東経139度02分28秒
  altitude: 530, // 標高約530m（ダム湖水面）
};

// 地球の半径（メートル）
const EARTH_RADIUS = 6371000;

/**
 * GPS座標間の距離を計算（Haversine公式）
 */
export function calculateDistance(point1: GPSCoordinate, point2: GPSCoordinate): number {
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a = 
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS * c;
}

/**
 * GPS座標を3D空間座標に変換
 * 基準点（小河内ダム）を原点(0,0,0)とした相対座標系
 */
export function gpsToWorldCoordinate(gpsPoint: GPSCoordinate, referencePoint: GPSCoordinate = OKUTAMA_DAM_CENTER): Vector3D {
  // 緯度・経度差を計算
  const deltaLat = gpsPoint.latitude - referencePoint.latitude;
  const deltaLng = gpsPoint.longitude - referencePoint.longitude;
  
  // 平均緯度での経度1度あたりの距離を計算
  const avgLat = (gpsPoint.latitude + referencePoint.latitude) / 2;
  const latDistance = deltaLat * (EARTH_RADIUS * Math.PI / 180);
  const lngDistance = deltaLng * (EARTH_RADIUS * Math.PI / 180) * Math.cos(avgLat * Math.PI / 180);
  
  // 標高差
  const deltaAlt = (gpsPoint.altitude || 0) - (referencePoint.altitude || 0);
  
  return {
    x: lngDistance, // 東西方向（東が正）
    y: deltaAlt,    // 高さ方向（上が正）  
    z: -latDistance // 南北方向（南が正、Three.jsのz軸に合わせて反転）
  };
}

/**
 * 3D空間座標をGPS座標に変換
 */
export function worldToGpsCoordinate(worldPoint: Vector3D, referencePoint: GPSCoordinate = OKUTAMA_DAM_CENTER): GPSCoordinate {
  // 平均緯度での経度1度あたりの距離を計算
  const avgLat = referencePoint.latitude;
  const latPerMeter = 180 / (EARTH_RADIUS * Math.PI);
  const lngPerMeter = 180 / (EARTH_RADIUS * Math.PI * Math.cos(avgLat * Math.PI / 180));
  
  return {
    latitude: referencePoint.latitude + (-worldPoint.z * latPerMeter),
    longitude: referencePoint.longitude + (worldPoint.x * lngPerMeter),
    altitude: (referencePoint.altitude || 0) + worldPoint.y
  };
}

/**
 * 2点間の方位角を計算（北を0度とし、時計回りで増加）
 */
export function calculateBearing(from: GPSCoordinate, to: GPSCoordinate): number {
  const fromLatRad = from.latitude * Math.PI / 180;
  const toLatRad = to.latitude * Math.PI / 180;
  const deltaLngRad = (to.longitude - from.longitude) * Math.PI / 180;
  
  const y = Math.sin(deltaLngRad) * Math.cos(toLatRad);
  const x = Math.cos(fromLatRad) * Math.sin(toLatRad) - 
           Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLngRad);
  
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;
  
  return bearingDeg;
}

/**
 * GPS精度に基づいて表示距離を制限
 */
export function shouldShowObject(
  userPosition: GPSCoordinate, 
  objectPosition: GPSCoordinate, 
  accuracy: number
): boolean {
  const distance = calculateDistance(userPosition, objectPosition);
  
  // GPS精度が低い場合は近くのオブジェクトのみ表示
  if (accuracy > 100) return distance < 500;  // 精度100m以上なら500m以内のみ
  if (accuracy > 50) return distance < 1000;  // 精度50m以上なら1km以内のみ
  if (accuracy > 20) return distance < 2000;  // 精度20m以上なら2km以内のみ
  
  return distance < 5000; // 精度20m以下なら5km以内まで表示
}