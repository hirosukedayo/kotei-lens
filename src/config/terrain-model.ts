/**
 * 地形モデルの設定定数
 *
 * 地形モデルのスケール、位置、回転などの調整は、このファイルの定数を変更するだけで行えます。
 *
 * 【推奨】GPS座標と矩形サイズで指定する方法（直感的で調整しやすい）
 * ===================================================================
 * 以下の2つの定数を変更するだけで、地形モデルの中心位置とサイズを調整できます。
 */

/**
 * 地形モデルの中心位置（GPS座標）
 *
 * 2Dマップ上のGPS座標で地形モデルの中心位置を指定します。
 * この位置が3D空間の原点 [0, 0, 0] に対応します。
 *
 * 例: 小河内神社を中心にする場合
 *     { latitude: 35.777041, longitude: 139.0185245 }
 */
export const TERRAIN_CENTER_GPS = {
  latitude: 35.777041, // 小河内神社の緯度
  longitude: 139.0185245, // 小河内神社の経度
  altitude: 0, // 標高（メートル）
};

/**
 * 地形モデルの矩形サイズ（メートル単位）
 *
 * 2Dマップ上に表示される地形モデルの矩形のサイズをメートル単位で指定します。
 * [x方向のサイズ, y方向のサイズ（使用されない）, z方向のサイズ] の順で指定します。
 *
 * 通常、x と z は同じ値にします（正方形の矩形）。
 *
 * 例: 1.5km x 1.5km の矩形にする場合
 *     [1500, 0, 1500]
 *
 * 例: 2km x 2km の矩形にする場合
 *     [2000, 0, 2000]
 */
export const TERRAIN_SIZE_METERS: [number, number, number] = [1490, 0, 1490];

/**
 * ===================================================================
 * 以下は自動計算される値です。通常は変更する必要はありません。
 * ===================================================================
 */

/**
 * 地形モデルの元のサイズ（terrainScale適用前）
 *
 * モデルファイルの元のサイズです。
 * この値は、TERRAIN_SIZE_METERSからTERRAIN_SCALEを計算するために使用されます。
 *
 * モデルファイルが変更された場合は、devモードで3Dビューを開き、
 * コンソールログの「地形のバウンディングボックス（terrainScale適用前）」から
 * サイズの x または z の値を設定してください。
 */
const TERRAIN_BASE_SIZE = 15521.001650509425;

/**
 * 地形モデルのスケール設定（自動計算）
 *
 * TERRAIN_SIZE_METERSとTERRAIN_BASE_SIZEから自動計算されます。
 * 手動で変更することも可能ですが、TERRAIN_SIZE_METERSを変更する方が推奨されます。
 */
export const TERRAIN_SCALE: [number, number, number] = [
  TERRAIN_SIZE_METERS[0] / TERRAIN_BASE_SIZE,
  1, // Y方向は通常1のまま
  TERRAIN_SIZE_METERS[2] / TERRAIN_BASE_SIZE,
];

/**
 * 水面モデルのスケール設定
 *
 * 通常は地形と同じスケールを使用します。
 */
export const WATER_SCALE: [number, number, number] = [
  TERRAIN_SCALE[0],
  TERRAIN_SCALE[1],
  TERRAIN_SCALE[2],
];

/**
 * 地形モデルの位置オフセット（自動計算）
 *
 * TERRAIN_CENTER_GPSから自動計算されます。
 * ただし、正確な値はモデルが読み込まれた後にバウンディングボックスから計算されるため、
 * この値は初期値として使用されます。
 *
 * 実際の位置調整は、LakeModelコンポーネント内で動的に行われます。
 */
export const TERRAIN_POSITION_OFFSET: [number, number, number] = [0, 0, 0];

/**
 * 地形モデルの実際のサイズ（terrainScale適用後）
 *
 * TERRAIN_SIZE_METERSと同じ値です。
 * 2Dマップ上に地形の範囲を表示するために使用されます。
 */
export const TERRAIN_ACTUAL_SIZE = TERRAIN_SIZE_METERS[0];

/**
 * 地形モデルの全体スケール（オプション）
 *
 * LakeModelコンポーネントの全体スケールです。
 * 通常は [1, 1, 1] のままにしておき、TERRAIN_SCALE で調整します。
 */
export const TERRAIN_OVERALL_SCALE: [number, number, number] = [1, 1, 1];

/**
 * 地形モデルの回転（オプション）
 *
 * 地形モデルの回転角度（ラジアン）です。
 * 通常は [0, 0, 0] のままにしておきます。
 */
export const TERRAIN_ROTATION: [number, number, number] = [0, 0, 0];
