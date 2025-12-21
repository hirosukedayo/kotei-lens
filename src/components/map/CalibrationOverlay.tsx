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

    // ロード状態管理
    const [isLoading, setIsLoading] = useState(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);

    const [bounds, setBounds] = useState<LatLngBoundsExpression>(initialBounds);

    useEffect(() => {
        if (!initialBounds) return;

        // initialBounds を確実に LatLngBounds オブジェクトに変換
        // (LatLngBoundsExpression は [ [lat,lng], [lat,lng] ] の配列の可能性があるため)
        // L.latLngBounds(initialBounds) だと型定義によっては配列を直接受け付けない場合があるため、
        // 念のため any キャストするか、配列であることを確認するが、
        // 通常 L.latLngBounds は配列を受け付ける。エラーが出る場合は型定義の問題。
        // ここでは安全のため、一旦 any で通すか、L.latLngBounds のオーバーロードを信頼する。
        // エラーメッセージ: Argument of type 'LatLngBoundsExpression' is not assignable to parameter of type 'LatLngExpression[]'.
        // これは initialBounds が LatLngBounds オブジェクトの場合に配列メソッドがないと言われている。
        // 対処: initialBounds が配列かオブジェクトかで分岐するか、L.latLngBounds でラップする。
        // L.latLngBounds(initialBounds as any) で回避するのが手っ取り早いが、より安全に書く。

        let baseBounds: L.LatLngBounds;
        if (initialBounds instanceof L.LatLngBounds) {
            baseBounds = initialBounds;
        } else {
            // 配列の場合
            baseBounds = L.latLngBounds(initialBounds as L.LatLngTuple[]);
        }

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
            setLoadingError(null);
            try {
                console.log('Loading texture from GLB...');
                const url = await extractTextureFromGLB(MODEL_PATH);
                console.log('Texture loaded successfully');
                setTextureUrl(url);
            } catch (error) {
                console.error('Failed to extract texture:', error);
                setLoadingError(String(error));
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

    return (
        <>
            {textureUrl && (
                <ImageOverlay
                    url={textureUrl}
                    bounds={bounds}
                    opacity={opacity}
                    zIndex={1000}
                />
            )}

            {/* コントロールパネル */}
            <div className="absolute top-20 right-4 z-[5000] bg-white/90 p-4 rounded-lg shadow-lg w-72 backdrop-blur-sm max-h-[80vh] overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">位置合わせ (Calibration)</h3>

                {/* ステータス表示 */}
                <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                    <div className="flex justify-between">
                        <span className="font-bold">Status:</span>
                        <span>
                            {isLoading ? 'Loading...' : loadingError ? 'Error' : 'Texture Ready'}
                        </span>
                    </div>
                    {loadingError && (
                        <div className="text-red-500 mt-1 break-all">{loadingError}</div>
                    )}
                </div>

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
