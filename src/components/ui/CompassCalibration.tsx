import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
const VDrawer = Drawer as unknown as any;
import { FaCheck, FaHandPointer, FaChevronUp, FaChevronDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { IoCloseOutline } from 'react-icons/io5';
import type { DeviceOrientation } from '../../types/sensors';

interface CompassCalibrationProps {
    onCalibrationComplete: (offset: number) => void;
    onClose?: () => void;
    initialOffset?: number;
    orientation: DeviceOrientation | null;
    compassHeading: number | null;
    allowManualAdjustment?: boolean;
    /** trueの場合、自動調整を飛ばして手動モードから開始する */
    startInManualMode?: boolean;
    /** スライダー操作時にリアルタイムでオフセットを通知するコールバック */
    onOffsetChange?: (offset: number) => void;
    /** 高さオフセット初期値 */
    initialHeightOffset?: number;
    /** 高さスライダー操作時にリアルタイムで通知するコールバック */
    onHeightOffsetChange?: (offset: number) => void;
    /** 高さが下限に達しているか */
    heightAtFloor?: boolean;
}

type CalibrationStep = 'intro' | 'horizontal' | 'manual' | 'complete';

export default function CompassCalibration({
    onCalibrationComplete,
    onClose,
    initialOffset = 0,
    orientation,
    compassHeading,
    allowManualAdjustment = true,
    startInManualMode = false,
    onOffsetChange,
    initialHeightOffset = 0,
    onHeightOffsetChange,
    heightAtFloor = false,
}: CompassCalibrationProps) {
    // const { sensorData } = useSensors(); // 親からデータを受け取るため削除
    const [step, setStep] = useState<CalibrationStep>(startInManualMode ? 'manual' : 'horizontal');
    const [manualDrawerOpen, setManualDrawerOpen] = useState(true);
    const [manualOffset, setManualOffset] = useState(initialOffset);
    const [heightOffset, setHeightOffset] = useState(initialHeightOffset);
    const [isHorizontal, setIsHorizontal] = useState(false);
    const [stabilityProgress, setStabilityProgress] = useState(0);

    // stepがmanualに変わったらDrawerを開く
    useEffect(() => {
        if (step === 'manual') setManualDrawerOpen(true);
    }, [step]);

    // Vaulがbodyにpointer-events: noneを付与するのを防ぐ
    useEffect(() => {
        if (step === 'manual') {
            const timer = setTimeout(() => { document.body.style.pointerEvents = 'auto'; }, 50);
            return () => clearTimeout(timer);
        }
        document.body.style.pointerEvents = '';
    }, [step]);

    const HORIZONTAL_THRESHOLD = 5;
    const STABILITY_DURATION = 1500;

    const lastTimeRef = useRef<number>(Date.now());
    const stabilityTimerRef = useRef<number>(0);
    const onCalibrationCompleteRef = useRef(onCalibrationComplete);
    onCalibrationCompleteRef.current = onCalibrationComplete;



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
                // 水平時にcompassHeadingとalphaの差分を計算
                // compassHeading: 0=北, 時計回り → Three.js: 360-compassHeading で反時計回りに変換
                // alpha: ジャイロベース（任意基準）
                // offset = (360 - compassHeading) - alpha → alphaに足すと真北基準になる
                if (compassHeading !== null && orientation?.alpha !== null && orientation?.alpha !== undefined) {
                    let offset = (360 - compassHeading) - orientation.alpha;
                    // -180〜180 に正規化
                    while (offset > 180) offset -= 360;
                    while (offset <= -180) offset += 360;
                    // ref経由で最新のコールバックを確実に呼ぶ
                    setTimeout(() => onCalibrationCompleteRef.current(offset), 0);
                } else {
                    setTimeout(() => onCalibrationCompleteRef.current(0), 0);
                }
            }
        } else {
            stabilityTimerRef.current = Math.max(0, stabilityTimerRef.current - dt);
            setStabilityProgress((prev) => Math.max(0, prev - (dt / STABILITY_DURATION) * 100));
        }
    }, [orientation, step, compassHeading]);

    // 長押し用タイマー
    const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopHold = useCallback(() => {
        if (holdIntervalRef.current !== null) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
    }, []);

    // クリーンアップ
    useEffect(() => stopHold, [stopHold]);

    const startHold = useCallback((action: () => void) => {
        action(); // 即座に1回実行
        holdIntervalRef.current = setInterval(action, 80);
    }, []);

    const adjustHeading = useCallback((delta: number) => {
        setManualOffset(prev => {
            let next = prev + delta;
            if (next > 180) next -= 360;
            if (next < -180) next += 360;
            const rounded = Math.round(next);
            onOffsetChange?.(rounded);
            return rounded;
        });
    }, [onOffsetChange]);

    const adjustHeight = useCallback((delta: number) => {
        setHeightOffset(prev => {
            const next = Math.max(-200, Math.min(200, prev + delta));
            onHeightOffsetChange?.(next);
            return next;
        });
    }, [onHeightOffsetChange]);

    const dismissManual = useCallback(() => {
        // まずDrawerを閉じ、アニメーション完了後にコールバック
        setManualDrawerOpen(false);
        setTimeout(() => {
            onCalibrationComplete(manualOffset);
        }, 350);
    }, [manualOffset, onCalibrationComplete]);

    const handleAutoComplete = () => {
        onCalibrationComplete(manualOffset);
    };

    return (
        <>
            {/* Manual Mode: 3Dビュータップで閉じるオーバーレイ */}
            {step === 'manual' && manualDrawerOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 29999 }}
                    onClick={dismissManual}
                    onKeyDown={() => {}}
                    role="presentation"
                />
            )}

            {/* Manual Mode: vaul Bottom Sheet */}
            <VDrawer.Root
                open={step === 'manual' && manualDrawerOpen}
                onOpenChange={(open: boolean) => { if (!open) dismissManual(); }}
                modal={false}
                noBodyStyles
            >
                <VDrawer.Content
                    style={{
                        position: 'fixed',
                        left: 0, right: 0, bottom: 0,
                        zIndex: 30000,
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                    onOpenAutoFocus={(e: Event) => e.preventDefault()}
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                >
                    <VDrawer.Title style={{ display: 'none' }}>手動調整</VDrawer.Title>
                    <VDrawer.Description style={{ display: 'none' }}>方位と高さを手動で調整します。</VDrawer.Description>

                    <div
                        style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(10px)',
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            padding: '0 20px 40px',
                            color: 'white',
                        }}
                    >
                        {/* ドラッグハンドル */}
                        <div style={{ padding: '12px 0 10px', display: 'flex', justifyContent: 'center' }}>
                            <div data-vaul-handle style={{ background: 'rgba(255,255,255,0.3)' }} />
                        </div>

                        <p style={{ fontSize: '0.85rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>
                            カメラ画面と山を重ねてみよう
                        </p>

                        {/* D-pad コントローラー */}
                        <div data-vaul-no-drag style={{ position: 'relative', height: 56, marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {/* 左ボタン（方位-） */}
                            <button
                                type="button"
                                onPointerDown={() => startHold(() => adjustHeading(2))}
                                onPointerUp={stopHold}
                                onPointerLeave={stopHold}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    width: 56, height: 56, minHeight: 0, padding: 0, borderRadius: '50%',
                                    backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)',
                                    color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', touchAction: 'none',
                                }}
                            >
                                <FaChevronLeft size={20} />
                            </button>

                            {/* 上ボタン（高さ+） */}
                            <button
                                type="button"
                                onPointerDown={() => startHold(() => adjustHeight(2))}
                                onPointerUp={stopHold}
                                onPointerLeave={stopHold}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    position: 'absolute', left: '50%', top: -14, transform: 'translateX(-50%)',
                                    width: 36, height: 36, minHeight: 0, padding: 0, borderRadius: '50%',
                                    backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)',
                                    color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', touchAction: 'none', zIndex: 1,
                                }}
                            >
                                <FaChevronUp size={12} />
                            </button>

                            {/* 下ボタン（高さ-） */}
                            <button
                                type="button"
                                onPointerDown={() => { if (!heightAtFloor) startHold(() => adjustHeight(-2)); }}
                                onPointerUp={stopHold}
                                onPointerLeave={stopHold}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    position: 'absolute', left: '50%', bottom: -14, transform: 'translateX(-50%)',
                                    width: 36, height: 36, minHeight: 0, padding: 0, borderRadius: '50%',
                                    backgroundColor: heightAtFloor ? 'rgba(255,80,80,0.15)' : 'rgba(255,255,255,0.1)',
                                    border: `2px solid ${heightAtFloor ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.25)'}`,
                                    color: heightAtFloor ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.7)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: heightAtFloor ? 'not-allowed' : 'pointer', touchAction: 'none', zIndex: 1,
                                }}
                            >
                                <FaChevronDown size={12} />
                            </button>

                            {/* 右ボタン（方位-） */}
                            <button
                                type="button"
                                onPointerDown={() => startHold(() => adjustHeading(-2))}
                                onPointerUp={stopHold}
                                onPointerLeave={stopHold}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    width: 56, height: 56, minHeight: 0, padding: 0, borderRadius: '50%',
                                    backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)',
                                    color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', touchAction: 'none',
                                }}
                            >
                                <FaChevronRight size={20} />
                            </button>
                        </div>

                        {/* 補正値 + リセット */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            <span>方位 {manualOffset}°</span>
                            <span>高さ {heightOffset > 0 ? `+${heightOffset}` : heightOffset}m</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setManualOffset(0); onOffsetChange?.(0);
                                    setHeightOffset(0); onHeightOffsetChange?.(0);
                                }}
                                style={{
                                    background: 'none', backgroundColor: 'transparent', border: 'none', minHeight: 0, padding: '2px 6px',
                                    color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline',
                                }}
                            >
                                リセット
                            </button>
                        </div>
                    </div>
                </VDrawer.Content>
            </VDrawer.Root>

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
