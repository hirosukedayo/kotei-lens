import React from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSlidersH } from 'react-icons/fa';

interface LoadingScreenProps {
    isReady?: boolean;
    onStart?: () => void;
}

export default function LoadingScreen({ isReady = false, onStart }: LoadingScreenProps) {
    const { progress, active } = useProgress();
    const [dismissed, setDismissed] = React.useState(false);

    const isLoading = active || progress < 100 || !isReady;
    const shouldShow = !dismissed;

    const handleStart = () => {
        setDismissed(true);
        // フェードアウト完了後にコールバック
        setTimeout(() => onStart?.(), 800);
    };

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 1.0)',
                        zIndex: 100000,
                        color: 'white',
                        padding: '24px',
                    }}
                >
                    {/* 白カード */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: 16,
                        padding: '32px 28px 28px',
                        maxWidth: 'min(340px, 85vw)',
                        width: '100%',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: '#f3f4f6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <FaSlidersH size={20} color="#6b7280" />
                        </div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.5, color: '#111827' }}>
                            カメラ画面と3Dモデルの
                            <br />
                            位置合わせが必要です
                        </h2>
                        <p style={{ fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.7, margin: '0 0 24px' }}>
                            読み込み完了後、方位と高さを調整して
                            <br />
                            実際の風景と3Dモデルを重ねてください。
                        </p>

                        {/* ローディング / ボタン */}
                        <div style={{ minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {isLoading ? (
                                <>
                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 10 }}>
                                        {progress < 100 ? 'Loading 3D Model...' : 'Rendering Scene...'}
                                    </div>
                                    <div style={{
                                        width: '100%', height: 4,
                                        background: '#f3f4f6',
                                        borderRadius: 2, overflow: 'hidden', marginBottom: 6,
                                    }}>
                                        <motion.div
                                            style={{ height: '100%', background: '#111827', borderRadius: 2 }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ type: 'spring', stiffness: 50 }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#d1d5db' }}>
                                        {Math.round(progress)}%
                                    </div>
                                </>
                            ) : (
                                <motion.button
                                    type="button"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                    onClick={handleStart}
                                    style={{
                                        background: '#111827',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '12px 0',
                                        borderRadius: 10,
                                        fontSize: '0.95rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        minHeight: 0,
                                        width: '100%',
                                    }}
                                >
                                    調整する
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
