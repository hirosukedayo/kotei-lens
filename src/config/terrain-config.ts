// 地形の設定ファイル
// 地形のスケールと中心位置を調整するための設定

// 地形のスケール設定
// 現在のスケール [10, 10, 10] を基準（1.0）として、この値を変更することで地形の大きさを調整できます
// 例: 1.0 = 現在のサイズ、0.5 = 半分のサイズ、2.0 = 2倍のサイズ
export const TERRAIN_SCALE_FACTOR = 6.0;

// 地形と水面の中心位置オフセット（メートル単位）
// 地形と水面の中心位置をずらしたい場合は、この値を変更してください
// 例: [10, 0, 5] = X方向（東）に10m、Z方向（南）に5mずらす
// 現在は[0, 0, 0]で、小河内神社（SCENE_CENTER）が地形の中心に対応しています
export const TERRAIN_CENTER_OFFSET: [number, number, number] = [0, 0, 0];
export const WATER_CENTER_OFFSET: [number, number, number] = TERRAIN_CENTER_OFFSET;

// 地形のベーススケール（モデルファイルの元のスケール）
export const TERRAIN_BASE_SCALE = 10;

// 地形の元の中心位置（スケール適用前、ローカル座標系）
// terrainScale=[10,10,10]適用後の中心: [-744.9999975831743, 177.19751206980436, 744.9999975831743]
// したがって、元の中心 = スケール適用後の中心 / 10
export const TERRAIN_ORIGINAL_CENTER = {
  x: -744.9999975831743 / TERRAIN_BASE_SCALE,
  y: 177.19751206980436 / TERRAIN_BASE_SCALE,
  z: 744.9999975831743 / TERRAIN_BASE_SCALE,
};

// カメラとピンの地表からの高さオフセット（メートル単位）
// カメラとピンは地形の高さにこの値を加算した位置に配置されます
// 例: 10 = 地形の高さ+10m、5 = 地形の高さ+5m
export const CAMERA_HEIGHT_OFFSET = 10; // カメラの地表からの高さ
export const PIN_HEIGHT_OFFSET = 10; // ピンの地表からの高さ

// 水面の初期位置オフセット（メートル単位）
// 水面の初期位置は waterPosition + (WATER_INITIAL_OFFSET * TERRAIN_SCALE_FACTOR) で計算されます
// 例: 2 = 基準2m、スケール6.0の場合 = 2 * 6 = 12m上から開始
export const WATER_INITIAL_OFFSET = 2; // 水面の初期位置オフセット（基準値）
