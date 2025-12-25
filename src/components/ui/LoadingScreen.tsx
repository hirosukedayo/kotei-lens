import React from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen() {
    const { progress, active } = useProgress();

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
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
                        background: 'rgba(0, 0, 0, 0.8)',
                        zIndex: 9999, // 最前面
                        color: 'white',
                        backdropFilter: 'blur(5px)',
                    }}
                >
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
                        Loading 3D Model...
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
                        {/* プログレスバー本体 */}
                        <motion.div
                            style={{
                                height: '100%',
                                background: '#2B6CB0', // Lake Blue
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
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
