import React, { useState, useEffect, useCallback } from 'react';
import { getSensorManager } from '../../services/sensors/SensorManager';
import type { SensorStatus } from '../../types/sensors';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMapMarkerAlt, FaCompass, FaWalking, FaCheck, FaTimes, FaQuestion, FaInfoCircle } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';

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

  const checkSensorAvailability = useCallback(async () => {
    // OrientationServiceのキャッシュされた状態を確認
    const orientationPermission = sensorManager.orientationService.getPermissionState?.() || 'unknown';

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
        permission: 'prompt', // Motionは明示的なAPIがない場合が多いが一旦prompt
        lastUpdate: null,
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

    if (isGpsOk && isOrientationOk && isMotionOk) {
      // 少し遅延させてアニメーションを見せる余韻を残す
      const timer = setTimeout(() => {
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
      setSensorStatus((prev) => ({
        ...prev,
        gps: {
          ...prev.gps,
          permission: 'denied',
          error: { code: 0, message: String(error), timestamp: Date.now() },
        },
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

  const skipPermissions = () => {
    onPermissionsGranted();
  };

  const getStatusIcon = (permission: string, available: boolean) => {
    if (!available) return <FaTimes className="text-gray-400" />;
    switch (permission) {
      case 'granted':
        return <FaCheck className="text-green-500" />;
      case 'denied':
        return <FaTimes className="text-red-500" />;
      case 'prompt':
      default:
        return <FaQuestion className="text-yellow-500" />;
    }
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

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

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
          zIndex: 9999, // 最前面
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
                backgroundColor: '#EDF2F7',
                color: '#4A5568',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isRequesting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              許可せずに開始
            </motion.button>

            <button
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
