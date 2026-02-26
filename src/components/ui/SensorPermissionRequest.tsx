import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { getSensorManager } from '../../services/sensors/SensorManager';
import type { SensorStatus } from '../../types/sensors';
import { AnimatePresence, motion } from 'framer-motion';
import { FaMapMarkerAlt, FaCompass, FaWalking, FaCheck, FaInfoCircle, FaCamera } from 'react-icons/fa';

interface SensorPermissionRequestProps {
  onPermissionsGranted: () => void;
  onPermissionsDenied?: (errors: string[]) => void;
  onCancel?: () => void;
}

export default function SensorPermissionRequest({
  onPermissionsGranted,
  onPermissionsDenied, // used for future error handling
  onCancel,
}: SensorPermissionRequestProps) {
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    gps: { available: false, permission: 'unknown', lastUpdate: null, error: null },
    orientation: { available: false, permission: 'unknown', lastUpdate: null, error: null },
    motion: { available: false, permission: 'unknown', lastUpdate: null, error: null },
    camera: { available: true, permission: 'unknown', error: null }, // カメラは基本ある前提
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // SensorManagerのシングルトンインスタンスを使用
  const sensorManager = getSensorManager();

  const checkSensorAvailability = useCallback(async () => {
    // OrientationServiceのキャッシュされた状態を確認
    const orientationPermission = sensorManager.orientationService.getPermissionState?.() || 'unknown';

    // カメラの権限チェック (Permissions API)
    let cameraPerm: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
    try {
      // standard types might not include 'camera' yet
      const result = await navigator.permissions.query({ name: 'camera' as any });
      if (result.state === 'granted') cameraPerm = 'granted';
      else if (result.state === 'denied') cameraPerm = 'denied';
      else cameraPerm = 'prompt';
    } catch {
      // Permissions API not supported for camera or error
      cameraPerm = 'prompt';
    }

    const newStatus: SensorStatus = {
      gps: {
        available: sensorManager.locationService.isAvailable(),
        permission: await sensorManager.locationService.checkPermission(),
        lastUpdate: null,
        error: null,
      },
      orientation: {
        available: sensorManager.orientationService.isAvailable(),
        permission: orientationPermission === 'granted' ? 'granted' : 'prompt',
        lastUpdate: null,
        error: null,
      },
      motion: {
        available: sensorManager.motionService.isAvailable(),
        permission: 'prompt',
        lastUpdate: null,
        error: null,
      },
      camera: {
        available: !!(navigator.mediaDevices?.getUserMedia),
        permission: cameraPerm,
        error: null,
      },
    };

    setSensorStatus(newStatus);
  }, [sensorManager]);

  useEffect(() => {
    checkSensorAvailability();
  }, [checkSensorAvailability]);

  // 全許可チェック
  useEffect(() => {
    const isGpsOk = !sensorStatus.gps.available || sensorStatus.gps.permission === 'granted';
    const isOrientationOk = !sensorStatus.orientation.available || sensorStatus.orientation.permission === 'granted';
    const isMotionOk = !sensorStatus.motion.available || sensorStatus.motion.permission === 'granted';
    const isCameraOk = !sensorStatus.camera.available || sensorStatus.camera.permission === 'granted';

    console.log('Permission check:', { isGpsOk, isOrientationOk, isMotionOk, isCameraOk });

    if (isGpsOk && isOrientationOk && isMotionOk && isCameraOk) {
      const timer = setTimeout(() => {
        console.log('All permissions granted, auto-proceeding');
        onPermissionsGranted();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sensorStatus, onPermissionsGranted]);

  const requestGPSPermission = async () => {
    if (!sensorStatus.gps.available) return;

    setIsRequesting(true);
    try {
      await sensorManager.locationService.getCurrentPosition();
      setSensorStatus((prev) => ({
        ...prev,
        gps: { ...prev.gps, permission: 'granted' },
      }));
    } catch (error) {
      const errMsg = String(error);
      setSensorStatus((prev) => ({
        ...prev,
        gps: {
          ...prev.gps,
          permission: 'denied',
          error: { code: 0, message: errMsg, timestamp: Date.now() },
        },
      }));
      onPermissionsDenied?.([errMsg]);
    } finally {
      setIsRequesting(false);
    }
  };

  const requestOrientationPermission = async () => {
    if (!sensorStatus.orientation.available) return;

    setIsRequesting(true);
    try {
      const permission = await sensorManager.orientationService.requestPermission();

      // Update orientation status
      const newStatus = {
        ...sensorStatus,
        orientation: { ...sensorStatus.orientation, permission },
      };

      // iOSではOrientationとMotionの権限が連動することが多い
      // Orientationが許可されたら、Motionも自動的にリクエスト(確認)してみる
      if (permission === 'granted' && sensorStatus.motion.available && sensorStatus.motion.permission !== 'granted') {
        try {
          // ユーザーインタラクション内なので、ここでもリクエスト可能
          const motionPermission = await sensorManager.motionService.requestPermission();
          newStatus.motion = { ...newStatus.motion, permission: motionPermission };
          console.log('Auto-requested motion permission result:', motionPermission);
        } catch (e) {
          console.warn('Auto-request motion permission failed:', e);
        }
      }

      setSensorStatus(newStatus);
    } catch (error) {
      const errMsg = String(error);
      setSensorStatus((prev) => ({
        ...prev,
        orientation: { ...prev.orientation, permission: 'denied', error: errMsg },
      }));
      onPermissionsDenied?.([errMsg]);
    } finally {
      setIsRequesting(false);
    }
  };

  const requestMotionPermission = async () => {
    if (!sensorStatus.motion.available) return;

    setIsRequesting(true);
    try {
      const permission = await sensorManager.motionService.requestPermission();
      setSensorStatus((prev) => ({
        ...prev,
        motion: { ...prev.motion, permission },
      }));
    } catch (error) {
      const errMsg = String(error);
      setSensorStatus((prev) => ({
        ...prev,
        motion: { ...prev.motion, permission: 'denied', error: errMsg },
      }));
      onPermissionsDenied?.([errMsg]);
    } finally {
      setIsRequesting(false);
    }
  };

  const requestCameraPermission = async () => {
    if (!sensorStatus.camera.available) return;

    setIsRequesting(true);
    try {
      // 実際にストリームを取得して権限を確認し、すぐに停止する
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      for (const track of stream.getTracks()) {
        track.stop();
      }

      setSensorStatus((prev) => ({
        ...prev,
        camera: { ...prev.camera, permission: 'granted' },
      }));
    } catch (error) {
      const errMsg = String(error);
      setSensorStatus((prev) => ({
        ...prev,
        camera: { ...prev.camera, permission: 'denied', error: errMsg },
      }));
      onPermissionsDenied?.([errMsg]);
    } finally {
      setIsRequesting(false);
    }
  };

  const skipPermissions = () => {
    onPermissionsGranted();
  };

  // 全て許可されているかチェック（利用可能なものに限る）
  const isAllGranted =
    (!sensorStatus.orientation.available || sensorStatus.orientation.permission === 'granted') &&
    (!sensorStatus.camera.available || sensorStatus.camera.permission === 'granted') &&
    (!sensorStatus.motion.available || sensorStatus.motion.permission === 'granted') &&
    (!sensorStatus.gps.available || sensorStatus.gps.permission === 'granted');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 20000,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '32px 28px 24px',
            maxWidth: 'min(380px, 88vw)',
            width: '100%',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
              センサー許可
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
              没入感のあるAR体験のために、
              <br />
              デバイスセンサーの許可をお願いします。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {/* GPS */}
            <PermissionItem
              icon={<FaMapMarkerAlt size={18} />}
              title="位置情報"
              description="現在地周辺の景色を表示"
              status={sensorStatus.gps}
              onClick={requestGPSPermission}
              isRequesting={isRequesting}
            />

            {/* Camera */}
            <PermissionItem
              icon={<FaCamera size={18} />}
              title="カメラ"
              description="AR背景として使用"
              status={sensorStatus.camera}
              onClick={requestCameraPermission}
              isRequesting={isRequesting}
            />

            {/* Orientation */}
            <PermissionItem
              icon={<FaCompass size={18} />}
              title="デバイスの方位"
              description="向いている方向の景色と連動"
              status={sensorStatus.orientation}
              onClick={requestOrientationPermission}
              isRequesting={isRequesting}
            />

            {/* Motion */}
            <PermissionItem
              icon={<FaWalking size={18} />}
              title="モーション"
              description="移動や傾きをより正確に反映"
              status={sensorStatus.motion}
              onClick={requestMotionPermission}
              isRequesting={isRequesting}
            />
          </div>

          <button
            type="button"
            className="modal-btn-primary"
            onClick={skipPermissions}
            disabled={isRequesting}
          >
            {isAllGranted ? '開始する' : '許可せずに開始'}
          </button>

          {onCancel && (
            <button
              type="button"
              className="modal-btn-skip"
              onClick={onCancel}
            >
              キャンセル
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              marginTop: 12,
              width: '100%',
              minHeight: 0,
              padding: 0,
            }}
          >
            <FaInfoCircle size={11} /> プライバシーについて
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    background: '#f9fafb',
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#6b7280',
                    lineHeight: 1.7,
                  }}
                >
                  <p style={{ margin: '0 0 6px' }}>
                    データはデバイス内でのみ処理され、外部サーバーには送信されません。
                    設定からいつでも変更可能です。
                  </p>
                  {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                    <p style={{ margin: 0, color: '#f59e0b', fontWeight: 600, fontSize: 11 }}>
                      iOSの場合、各項目の「許可」ボタンを直接タップしてください。
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function PermissionItem({
  icon,
  title,
  description,
  status,
  onClick,
  isRequesting,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: { available: boolean; permission: string | PermissionState };
  onClick: () => void;
  isRequesting: boolean;
}) {
  const isGranted = status.permission === 'granted';
  const isDenied = status.permission === 'denied';

  if (!status.available) return null;

  const isClickable = !isGranted && !isDenied && !isRequesting;

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 14px',
        minHeight: 0,
        background: isGranted ? '#f0fdf4' : '#f9fafb',
        borderRadius: 10,
        border: isGranted ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isGranted ? '#dcfce7' : '#f3f4f6',
          color: isGranted ? '#16a34a' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        {isGranted ? <FaCheck size={14} /> : icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isGranted ? '#166534' : '#111827', lineHeight: 1.4 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: isGranted ? '#16a34a' : '#9ca3af',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isGranted ? '許可済み' : description}
        </div>
      </div>

      <div style={{ marginLeft: 10, flexShrink: 0 }}>
        {isGranted ? null : isDenied ? (
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>拒否</span>
        ) : (
          <div
            style={{
              padding: '5px 14px',
              background: '#111827',
              color: '#ffffff',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            許可
          </div>
        )}
      </div>
    </button>
  );
}
