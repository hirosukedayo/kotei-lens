import React from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
    isReady?: boolean; // 描画準備完了フラグ
}

export default function LoadingScreen({ isReady = false }: LoadingScreenProps) {
    const { progress, active } = useProgress();
    // プログレスが100%になり、かつ親から準備完了(isReady)が渡されたら表示終了
    // activeはロード中かどうか。ロード完了しても描画待ちがあるため、
    // activeがfalseになってもisReadyが来るまで待つ。

    // 表示判定: activeがtrue または (progress >= 100 かつ !isReady)
    // つまり、ロード中または「ロード完了したがまだ準備未完了」の間は表示
    const shouldShow = active || (progress < 100) || !isReady;

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0, ease: "easeInOut" }} // フェードアウトをゆっくりに
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 1.0)', // 完全不透明にして裏のフリーズを隠す
                        zIndex: 100000,
                        color: 'white',
                    }}
                >
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
                        {progress < 100 ? 'Loading 3D Model...' : 'Rendering Scene...'}
                    </div>

                    {/* プログレスバーのコンテナ */}
                    <div
                        style={{
                            width: '200px',
                            height: '10px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            marginBottom: '10px',
                        }}
                    >
                        <motion.div
                            style={{
                                height: '100%',
                                background: '#2B6CB0',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}% ` }}
                            transition={{ type: 'spring', stiffness: 50 }}
                        />
                    </div>

                    <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>
                        {Math.round(progress)}%
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
