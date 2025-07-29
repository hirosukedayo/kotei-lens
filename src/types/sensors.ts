// GPS関連の型定義
export interface GPSOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

export interface GPSError {
  code: number;
  message: string;
  timestamp: number;
}

// デバイス方位関連の型定義
export interface DeviceOrientation {
  alpha: number | null;  // Z軸周りの回転 (0-360°)
  beta: number | null;   // X軸周りの回転 (-180-180°)
  gamma: number | null;  // Y軸周りの回転 (-90-90°)
  absolute: boolean;
  timestamp: number;
}

// デバイスモーション関連の型定義
export interface DeviceMotion {
  acceleration: {
    x: number | null;
    y: number | null; 
    z: number | null;
  };
  accelerationIncludingGravity: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  rotationRate: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  };
  interval: number;
  timestamp: number;
}

// センサー状態
export interface SensorStatus {
  gps: {
    available: boolean;
    permission: 'granted' | 'denied' | 'prompt' | 'unknown';
    lastUpdate: number | null;
    error: GPSError | null;
  };
  orientation: {
    available: boolean;
    permission: 'granted' | 'denied' | 'prompt' | 'unknown';
    lastUpdate: number | null;
    error: string | null;
  };
  motion: {
    available: boolean;
    permission: 'granted' | 'denied' | 'prompt' | 'unknown';
    lastUpdate: number | null;
    error: string | null;
  };
}

// センサーイベントハンドラー
export type GPSCallback = (position: GPSPosition) => void;
export type GPSErrorCallback = (error: GPSError) => void;
export type OrientationCallback = (orientation: DeviceOrientation) => void;
export type MotionCallback = (motion: DeviceMotion) => void;