import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaCompass, FaHandPointer } from 'react-icons/fa';
import { useSensors } from '../../hooks/useSensors';

interface CompassCalibrationProps {
    onCalibrationComplete: (offset: number) => void;
    // onCancel is currently unused but kept for future extensibility (optional)
    // To satisfy linter, we can omit it or prefix with underscore if destructuring
    // Removing it from interface if not intended to use now
    initialOffset?: number;
}

type CalibrationStep = 'intro' | 'horizontal' | 'manual' | 'complete';

export default function CompassCalibration({
    onCalibrationComplete,
    initialOffset = 0,
}: CompassCalibrationProps) {
    const { sensorData } = useSensors();
    const [step, setStep] = useState<CalibrationStep>('horizontal');
    const [manualOffset, setManualOffset] = useState(initialOffset);
    const [isHorizontal, setIsHorizontal] = useState(false);
    const [stabilityProgress, setStabilityProgress] = useState(0);

    // 水平判定の閾値（度）
    const HORIZONTAL_THRESHOLD = 5;
    // 安定化に必要な時間（ミリ秒）
    const STABILITY_DURATION = 1500;

    const lastTimeRef = useRef<number>(Date.now());
    const stabilityTimerRef = useRef<number>(0);

    // スマートフォンが水平かどうかを判定
    useEffect(() => {
        if (step !== 'horizontal') return;
        if (!sensorData.orientation) return;

        const { beta, gamma } = sensorData.orientation;
        // beta: 前後の傾き, gamma: 左右の傾き (-90~90)
        // 完全に水平なら beta=0, gamma=0

        // nullチェック
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
                // 水平状態で安定 -> 現在のコンパスヘディングを基準(オフセット0)として完了へ
                // ただし、ここでは「自動取得」なので、現在のヘディングが正しいと仮定するなら
                // オフセットは「真北(0) - 現在のコンパス値」ではなく、
                // 地図の向きと合わせるためのオフセット。
                // 自動モードでは「今は正しい向きを向いている」というよりは
                // 「コンパスの値をそのまま信じる（オフセット0）」あるいは
                // 「特定のランドマークに向いていると仮定して補正する」などが考えられるが
                // 通常の電子コンパスキャリブレーション(8の字)ではなく、ここでは
                // 「水平にすることでコンパス精度を上げる」のが目的で、
                // 完了時は現在の方位をそのまま採用する(=オフセットそのまま、あるいはリセット)。

                // ここでは「自動調整完了」として、オフセットを0（センサー値を信頼）にするか、
                // あるいは現在の値を基準にするかだが、
                // 「方位補正」の文脈では「地図がずれているのを直す」ので、
                // 自動モードは「センサー精度が良い状態を作る」ステップで、
                // 完了後に手動調整へ移行するか、そのまま完了とするか。

                // プランに従い、「安定したら自動で方位を取得」 -> オフセット0（センサー生値）で完了とする
                if (manualOffset !== 0) {
                    // 既存のオフセットがある場合、それをリセットするか維持するか？
                    // 「自動調整」＝センサーリセットと捉える
                    setManualOffset(0);
                }
                setStep('complete');
            }
        } else {
            stabilityTimerRef.current = Math.max(0, stabilityTimerRef.current - dt);
            setStabilityProgress((prev) => Math.max(0, prev - (dt / STABILITY_DURATION) * 100));
        }
    }, [sensorData.orientation, step, manualOffset]);

    const handleManualComplete = () => {
        onCalibrationComplete(manualOffset);
    };

    const handleAutoComplete = () => {
        // 自動完了時はオフセット0（または現在のセンサー値を正とするなら0）
        onCalibrationComplete(0);
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
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
            <AnimatePresence mode='wait'>
                {step === 'horizontal' && (
                    <motion.div
                        key="horizontal"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ textAlign: 'center', width: '100%', maxWidth: '400px' }}
                    >
                        <FaCompass size={50} color={isHorizontal ? '#48bb78' : '#e53e3e'} style={{ marginBottom: '20px' }} />
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', fontWeight: 'bold' }}>方位の調整</h2>
                        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
                            正確な方位を取得するため、<br />端末を水平に持ってください。
                        </p>

                        {/* 水準器ビジュアル */}
                        <div
                            style={{
                                width: '200px',
                                height: '200px',
                                borderRadius: '50%',
                                border: `2px solid ${isHorizontal ? '#48bb78' : 'rgba(255,255,255,0.3)'}`,
                                position: 'relative',
                                margin: '0 auto 30px',
                                background: 'rgba(255,255,255,0.05)',
                                transition: 'border-color 0.3s',
                            }}
                        >
                            {/* 中心マーカー */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '10px',
                                    height: '10px',
                                    background: 'rgba(255,255,255,0.5)',
                                    borderRadius: '50%',
                                    transform: 'translate(-50%, -50%)',
                                }}
                            />

                            {/* バブル */}
                            {sensorData.orientation && (
                                <motion.div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        width: '40px',
                                        height: '40px',
                                        background: isHorizontal ? '#48bb78' : '#e53e3e',
                                        borderRadius: '50%',
                                        boxShadow: '0 0 15px rgba(0,0,0,0.5)',
                                    }}
                                    animate={{
                                        x: Math.max(-90, Math.min(90, (sensorData.orientation.gamma || 0) * 3)) - 20, // センシティビティ調整
                                        y: Math.max(-90, Math.min(90, (sensorData.orientation.beta || 0) * 3)) - 20,
                                    }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                />
                            )}
                        </div>

                        {/* 進捗バー */}
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '20px' }}>
                            <motion.div
                                style={{ height: '100%', background: '#48bb78' }}
                                animate={{ width: `${stabilityProgress}%` }}
                            />
                        </div>

                        <p style={{ fontSize: '0.9rem', marginBottom: '30px', height: '20px' }}>
                            {isHorizontal ? 'そのまま保持してください...' : '水平にしてください'}
                        </p>

                        <button
                            type="button"
                            onClick={() => setStep('manual')}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '30px',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                            }}
                        >
                            手動で調整する
                        </button>
                    </motion.div>
                )}

                {step === 'manual' && (
                    <motion.div
                        key="manual"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        style={{ textAlign: 'center', width: '100%', maxWidth: '400px' }}
                    >
                        <FaHandPointer size={40} style={{ marginBottom: '20px' }} />
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', fontWeight: 'bold' }}>手動方位調整</h2>
                        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
                            スライダーを動かして、<br />風景と地図が重なるように調整してください。
                        </p>

                        <div style={{ marginBottom: '40px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span>補正値: {manualOffset}°</span>
                                <button
                                    type="button"
                                    onClick={() => setManualOffset(0)}
                                    style={{ background: 'none', border: 'none', color: '#48bb78', cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    リセット
                                </button>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                value={manualOffset}
                                onChange={(e) => setManualOffset(Number(e.target.value))}
                                style={{ width: '100%', height: '6px', accentColor: '#48bb78' }}
                            />
                            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '10px' }}>
                                ※背景の3Dシーンを見ながら調整できます
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setStep('horizontal')}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: 'white',
                                    padding: '12px 24px',
                                    borderRadius: '30px',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                }}
                            >
                                自動に戻る
                            </button>
                            <button
                                type="button"
                                onClick={handleManualComplete}
                                style={{
                                    background: '#48bb78',
                                    border: 'none',
                                    color: 'white',
                                    padding: '12px 40px',
                                    borderRadius: '30px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(72, 187, 120, 0.4)',
                                }}
                            >
                                完了
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'complete' && (
                    <motion.div
                        key="complete"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{ textAlign: 'center' }}
                    >
                        <div style={{
                            width: '80px', height: '80px', background: '#48bb78', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                        }}>
                            <FaCheck size={40} color="white" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', fontWeight: 'bold' }}>調整完了</h2>
                        <p style={{ opacity: 0.8 }}>3Dモードを開始します</p>

                        {/* 自動遷移用に見えないボタン等を置くか、useEffectで遷移させるのが良いが、
                    ここではユーザー確認としてボタンを置く */}
                        <button
                            type="button"
                            onClick={handleAutoComplete}
                            style={{
                                marginTop: '30px',
                                background: 'white',
                                color: '#1a202c',
                                border: 'none',
                                padding: '12px 40px',
                                borderRadius: '30px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                            }}
                        >
                            OK
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
