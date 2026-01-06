import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { getSensorManager } from '../../services/sensors/SensorManager';
import type { SensorStatus } from '../../types/sensors';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMapMarkerAlt, FaCompass, FaWalking, FaCheck, FaInfoCircle, FaCamera } from 'react-icons/fa';

interface SensorPermissionRequestProps {
  onPermissionsGranted: () => void;
  onPermissionsDenied?: (errors: string[]) => void;
}

export default function SensorPermissionRequest({
  onPermissionsGranted,
  onPermissionsDenied, // used for future error handling
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

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, ease: 'easeOut' as const }
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  // 一部でも許可されているかチェック
  const hasSomePermission =
    sensorStatus.orientation.permission === 'granted' ||
    sensorStatus.camera.permission === 'granted' ||
    sensorStatus.motion.permission === 'granted';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 20000, // 最前面 (Map UIは10000なのでそれより上にする)
          fontFamily: 'sans-serif',
        }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '380px',
            width: '90%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <motion.h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '22px',
                fontWeight: '800',
                color: '#1a202c',
                letterSpacing: '-0.02em'
              }}
            >
              センサー許可
            </motion.h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#718096', lineHeight: '1.6' }}>
              没入感のあるAR体験のために、<br />デバイスセンサーの許可をお願いします。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {/* GPS */}
            <PermissionItem
              icon={<FaMapMarkerAlt size={20} />}
              title="位置情報"
              description="現在地周辺の景色を表示"
              status={sensorStatus.gps}
              onClick={requestGPSPermission}
              isRequesting={isRequesting}
            />

            {/* Camera */}
            <PermissionItem
              icon={<FaCamera size={20} />}
              title="カメラ"
              description="AR背景として使用"
              status={sensorStatus.camera}
              onClick={requestCameraPermission}
              isRequesting={isRequesting}
            />

            {/* Orientation */}
            <PermissionItem
              icon={<FaCompass size={20} />}
              title="デバイスの方位"
              description="向いている方向の景色と連動"
              status={sensorStatus.orientation}
              onClick={requestOrientationPermission}
              isRequesting={isRequesting}
            />

            {/* Motion */}
            <PermissionItem
              icon={<FaWalking size={20} />}
              title="モーション"
              description="移動や傾きをより正確に反映"
              status={sensorStatus.motion}
              onClick={requestMotionPermission}
              isRequesting={isRequesting}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 全て許可ボタンは自動遷移するため削除、代わりにスキップを目立たないように配置 */}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={skipPermissions}
              disabled={isRequesting}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: hasSomePermission ? '#3182CE' : '#EDF2F7',
                color: hasSomePermission ? 'white' : '#4A5568',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isRequesting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {hasSomePermission ? '開始する' : '許可せずに開始'}
            </motion.button>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'none',
                border: 'none',
                color: '#A0AEC0',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              <FaInfoCircle /> プライバシーについて
            </button>
          </div>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: '#F7FAFC',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#718096',
                  lineHeight: '1.6'
                }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    データはデバイス内でのみ処理され、外部サーバーには送信されません。
                    設定からいつでも変更可能です。
                  </p>
                  {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                    <p style={{ margin: 0, color: '#D69E2E', fontWeight: 'bold' }}>
                      ⚠️ iOSの場合、各項目の「許可」ボタンを直接タップしてください。
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
  isRequesting
}: {
  icon: React.ReactNode,
  title: string,
  description: string,
  status: { available: boolean; permission: string | PermissionState },
  onClick: () => void,
  isRequesting: boolean
}) {
  const isGranted = status.permission === 'granted';
  const isDenied = status.permission === 'denied';

  if (!status.available) return null;

  return (
    <motion.div
      whileTap={!isGranted && !isDenied ? { scale: 0.98 } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: isGranted ? '#F0FFF4' : '#FFFFFF',
        borderRadius: '16px',
        border: isGranted ? '1px solid #C6F6D5' : '1px solid #E2E8F0',
        cursor: !isGranted && !isDenied ? 'pointer' : 'default',
        boxShadow: isGranted ? 'none' : '0 2px 4px rgba(0,0,0,0.02)',
        transition: 'all 0.2s',
      }}
      onClick={!isGranted && !isDenied && !isRequesting ? onClick : undefined}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        backgroundColor: isGranted ? '#C6F6D5' : '#EBF8FF', // 緑 or 青
        color: isGranted ? '#2F855A' : '#3182CE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '16px',
        flexShrink: 0
      }}>
        {isGranted ? <FaCheck size={18} /> : icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '700', color: isGranted ? '#22543D' : '#2D3748' }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: isGranted ? '#48BB78' : '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isGranted ? '許可済み' : description}
        </p>
      </div>

      <div style={{ marginLeft: '12px' }}>
        {isGranted ? (
          // チェックマークのみ
          null
        ) : isDenied ? (
          <span style={{ fontSize: '12px', color: '#E53E3E', fontWeight: 'bold' }}>拒否</span>
        ) : (
          <motion.div
            style={{
              padding: '6px 16px',
              backgroundColor: '#3182CE',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(49, 130, 206, 0.3)',
            }}
          >
            許可
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
