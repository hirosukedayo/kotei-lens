// 地形の設定ファイル
// 地形のスケールと中心位置を調整するための設定

// 地形のスケール設定
// 現在のスケール [10, 10, 10] を基準（1.0）として、この値を変更することで地形の大きさを調整できます
// 例: 1.0 = 現在のサイズ、0.5 = 半分のサイズ、2.0 = 2倍のサイズ
export const TERRAIN_SCALE_FACTOR = 5.34;

// 地形と水面の中心位置オフセット（メートル単位）
// FBX正規化後のモデル中心は原点に配置されるため、このオフセットでワールド位置を調整
export const TERRAIN_CENTER_OFFSET: [number, number, number] = [0, 0, 0];
export const WATER_CENTER_OFFSET: [number, number, number] = TERRAIN_CENTER_OFFSET;

// 地形のベーススケール（モデルファイルの元のスケール）
export const TERRAIN_BASE_SCALE = 10;

// 地形の元の中心位置（スケール適用前、ローカル座標系）
// FBX正規化でモデル中心は原点に配置されるため (0, 0, 0)
export const TERRAIN_ORIGINAL_CENTER = {
  x: 0,
  y: 0,
  z: 0,
};

// FBX正規化ターゲットサイズ（XZ方向の最大寸法をこの値にスケール）
// terrainScale (TERRAIN_BASE_SCALE * TERRAIN_SCALE_FACTOR = 53.4) を掛けた後の
// 可視サイズは約 150 * 53.4 ≈ 8010 ユニットになる
export const FBX_NORMALIZATION_TARGET = 150;

// カメラとピンの地表からの高さオフセット（メートル単位）
// カメラとピンは地形の高さにこの値を加算した位置に配置されます
// 例: 10 = 地形の高さ+10m、5 = 地形の高さ+5m
export const CAMERA_HEIGHT_OFFSET = 1.7; // カメラの地表からの高さ
export const PIN_HEIGHT_OFFSET = 1.7; // ピンの地表からの高さ

// 水面の初期位置オフセット（メートル単位）
// 水面の初期位置は waterPosition + (WATER_INITIAL_OFFSET * TERRAIN_SCALE_FACTOR) で計算されます
// 例: 2 = 基準2m、スケール6.0の場合 = 2 * 6 = 12m上から開始
export const WATER_INITIAL_OFFSET = 2; // 水面の初期位置オフセット（基準値）

// カメラのデフォルト画角（FOV）
export const DEFAULT_FOV = 65;
