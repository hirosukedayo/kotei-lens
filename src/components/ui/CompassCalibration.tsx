import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaHandPointer, FaUndo, FaArrowLeft } from 'react-icons/fa';
import { IoCloseOutline } from 'react-icons/io5';
import type { DeviceOrientation } from '../../types/sensors';

interface CompassCalibrationProps {
    onCalibrationComplete: (offset: number) => void;
    onClose?: () => void;
    initialOffset?: number;
    orientation: DeviceOrientation | null;
    compassHeading: number | null;
    allowManualAdjustment?: boolean;
}

type CalibrationStep = 'intro' | 'horizontal' | 'manual' | 'complete';

export default function CompassCalibration({
    onCalibrationComplete,
    onClose,
    initialOffset = 0,
    orientation,
    compassHeading,
    allowManualAdjustment = true,
}: CompassCalibrationProps) {
    // const { sensorData } = useSensors(); // 親からデータを受け取るため削除
    const [step, setStep] = useState<CalibrationStep>('horizontal');
    const [manualOffset, setManualOffset] = useState(initialOffset);
    const [isHorizontal, setIsHorizontal] = useState(false);
    const [stabilityProgress, setStabilityProgress] = useState(0);

    const HORIZONTAL_THRESHOLD = 5;
    const STABILITY_DURATION = 1500;

    const lastTimeRef = useRef<number>(Date.now());
    const stabilityTimerRef = useRef<number>(0);



    // 表示用の累積回転角度（360度境界での逆回転を防ぐため）
    const lastDisplayHeadingRef = useRef(0);
    const [displayHeading, setDisplayHeading] = useState(0);

    // compassHeadingが変わったら、最短経路で回転するように補正値を計算
    useEffect(() => {
        if (compassHeading === null) return;

        // 現在の表示角度（の360剰余をとったものに近い値）
        const currentDisplay = lastDisplayHeadingRef.current;

        // 目標角度 (-compassHeading) ※コンパス盤面は逆回転させる
        // ただし、displayHeadingは累積値なので、目標値も累積値に対応させる必要がある

        // 直感的に: 盤面は「北」が上なので、デバイスが東(90度)を向いたら、盤面は-90度回転してNを左にする。
        // 目標角度
        const targetRotation = -compassHeading;

        // 現在の回転角度（正規化なし）
        const currentRotation = currentDisplay;

        // 差分を計算 (-180 ~ 180)
        let delta = targetRotation - currentRotation;

        // 360度の倍数で補正して最短パスを見つける
        // delta を -180 ~ 180 の範囲に収める
        while (delta <= -180) delta += 360;
        while (delta > 180) delta -= 360;

        const nextRotation = currentRotation + delta;
        lastDisplayHeadingRef.current = nextRotation;
        setDisplayHeading(nextRotation);

    }, [compassHeading]);

    useEffect(() => {
        if (step !== 'horizontal') return;
        // Debug logging
        // Debug logging
        // console.log('[CompassCalibration] Orientation Check:', { ... });

        if (!orientation) return;

        const { beta, gamma } = orientation;
        if (beta === null || gamma === null) return;

        const isFlat = Math.abs(beta) < HORIZONTAL_THRESHOLD && Math.abs(gamma) < HORIZONTAL_THRESHOLD;
        setIsHorizontal(isFlat);

        const now = Date.now();
        const dt = now - lastTimeRef.current;
        lastTimeRef.current = now;

        if (isFlat) {
            stabilityTimerRef.current += dt;
            const progress = Math.min(100, (stabilityTimerRef.current / STABILITY_DURATION) * 100);
            setStabilityProgress(progress);

            if (stabilityTimerRef.current >= STABILITY_DURATION) {
                if (manualOffset !== 0) {
                    setManualOffset(0);
                }
                setStep('complete');
            }
        } else {
            stabilityTimerRef.current = Math.max(0, stabilityTimerRef.current - dt);
            setStabilityProgress((prev) => Math.max(0, prev - (dt / STABILITY_DURATION) * 100));
        }
    }, [orientation, step, manualOffset]);

    const handleManualComplete = () => {
        onCalibrationComplete(manualOffset);
    };

    const handleAutoComplete = () => {
        onCalibrationComplete(0);
    };

    return (
        <>
            {/* Manual Mode: Bottom Panel Only */}
            {step === 'manual' && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        width: '100vw',
                        // 上部は透明にして3Dを見せる
                        height: 'auto',
                        pointerEvents: 'none', // 背景へのクリックを阻害しない？いや、スライダー操作必要
                        zIndex: 30000,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                    }}
                >
                    {/* Close / Return Button - Top Right of screen (but outside panel) */}
                    <div style={{ position: 'fixed', top: '16px', right: '16px', pointerEvents: 'auto', zIndex: 30001 }}>
                        <button
                            type="button"
                            onClick={() => setStep('horizontal')}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 9999,
                                background: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                border: 'none',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <FaArrowLeft size={22} />
                        </button>
                    </div>

                    <motion.div
                        initial={{ y: 200 }}
                        animate={{ y: 0 }}
                        style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(10px)',
                            borderTopLeftRadius: '20px',
                            borderTopRightRadius: '20px',
                            padding: '20px',
                            color: 'white',
                            pointerEvents: 'auto',
                            paddingBottom: '40px', // iPhone Home bar area
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', gap: '8px' }}>
                            <FaHandPointer size={18} />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>手動方位調整</h2>
                        </div>

                        <p style={{ fontSize: '0.9rem', textAlign: 'center', opacity: 0.8, marginBottom: '20px' }}>
                            風景と地図が重なるようにスライダーを調整
                        </p>

                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                                <span>補正値: {manualOffset}°</span>
                                <button
                                    type="button"
                                    onClick={() => setManualOffset(0)}
                                    style={{ background: 'none', border: 'none', color: '#48bb78', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <FaUndo size={12} /> リセット
                                </button>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                value={manualOffset}
                                onChange={(e) => setManualOffset(Number(e.target.value))}
                                style={{ width: '100%', height: '8px', accentColor: '#48bb78', cursor: 'pointer' }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleManualComplete}
                            style={{
                                width: '100%',
                                background: '#48bb78',
                                border: 'none',
                                color: 'white',
                                padding: '14px',
                                borderRadius: '30px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(72, 187, 120, 0.4)',
                            }}
                        >
                            決定
                        </button>
                    </motion.div>
                </div>
            )}

            {/* Full Overlay for Horizontal/Complete steps */}
            {step !== 'manual' && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 30000,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(10px)',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    {/* 閉じるボタン (再調整時のみ表示などを想定、または常に表示) */}
                    {onClose && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 30001 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 9999,
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <IoCloseOutline size={30} />
                            </button>
                        </div>
                    )}

                    <AnimatePresence mode='wait'>
                        {step === 'horizontal' && (
                            <motion.div
                                key="horizontal"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{ textAlign: 'center', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                            >
                                <h2 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 'bold' }}>方位の調整</h2>
                                <p style={{ marginBottom: '30px', opacity: 0.8, fontSize: '0.95rem', lineHeight: '1.5' }}>
                                    端末を水平に維持すると、<br />自動的に方位を検出します。
                                </p>

                                <div style={{ position: 'relative', width: '220px', height: '220px', marginBottom: '30px' }}>
                                    {/* 外側のコンパスリング（回転） */}
                                    <motion.div
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            border: '2px dashed rgba(255,255,255,0.2)',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                        animate={{ rotate: isHorizontal ? displayHeading : 0 }}
                                        transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                                    >
                                        {/* 北を示すマーク */}
                                        <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', width: '12px', height: '12px', background: '#e53e3e', borderRadius: '50%' }} />
                                        <div style={{ position: 'absolute', top: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: '#e53e3e' }}>N</div>
                                    </motion.div>

                                    {/* 水準器サークル */}
                                    <div
                                        style={{
                                            width: '140px',
                                            height: '140px',
                                            borderRadius: '50%',
                                            border: `2px solid ${isHorizontal ? '#48bb78' : 'rgba(255,255,255,0.4)'} `,
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            background: 'rgba(255,255,255,0.05)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'border-color 0.3s',
                                        }}
                                    >
                                        {/* 十字ライン */}
                                        <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                        <div style={{ position: 'absolute', width: '1px', height: '100%', background: 'rgba(255,255,255,0.1)' }} />

                                        {/* バブル */}
                                        {orientation && (
                                            <motion.div
                                                style={{
                                                    position: 'absolute',
                                                    width: '30px',
                                                    height: '30px',
                                                    background: isHorizontal ? '#48bb78' : '#e53e3e',
                                                    borderRadius: '50%',
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                                                }}
                                                animate={{
                                                    x: Math.max(-60, Math.min(60, (orientation.gamma || 0) * 2)),
                                                    y: Math.max(-60, Math.min(60, (orientation.beta || 0) * 2)),
                                                }}
                                                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Stability Progress */}
                                {isHorizontal ? (
                                    <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                                        <motion.div
                                            style={{ height: '100%', background: '#48bb78' }}
                                            animate={{ width: `${stabilityProgress}% ` }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ height: '4px', marginBottom: '10px' }} />
                                )}

                                <p style={{ fontSize: '0.9rem', marginBottom: '30px', color: isHorizontal ? '#48bb78' : '#e2e8f0', minHeight: '1.5em' }}>
                                    {isHorizontal ? '調整中...そのまま保持' : '水平にしてください'}
                                </p>

                                {allowManualAdjustment && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('manual')}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: 'white',
                                            padding: '12px 24px',
                                            borderRadius: '30px',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <FaHandPointer /> 手動で微調整する
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {step === 'complete' && (
                            <motion.div
                                key="complete"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                            >
                                <div style={{
                                    width: '90px', height: '90px', background: '#48bb78', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                                    boxShadow: '0 10px 25px rgba(72,187,120,0.3)'
                                }}>
                                    <FaCheck size={45} color="white" />
                                </div>
                                <h2 style={{ fontSize: '1.6rem', marginBottom: '10px', fontWeight: 'bold' }}>調整完了</h2>
                                <p style={{ opacity: 0.8, marginBottom: '40px' }}>
                                    正確な方位が設定されました
                                </p>

                                <button
                                    type="button"
                                    onClick={handleAutoComplete}
                                    style={{
                                        background: 'white',
                                        color: '#2F855A',
                                        border: 'none',
                                        padding: '14px 50px',
                                        borderRadius: '30px',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    3Dモードを開始
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </>
    );
}
