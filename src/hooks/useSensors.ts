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
    console.log('GPS更新:', position);
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
      console.log('方位更新:', orientation, 'コンパス:', compassHeading);
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
    if (isActive) {
      console.log('センサーは既にアクティブです');
      return;
    }

    console.log('センサー開始を試行中...', {
      gpsAvailable: services.location.isAvailable(),
      orientationAvailable: services.orientation.isAvailable(),  
      motionAvailable: services.motion.isAvailable(),
    });

    try {
      let startedCount = 0;
      
      // GPS開始
      if (services.location.isAvailable()) {
        console.log('GPS開始を試行中...');
        try {
          services.location.startWatching(handleGPSUpdate, handleGPSError);
          console.log('GPS監視開始完了');
          startedCount++;
        } catch (gpsError) {
          console.error('GPS開始エラー:', gpsError);
        }
      } else {
        console.warn('GPS未対応');
      }

      // 方位センサー開始
      if (services.orientation.isAvailable()) {
        console.log('方位センサー開始を試行中...');
        try {
          await services.orientation.startTracking(handleOrientationUpdate);
          console.log('方位センサー開始完了');
          startedCount++;
        } catch (orientationError) {
          console.error('方位センサー開始エラー:', orientationError);
        }
      } else {
        console.warn('方位センサー未対応');
      }

      // モーションセンサー開始
      if (services.motion.isAvailable()) {
        console.log('モーションセンサー開始を試行中...');
        try {
          await services.motion.startTracking(handleMotionUpdate);
          console.log('モーションセンサー開始完了');
          startedCount++;
        } catch (motionError) {
          console.error('モーションセンサー開始エラー:', motionError);
        }
      } else {
        console.warn('モーションセンサー未対応');
      }

      setIsActive(true);
      console.log(`センサー開始完了: ${startedCount}個のセンサーが開始されました`);
      
      // 5秒後にデータ受信状況をチェック
      setTimeout(() => {
        console.log('5秒後のセンサーデータ状況:', {
          gps: sensorData.gps ? '取得済み' : '未取得',
          orientation: sensorData.orientation ? '取得済み' : '未取得',
          motion: sensorData.motion ? '取得済み' : '未取得',
        });
      }, 5000);
      
    } catch (error) {
      console.error('センサー開始エラー:', error);
    }
  }, [isActive, services, handleGPSUpdate, handleGPSError, handleOrientationUpdate, handleMotionUpdate, sensorData]);

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
