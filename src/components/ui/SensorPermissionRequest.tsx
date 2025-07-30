import React, { useState, useEffect } from 'react';
import { getSensorManager } from '../../services/sensors/SensorManager';
import type { SensorStatus } from '../../types/sensors';

interface SensorPermissionRequestProps {
  onPermissionsGranted: () => void;
  onPermissionsDenied: (errors: string[]) => void;
}

export default function SensorPermissionRequest({
  onPermissionsGranted,
  onPermissionsDenied,
}: SensorPermissionRequestProps) {
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    gps: { available: false, permission: 'unknown', lastUpdate: null, error: null },
    orientation: { available: false, permission: 'unknown', lastUpdate: null, error: null },
    motion: { available: false, permission: 'unknown', lastUpdate: null, error: null },
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // SensorManagerのシングルトンインスタンスを使用
  const sensorManager = getSensorManager();

  useEffect(() => {
    checkSensorAvailability();
  }, []);

  const checkSensorAvailability = async () => {
    const newStatus: SensorStatus = {
      gps: {
        available: sensorManager.locationService.isAvailable(),
        permission: await sensorManager.locationService.checkPermission(),
        lastUpdate: null,
        error: null,
      },
      orientation: {
        available: sensorManager.orientationService.isAvailable(),
        permission: 'prompt', // 初期状態
        lastUpdate: null,
        error: null,
      },
      motion: {
        available: sensorManager.motionService.isAvailable(),
        permission: 'prompt', // 初期状態
        lastUpdate: null,
        error: null,
      },
    };

    setSensorStatus(newStatus);
  };

  const requestGPSPermission = async () => {
    if (!sensorStatus.gps.available) return;
    
    setIsRequesting(true);
    try {
      // GeolocationAPIの許可を実際に要求するため、getCurrentPositionを呼び出す
      // これによりブラウザの位置許可ダイアログが表示される
      await sensorManager.locationService.getCurrentPosition();
      
      setSensorStatus((prev) => ({
        ...prev,
        gps: { ...prev.gps, permission: 'granted' },
      }));
    } catch (error) {
      setSensorStatus((prev) => ({
        ...prev,
        gps: { ...prev.gps, permission: 'denied', error: { code: 0, message: String(error), timestamp: Date.now() } },
      }));
    } finally {
      setIsRequesting(false);
    }
  };

  const requestOrientationPermission = async () => {
    if (!sensorStatus.orientation.available) return;
    
    setIsRequesting(true);
    try {
      const permission = await sensorManager.orientationService.requestPermission();
      
      // テストは削除 - useSensorsで実際の利用時に行う
      setSensorStatus((prev) => ({
        ...prev,
        orientation: { ...prev.orientation, permission },
      }));
    } catch (error) {
      setSensorStatus((prev) => ({
        ...prev,
        orientation: { ...prev.orientation, permission: 'denied', error: String(error) },
      }));
    } finally {
      setIsRequesting(false);
    }
  };

  const requestMotionPermission = async () => {
    if (!sensorStatus.motion.available) return;
    
    setIsRequesting(true);
    try {
      const permission = await sensorManager.motionService.requestPermission();
      
      // テストは削除 - useSensorsで実際の利用時に行う
      setSensorStatus((prev) => ({
        ...prev,
        motion: { ...prev.motion, permission },
      }));
    } catch (error) {
      setSensorStatus((prev) => ({
        ...prev,
        motion: { ...prev.motion, permission: 'denied', error: String(error) },
      }));
    } finally {
      setIsRequesting(false);
    }
  };

  const checkAllPermissions = () => {
    const grantedCount = [
      sensorStatus.gps.permission === 'granted',
      sensorStatus.orientation.permission === 'granted', 
      sensorStatus.motion.permission === 'granted'
    ].filter(Boolean).length;

    if (grantedCount === 3) {
      onPermissionsGranted();
    } else if (grantedCount > 0) {
      // 部分的に許可されている場合も続行可能
      onPermissionsGranted();
    }
  };

  const skipPermissions = () => {
    onPermissionsGranted(); // 許可なしでも続行
  };

  const getStatusIcon = (permission: string, available: boolean) => {
    if (!available) return '❌';
    switch (permission) {
      case 'granted':
        return '✅';
      case 'denied':
        return '🚫';
      case 'prompt':
        return '❓';
      default:
        return '⏳';
    }
  };

  const getStatusText = (permission: string, available: boolean) => {
    if (!available) return '未対応';
    switch (permission) {
      case 'granted':
        return '許可済み';
      case 'denied':
        return '拒否';
      case 'prompt':
        return '許可待ち';
      default:
        return '確認中';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        fontFamily: 'Noto Sans JP, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2
          style={{
            color: '#2B6CB0',
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '24px',
          }}
        >
          センサー許可の要求
        </h2>

        <p
          style={{
            color: '#666',
            textAlign: 'center',
            marginBottom: '15px',
            lineHeight: '1.6',
          }}
        >
          各センサーの「許可する」ボタンをタップして、必要な機能を有効にしてください：
        </p>

        {/* iOS用の簡潔な注意書き */}
        {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
          <div
            style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '15px',
              fontSize: '12px',
              color: '#856404',
              lineHeight: '1.3',
            }}
          >
            <strong>📱 iOS:</strong> 各「許可する」ボタンを個別タップ。
            ダイアログが出ない場合はアドレスバー横の🔒から「モーションと画面の向きへのアクセス」を許可に変更。
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          {/* GPS許可セクション */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '20px', marginRight: '12px' }}>
              {getStatusIcon(sensorStatus.gps.permission, sensorStatus.gps.available)}
            </span>
            <div style={{ flex: 1 }}>
              <strong>📍 位置情報 (GPS)</strong>
              <div style={{ fontSize: '12px', color: '#666' }}>現在地の特定とナビゲーション</div>
            </div>
            <button
              type="button"
              onClick={requestGPSPermission}
              disabled={!sensorStatus.gps.available || isRequesting || sensorStatus.gps.permission === 'granted'}
              style={{
                backgroundColor: sensorStatus.gps.permission === 'granted' ? '#4CAF50' : '#2B6CB0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: (!sensorStatus.gps.available || isRequesting || sensorStatus.gps.permission === 'granted') ? 'not-allowed' : 'pointer',
                opacity: (!sensorStatus.gps.available || isRequesting) ? 0.6 : 1,
              }}
            >
              {sensorStatus.gps.permission === 'granted' ? '許可済み' : '許可する'}
            </button>
          </div>

          {/* デバイス方位許可セクション */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '20px', marginRight: '12px' }}>
              {getStatusIcon(
                sensorStatus.orientation.permission,
                sensorStatus.orientation.available
              )}
            </span>
            <div style={{ flex: 1 }}>
              <strong>🧭 デバイス方位</strong>
              <div style={{ fontSize: '12px', color: '#666' }}>向いている方向の建物表示</div>
            </div>
            <button
              type="button"
              onClick={requestOrientationPermission}
              disabled={!sensorStatus.orientation.available || isRequesting || sensorStatus.orientation.permission === 'granted'}
              style={{
                backgroundColor: sensorStatus.orientation.permission === 'granted' ? '#4CAF50' : '#2B6CB0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: (!sensorStatus.orientation.available || isRequesting || sensorStatus.orientation.permission === 'granted') ? 'not-allowed' : 'pointer',
                opacity: (!sensorStatus.orientation.available || isRequesting) ? 0.6 : 1,
              }}
            >
              {sensorStatus.orientation.permission === 'granted' ? '許可済み' : '許可する'}
            </button>
          </div>

          {/* デバイスモーション許可セクション */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '15px',
            }}
          >
            <span style={{ fontSize: '20px', marginRight: '12px' }}>
              {getStatusIcon(sensorStatus.motion.permission, sensorStatus.motion.available)}
            </span>
            <div style={{ flex: 1 }}>
              <strong>📱 デバイスモーション</strong>
              <div style={{ fontSize: '12px', color: '#666' }}>歩行検知と操作向上</div>
            </div>
            <button
              type="button"
              onClick={requestMotionPermission}
              disabled={!sensorStatus.motion.available || isRequesting || sensorStatus.motion.permission === 'granted'}
              style={{
                backgroundColor: sensorStatus.motion.permission === 'granted' ? '#4CAF50' : '#2B6CB0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: (!sensorStatus.motion.available || isRequesting || sensorStatus.motion.permission === 'granted') ? 'not-allowed' : 'pointer',
                opacity: (!sensorStatus.motion.available || isRequesting) ? 0.6 : 1,
              }}
            >
              {sensorStatus.motion.permission === 'granted' ? '許可済み' : '許可する'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <button
            type="button"
            onClick={checkAllPermissions}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            アプリを開始
          </button>

          <button
            type="button"
            onClick={skipPermissions}
            disabled={isRequesting}
            style={{
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: isRequesting ? 'not-allowed' : 'pointer',
              opacity: isRequesting ? 0.7 : 1,
            }}
          >
            センサーなしで続行
          </button>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              backgroundColor: 'transparent',
              color: '#2B6CB0',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDetails ? '詳細を隠す' : '詳細情報を表示'}
          </button>
        </div>

        {showDetails && (
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#666',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0' }}>プライバシーについて</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>位置情報はデバイス内でのみ処理され、外部に送信されません</li>
              <li>センサーデータは3D表示の向上のみに使用されます</li>
              <li>いつでも設定から許可を取り消すことができます</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
