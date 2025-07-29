import React, { useState, useEffect } from 'react';
import { LocationService } from '../../services/sensors/LocationService';
import { MotionService } from '../../services/sensors/MotionService';
import { OrientationService } from '../../services/sensors/OrientationService';
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

  useEffect(() => {
    checkSensorAvailability();
  }, []);

  const checkSensorAvailability = async () => {
    const locationService = new LocationService();
    const orientationService = new OrientationService();
    const motionService = new MotionService();

    const newStatus: SensorStatus = {
      gps: {
        available: locationService.isAvailable(),
        permission: await locationService.checkPermission(),
        lastUpdate: null,
        error: null,
      },
      orientation: {
        available: orientationService.isAvailable(),
        permission: 'prompt', // 初期状態
        lastUpdate: null,
        error: null,
      },
      motion: {
        available: motionService.isAvailable(),
        permission: 'prompt', // 初期状態
        lastUpdate: null,
        error: null,
      },
    };

    setSensorStatus(newStatus);
  };

  const requestAllPermissions = async () => {
    setIsRequesting(true);
    const errors: string[] = [];

    try {
      // 順次許可要求（iOS対応）
      // 1. GPS許可要求
      if (sensorStatus.gps.available) {
        try {
          const locationService = new LocationService();
          await locationService.getCurrentPosition();
          setSensorStatus((prev) => ({
            ...prev,
            gps: { ...prev.gps, permission: 'granted' },
          }));
        } catch (error) {
          console.warn('GPS permission failed:', error);
          errors.push('位置情報の取得に失敗しました');
          setSensorStatus((prev) => ({
            ...prev,
            gps: { ...prev.gps, permission: 'denied', error: { code: 0, message: String(error), timestamp: Date.now() } },
          }));
        }
      }

      // 2. デバイス方位許可要求（少し待ってから実行）
      if (sensorStatus.orientation.available) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // iOS用ディレイ
        try {
          const orientationService = new OrientationService();
          const permission = await orientationService.requestPermission();
          setSensorStatus((prev) => ({
            ...prev,
            orientation: { ...prev.orientation, permission },
          }));
          if (permission === 'denied') {
            errors.push(
              'デバイス方位センサーの許可が拒否されました。アドレスバー横の🔒をタップ → Webサイトの設定 → モーションと画面の向きへのアクセス を許可に変更してください。'
            );
          }
        } catch (error) {
          console.warn('Orientation permission failed:', error);
          errors.push('デバイス方位センサーの許可要求に失敗しました');
          setSensorStatus((prev) => ({
            ...prev,
            orientation: { ...prev.orientation, permission: 'denied', error: String(error) },
          }));
        }
      }

      // 3. デバイスモーション許可要求（少し待ってから実行）
      if (sensorStatus.motion.available) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // iOS用ディレイ
        try {
          const motionService = new MotionService();
          const permission = await motionService.requestPermission();
          setSensorStatus((prev) => ({
            ...prev,
            motion: { ...prev.motion, permission },
          }));
          if (permission === 'denied') {
            errors.push(
              'デバイスモーションセンサーの許可が拒否されました。アドレスバー横の🔒をタップ → Webサイトの設定 → モーションと画面の向きへのアクセス を許可に変更してください。'
            );
          }
        } catch (error) {
          console.warn('Motion permission failed:', error);
          errors.push('デバイスモーションセンサーの許可要求に失敗しました');
          setSensorStatus((prev) => ({
            ...prev,
            motion: { ...prev.motion, permission: 'denied', error: String(error) },
          }));
        }
      }

      if (errors.length === 0) {
        onPermissionsGranted();
      } else {
        onPermissionsDenied(errors);
      }
    } finally {
      setIsRequesting(false);
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
          padding: '30px',
          maxWidth: '400px',
          width: '90%',
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
          湖底レンズでは、より良い体験のために以下のセンサーを使用します：
        </p>

        {/* iOS用の特別な注意書き */}
        {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
          <div
            style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#856404',
              lineHeight: '1.4',
            }}
          >
            <strong>📱 iOS をお使いの方へ:</strong>
            <br />
            <div style={{ marginTop: '8px' }}>
              <strong>⚠️ 重要:</strong> センサー許可はユーザーの操作（タップ）が必要です。
              <br />
              <strong>1.</strong> 下の「センサーを許可する」ボタンを必ずタップしてください
              <br />
              <strong>2.</strong> 許可ダイアログが表示されない場合：
              <br />
              　　• アドレスバー横の「🔒」または「ⓐA」をタップ
              <br />
              　　• 「Webサイトの設定」を開く
              <br />
              　　• 「モーションと画面の向きへのアクセス」を許可に変更
              <br />
              <strong>3.</strong> プライベートブラウズモードでは動作しません
              <br />
              <strong>4.</strong> iOS 14.5+ では個別のWebサイト許可が必要です
            </div>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '20px', marginRight: '12px' }}>
              {getStatusIcon(sensorStatus.gps.permission, sensorStatus.gps.available)}
            </span>
            <div style={{ flex: 1 }}>
              <strong>📍 位置情報 (GPS)</strong>
              <div style={{ fontSize: '12px', color: '#666' }}>現在地の特定とナビゲーション</div>
            </div>
            <span style={{ fontSize: '12px', color: '#888' }}>
              {getStatusText(sensorStatus.gps.permission, sensorStatus.gps.available)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '8px',
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
            <span style={{ fontSize: '12px', color: '#888' }}>
              {getStatusText(
                sensorStatus.orientation.permission,
                sensorStatus.orientation.available
              )}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
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
            <span style={{ fontSize: '12px', color: '#888' }}>
              {getStatusText(sensorStatus.motion.permission, sensorStatus.motion.available)}
            </span>
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
            onClick={requestAllPermissions}
            disabled={isRequesting}
            style={{
              backgroundColor: '#2B6CB0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isRequesting ? 'not-allowed' : 'pointer',
              opacity: isRequesting ? 0.7 : 1,
            }}
          >
            {isRequesting ? '許可要求中...' : 'センサーを許可する'}
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
            許可をスキップして続行
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
