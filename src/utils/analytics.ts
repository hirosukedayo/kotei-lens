/**
 * Google Analytics 4 カスタムイベント送信ユーティリティ
 *
 * gtag.js が読み込まれていない場合（ローカル開発時など）は何もしない。
 */

type GtagParams = Record<string, string | number | boolean | undefined>;

function gtag(...args: [string, string, GtagParams?]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

/** ビュー切り替え: 2D → 3D */
export function trackEnter3DView(isInArea: boolean) {
  gtag('event', 'enter_3d_view', {
    is_in_area: isInArea,
  });
}

/** ビュー切り替え: 3D → 2D */
export function trackBackTo2D() {
  gtag('event', 'back_to_2d');
}

/** ピン選択 */
export function trackPinSelect(pinId: string, pinTitle: string, pinType: string, viewMode: '2d' | '3d') {
  gtag('event', 'pin_select', {
    pin_id: pinId,
    pin_title: pinTitle,
    pin_type: pinType,
    view_mode: viewMode,
  });
}

/** エリア判定結果 */
export function trackAreaDetection(isInArea: boolean) {
  gtag('event', 'area_detection', {
    is_in_area: isInArea,
  });
}

/** センサー許可の結果 */
export function trackSensorPermission(sensorType: string, result: string) {
  gtag('event', 'sensor_permission', {
    sensor_type: sensorType,
    permission_result: result,
  });
}
