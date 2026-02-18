// ピン情報の型定義
export type PinType =
  | 'historical'
  | 'landmark'
  | 'nature'
  | 'cultural'
  | 'viewpoint'
  | 'interview'
  | 'folktale'
  | 'debug';

export interface PinData {
  id: string;
  title: string;
  coordinates: [number, number]; // [lat, lng]
  type: PinType;
  description: string;
  image?: string; // 画像URL（オプション）
  icon?: string; // カスタムアイコン（オプション）
  mapUrl?: string; // マップアプリで開くURL（オプション）
  externalUrl?: string; // 外部リンクURL（ブログなど）（オプション）
  hasLocation?: boolean; // 現在位置として表示するかどうか
  folktaleTitle?: string; // 関連する民話のタイトル（オプション）
  performingArtTitle?: string; // 関連する伝統芸能のタイトル（オプション）
}

// ピンタイプごとのスタイル設定
export const pinTypeStyles: Record<
  PinType,
  {
    color: string;
    icon: string;
    label: string;
  }
> = {
  historical: {
    color: '#661A71',
    icon: 'church',
    label: '歴史',
  },
  landmark: {
    color: '#FFB0DD',
    icon: 'buildings',
    label: 'ランドマーク',
  },
  nature: {
    color: '#FFB0DD',
    icon: 'tree',
    label: '自然',
  },
  cultural: {
    color: '#661A71',
    icon: 'masks-theater',
    label: '文化',
  },
  viewpoint: {
    color: '#FFB0DD',
    icon: 'binoculars',
    label: '展望',
  },

  interview: {
    color: '#D55DF4',
    icon: 'microphone',
    label: 'インタビュー',
  },
  folktale: {
    color: '#FFB0DD',
    icon: 'scroll',
    label: '民話・伝説',
  },
  debug: {
    color: '#000',
    icon: 'bug',
    label: 'debug',
  },
};
