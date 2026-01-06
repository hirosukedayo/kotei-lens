import { useCallback, useEffect, useState, useRef } from 'react';
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
  const isActiveRef = useRef(false);

  // isActiveのstate同期用
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const startSensors = useCallback(async (force = false, autoRequest = false) => {
    if (isActiveRef.current && !force) {
      // 既にアクティブならログを出さずに終了（無限ループ防止）
      return;
    }

    console.log('センサー開始を試行中...', {
      force,
      autoRequest,
      gpsAvailable: sensorManager.locationService.isAvailable(),
      orientationAvailable: sensorManager.orientationService.isAvailable(),
      motionAvailable: sensorManager.motionService.isAvailable(),
    });

    try {
      let startedCount = 0;

      // GPS開始
      if (sensorManager.locationService.isAvailable()) {
        try {
          sensorManager.locationService.startWatching(handleGPSUpdate, handleGPSError);
          startedCount++;
        } catch (gpsError) {
          console.error('GPS開始エラー:', gpsError);
        }
      }

      // 方位センサー開始
      if (sensorManager.orientationService.isAvailable()) {
        try {
          // autoRequest引数を利用。forceRestart時は通常trueを渡す想定だが、
          // 初回ロード時は false を渡す。
          await sensorManager.orientationService.startTracking(handleOrientationUpdate, autoRequest);
          startedCount++;
        } catch (orientationError) {
          console.error('方位センサー開始エラー:', orientationError);
        }
      }

      // モーションセンサー開始
      if (sensorManager.motionService.isAvailable()) {
        try {
          await sensorManager.motionService.startTracking(handleMotionUpdate);
          startedCount++;
        } catch (motionError) {
          console.error('モーションセンサー開始エラー:', motionError);
        }
      }

      setIsActive(true);
      isActiveRef.current = true;
      console.log(`センサー開始完了: ${startedCount}個のセンサーが開始されました`);

      // 5秒後にデータ受信状況をチェック (StateではなくManagerから直接最新値を取得)
      setTimeout(() => {
        const status = sensorManager.getStatus();
        console.log('5秒後のセンサーデータ状況:', {
          gps: status.location.watching ? '監視中' : '停止',
          orientation: status.orientation.tracking ? '監視中' : '停止',
        });
      }, 5000);
    } catch (error) {
      console.error('センサー開始エラー:', error);
    }
  }, [
    sensorManager,
    handleGPSUpdate,
    handleGPSError,
    handleOrientationUpdate,
    handleMotionUpdate,
  ]);

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
