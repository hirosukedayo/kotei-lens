import { useCallback, useEffect, useState } from 'react';
import { getSensorManager } from '../services/sensors/SensorManager';
import type { DeviceMotion, DeviceOrientation, GPSPosition } from '../types/sensors';

interface SensorData {
  gps: GPSPosition | null;
  orientation: DeviceOrientation | null;
  motion: DeviceMotion | null;
  isWalking: boolean;
  compassHeading: number | null;
}

// SensorManager経由でサービスにアクセスするため、このインターフェースは不要

export function useSensors() {
  const [sensorData, setSensorData] = useState<SensorData>({
    gps: null,
    orientation: null,
    motion: null,
    isWalking: false,
    compassHeading: null,
  });

  // SensorManagerのシングルトンインスタンスを使用
  const sensorManager = getSensorManager();

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
      const compassHeading = sensorManager.orientationService.getCompassHeading(orientation);
      console.log('方位更新:', orientation, 'コンパス:', compassHeading);
      setSensorData((prev) => ({
        ...prev,
        orientation,
        compassHeading,
      }));
    },
    [sensorManager.orientationService]
  );

  // モーション コールバック
  const handleMotionUpdate = useCallback(
    (motion: DeviceMotion) => {
      const isWalking = sensorManager.motionService.detectWalking(motion);
      setSensorData((prev) => ({
        ...prev,
        motion,
        isWalking,
      }));
    },
    [sensorManager.motionService]
  );

  // センサー開始
  const startSensors = useCallback(async () => {
    if (isActive) {
      console.log('センサーは既にアクティブです');
      return;
    }

    console.log('センサー開始を試行中...', {
      gpsAvailable: sensorManager.locationService.isAvailable(),
      orientationAvailable: sensorManager.orientationService.isAvailable(),  
      motionAvailable: sensorManager.motionService.isAvailable(),
    });

    try {
      let startedCount = 0;
      
      // GPS開始
      if (sensorManager.locationService.isAvailable()) {
        console.log('GPS開始を試行中...');
        try {
          sensorManager.locationService.startWatching(handleGPSUpdate, handleGPSError);
          console.log('GPS監視開始完了');
          startedCount++;
        } catch (gpsError) {
          console.error('GPS開始エラー:', gpsError);
        }
      } else {
        console.warn('GPS未対応');
      }

      // 方位センサー開始
      if (sensorManager.orientationService.isAvailable()) {
        console.log('方位センサー開始を試行中...');
        try {
          await sensorManager.orientationService.startTracking(handleOrientationUpdate);
          console.log('方位センサー開始完了');
          startedCount++;
        } catch (orientationError) {
          console.error('方位センサー開始エラー:', orientationError);
        }
      } else {
        console.warn('方位センサー未対応');
      }

      // モーションセンサー開始
      if (sensorManager.motionService.isAvailable()) {
        console.log('モーションセンサー開始を試行中...');
        try {
          await sensorManager.motionService.startTracking(handleMotionUpdate);
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
  }, [isActive, sensorManager, handleGPSUpdate, handleGPSError, handleOrientationUpdate, handleMotionUpdate, sensorData]);

  // センサー停止
  const stopSensors = useCallback(() => {
    if (!isActive) return;

    sensorManager.locationService.stopWatching();
    sensorManager.orientationService.stopTracking();
    sensorManager.motionService.stopTracking();

    setIsActive(false);
  }, [isActive, sensorManager]);

  // テスト用：モック位置データ設定
  const setMockLocation = useCallback(() => {
    const mockPosition = sensorManager.locationService.getMockPosition();
    setSensorData((prev) => ({ ...prev, gps: mockPosition }));
  }, [sensorManager.locationService]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopSensors();
      // シングルトンなので個別のdisposeは行わない
      // sensorManager.dispose() は必要に応じて別途実行
    };
  }, [stopSensors]);

  return {
    sensorData,
    isActive,
    startSensors,
    stopSensors,
    setMockLocation,
    sensorManager,
  };
}
