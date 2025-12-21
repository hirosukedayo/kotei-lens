import { useEffect, useState, useRef } from 'react';
import { ImageOverlay, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import * as L from 'leaflet';
import { extractTextureFromGLB } from '../../utils/texture-extractor';

const MODEL_PATH = `${import.meta.env.BASE_URL}models/OkutamaLake_realscale.glb`;

interface CalibrationOverlayProps {
    initialBounds: LatLngBoundsExpression;
}

export default function CalibrationOverlay({ initialBounds }: CalibrationOverlayProps) {
    const [textureUrl, setTextureUrl] = useState<string | null>(null);
    const [opacity, setOpacity] = useState(0.5);
    const [isLoading, setIsLoading] = useState(false);
    const [bounds, setBounds] = useState<LatLngBoundsExpression>(initialBounds);
    const map = useMap();

    useEffect(() => {
        const loadTexture = async () => {
            setIsLoading(true);
            try {
                console.log('Loading texture from GLB...');
                const url = await extractTextureFromGLB(MODEL_PATH);
                console.log('Texture loaded successfully');
                setTextureUrl(url);
            } catch (error) {
                console.error('Failed to extract texture:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTexture();
    }, []);

    if (isLoading) {
        return (
            <div className="absolute top-4 left-4 z-[5000] bg-white p-2 rounded shadow">
                Loading texture...
            </div>
        );
    }

    if (!textureUrl) return null;

    return (
        <>
            <ImageOverlay
                url={textureUrl}
                bounds={bounds}
                opacity={opacity}
                zIndex={1000}
            />

            {/* コントロールパネル */}
            <div className="absolute top-20 right-4 z-[5000] bg-white/90 p-4 rounded-lg shadow-lg w-64 backdrop-blur-sm">
                <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">位置合わせ (Calibration)</h3>

                <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">
                        不透明度: {Math.round(opacity * 100)}%
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => setOpacity(Number.parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                        />
                    </label>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                    ※ 現在は表示テストのみ。位置調整機能は未実装です。
                    <br />
                    Drag markers to adjust (TODO)
                </p>
            </div>
        </>
    );
}
