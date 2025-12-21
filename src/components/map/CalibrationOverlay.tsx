import { useEffect, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
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
    const [scale, setScale] = useState(1.0);
    const [offsetLat, setOffsetLat] = useState(0);
    const [offsetLng, setOffsetLng] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [bounds, setBounds] = useState<LatLngBoundsExpression>(initialBounds);

    useEffect(() => {
        if (!initialBounds) return;

        const baseBounds = L.latLngBounds(initialBounds);
        const center = baseBounds.getCenter();
        const southWest = baseBounds.getSouthWest();
        const northEast = baseBounds.getNorthEast();

        // 緯度経度の幅を計算
        const latSpan = northEast.lat - southWest.lat;
        const lngSpan = northEast.lng - southWest.lng;

        // スケール適用後の幅
        const scaledLatSpan = latSpan * scale;
        const scaledLngSpan = lngSpan * scale;

        // 新しい中心位置 (オフセット適用)
        const newCenterLat = center.lat + offsetLat;
        const newCenterLng = center.lng + offsetLng;

        // 新しいBoundsを計算
        const newSouthWest = L.latLng(
            newCenterLat - scaledLatSpan / 2,
            newCenterLng - scaledLngSpan / 2
        );
        const newNorthEast = L.latLng(
            newCenterLat + scaledLatSpan / 2,
            newCenterLng + scaledLngSpan / 2
        );

        setBounds(L.latLngBounds(newSouthWest, newNorthEast));

    }, [initialBounds, scale, offsetLat, offsetLng]);

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

    const handleExport = () => {
        console.group('🌍 Calibration Settings');
        console.log('Scale Factor Adjustment:', scale);
        console.log('Offset Adjustment (Lat/Lng):', { lat: offsetLat, lng: offsetLng });

        // メートル単位の概算オフセットも計算して出力 (緯度1度≒111km, 経度1度≒91km at 35.8deg)
        const metersLat = offsetLat * 111000;
        const metersLng = offsetLng * 91000;
        console.log('Approximate Offset in Meters (add to TERRAIN_CENTER_OFFSET):',
            `\nX: ${metersLng.toFixed(2)} (East), Z: ${-metersLat.toFixed(2)} (South)`
        );
        console.log('multiply TERRAIN_SCALE_FACTOR by:', scale);
        console.groupEnd();

        alert('設定値をコンソールに出力しました');
    };

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
            <div className="absolute top-20 right-4 z-[5000] bg-white/90 p-4 rounded-lg shadow-lg w-72 backdrop-blur-sm max-h-[80vh] overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">位置合わせ (Calibration)</h3>

                <div className="space-y-4">
                    {/* 不透明度 */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
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

                    {/* スケール */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            スケール補正: {scale.toFixed(3)}x
                            <div className="flex gap-2">
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.001"
                                    value={scale}
                                    onChange={(e) => setScale(Number.parseFloat(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => setScale(1.0)}
                                    className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                >
                                    Reset
                                </button>
                            </div>
                        </label>
                    </div>

                    {/* 位置調整 (Lat) */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            縦位置 (Lat): {offsetLat.toFixed(6)}
                            <input
                                type="range"
                                min="-0.05"
                                max="0.05"
                                step="0.00001"
                                value={offsetLat}
                                onChange={(e) => setOffsetLat(Number.parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </label>
                    </div>

                    {/* 位置調整 (Lng) */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            横位置 (Lng): {offsetLng.toFixed(6)}
                            <input
                                type="range"
                                min="-0.05"
                                max="0.05"
                                step="0.00001"
                                value={offsetLng}
                                onChange={(e) => setOffsetLng(Number.parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                        </label>
                    </div>

                    {/* Exportボタン */}
                    <button
                        type="button"
                        onClick={handleExport}
                        className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                    >
                        設定値をコンソールに出力
                    </button>

                    <div className="pt-2 text-[10px] text-gray-400 leading-tight">
                        ※出力された値を terrain-config.ts に反映してください
                    </div>
                </div>
            </div>
        </>
    );
}
