import type { PinData } from '../types/pins';

// デバッグ用の座標リスト [緯度, 経度]
const debugCoordinates: [number, number][] = [
    [35.792007, 139.049611],
    [35.791882, 139.050163],
    [35.791435, 139.050864],
    [35.790794, 139.051071],
    [35.790122, 139.050957],
    [35.789560, 139.050822],
];

// 座標リストからピンデータを自動生成
export const debugPins: PinData[] = debugCoordinates.map((coords, index) => {
    const [lat, lng] = coords;
    const num = index + 1;
    return {
        id: `debug-pin-${String(num).padStart(4, '0')}`,
        title: `デバッグピン ${num}`,
        coordinates: coords,
        type: 'debug',
        description: `緯度: ${lat}, 経度: ${lng}`,
    };
});
