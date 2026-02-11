// ピン情報の型定義
export type PinType =
  | 'historical'
  | 'landmark'
  | 'nature'
  | 'cultural'
  | 'viewpoint'
  | 'restaurant'
  | 'interview'
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
    color: '#8B4513',
    icon: 'church',
    label: '歴史',
  },
  landmark: {
    color: '#2E8B57',
    icon: 'buildings',
    label: 'ランドマーク',
  },
  nature: {
    color: '#228B22',
    icon: 'tree',
    label: '自然',
  },
  cultural: {
    color: '#8A2BE2',
    icon: 'masks-theater',
    label: '文化',
  },
  viewpoint: {
    color: '#FF6347',
    icon: 'binoculars',
    label: '展望',
  },
  restaurant: {
    color: '#FF6B35',
    icon: 'bowl-food',
    label: '飲食店',
  },
  interview: {
    color: '#4A90E2',
    icon: 'microphone',
    label: 'インタビュー',
  },
  debug: {
    color: '#000',
    icon: 'bug',
    label: 'debug',
  },
};
