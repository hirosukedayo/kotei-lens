import { useCallback, useEffect, useState } from 'react';
import { LocationService } from '../services/sensors/LocationService';
import { MotionService } from '../services/sensors/MotionService';
import { OrientationService } from '../services/sensors/OrientationService';
import type { DeviceMotion, DeviceOrientation, GPSPosition } from '../types/sensors';

interface SensorData {
  gps: GPSPosition | null;
  orientation: DeviceOrientation | null;
  motion: DeviceMotion | null;
  isWalking: boolean;
  compassHeading: number | null;
}

interface SensorServices {
  location: LocationService;
  orientation: OrientationService;
  motion: MotionService;
}

export function useSensors() {
  const [sensorData, setSensorData] = useState<SensorData>({
    gps: null,
    orientation: null,
    motion: null,
    isWalking: false,
    compassHeading: null,
  });

  const [services] = useState<SensorServices>(() => ({
    location: new LocationService(),
    orientation: new OrientationService(),
    motion: new MotionService(),
  }));

  const [isActive, setIsActive] = useState(false);

  // GPS コールバック
  const handleGPSUpdate = useCallback((position: GPSPosition) => {
    setSensorData((prev) => ({ ...prev, gps: position }));
  }, []);

  // GPS エラーコールバック
  const handleGPSError = useCallback((error: any) => {
    console.warn('GPS error:', error);
  }, []);

  // 方位 コールバック
  const handleOrientationUpdate = useCallback(
    (orientation: DeviceOrientation) => {
      const compassHeading = services.orientation.getCompassHeading(orientation);
      setSensorData((prev) => ({
        ...prev,
        orientation,
        compassHeading,
      }));
    },
    [services.orientation]
  );

  // モーション コールバック
  const handleMotionUpdate = useCallback(
    (motion: DeviceMotion) => {
      const isWalking = services.motion.detectWalking(motion);
      setSensorData((prev) => ({
        ...prev,
        motion,
        isWalking,
      }));
    },
    [services.motion]
  );

  // センサー開始
  const startSensors = useCallback(async () => {
    if (isActive) return;

    try {
      // GPS開始
      if (services.location.isAvailable()) {
        services.location.startWatching(handleGPSUpdate, handleGPSError);
      }

      // 方位センサー開始
      if (services.orientation.isAvailable()) {
        await services.orientation.startTracking(handleOrientationUpdate);
      }

      // モーションセンサー開始
      if (services.motion.isAvailable()) {
        await services.motion.startTracking(handleMotionUpdate);
      }

      setIsActive(true);
    } catch (error) {
      console.error('センサー開始エラー:', error);
    }
  }, [isActive, services, handleGPSUpdate, handleGPSError, handleOrientationUpdate, handleMotionUpdate]);

  // センサー停止
  const stopSensors = useCallback(() => {
    if (!isActive) return;

    services.location.stopWatching();
    services.orientation.stopTracking();
    services.motion.stopTracking();

    setIsActive(false);
  }, [isActive, services]);

  // テスト用：モック位置データ設定
  const setMockLocation = useCallback(() => {
    const mockPosition = services.location.getMockPosition();
    setSensorData((prev) => ({ ...prev, gps: mockPosition }));
  }, [services.location]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopSensors();
      services.location.dispose();
      services.orientation.dispose();
      services.motion.dispose();
    };
  }, [stopSensors, services]);

  return {
    sensorData,
    isActive,
    startSensors,
    stopSensors,
    setMockLocation,
    services,
  };
}
