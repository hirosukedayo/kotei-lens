import React, { useEffect, useRef, useState } from 'react';

interface ARBackgroundProps {
    active?: boolean;
}

export default function ARBackground({ active = true }: ARBackgroundProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let currentStream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                const constraints = {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                };

                currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                }
            } catch (err) {
                console.error('Error accessing camera:', err);
                setError('カメラへのアクセスに失敗しました');
            }
        };

        if (active) {
            startCamera();
        }

        return () => {
            if (currentStream) {
                for (const track of currentStream.getTracks()) {
                    track.stop();
                }
            }
        };
    }, [active]);

    if (!active) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                overflow: 'hidden',
                backgroundColor: '#000',
            }}
        >
            {error ? (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        textAlign: 'center',
                    }}
                >
                    {error}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            )}
        </div>
    );
}
