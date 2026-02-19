import type { IconType } from 'react-icons';
import {
  PiChurchFill,
  PiBuildingsFill,
  PiTreeFill,
  PiPaletteFill,
  PiBinocularsFill,
  PiMicrophoneFill,
  PiScrollFill,
  PiMaskHappyFill,
  PiMapPinFill,
  PiBugBeetleFill,
} from 'react-icons/pi';

// ピン情報の型定義
export type PinType =
  | 'historical'
  | 'landmark'
  | 'nature'
  | 'cultural'
  | 'viewpoint'
  | 'interview'
  | 'folktale'
  | 'heritage'
  | 'current'
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
  externalUrlTitle?: string; // 外部リンクのタイトル（オプション）
  hasLocation?: boolean; // 現在位置として表示するかどうか
  reading?: string; // 読み上げ用テキスト（タイトル＋本文の読み仮名付き）
  folktaleTitle?: string; // 関連する民話のタイトル（オプション）
  performingArtTitle?: string; // 関連する伝統芸能のタイトル（オプション）
}

// ピンタイプごとのスタイル設定
export const pinTypeStyles: Record<
  PinType,
  {
    color: string;
    IconComponent: IconType;
    label: string;
  }
> = {
  historical: {
    color: '#661A71',
    IconComponent: PiChurchFill,
    label: '歴史',
  },
  landmark: {
    color: '#FFB0DD',
    IconComponent: PiBuildingsFill,
    label: 'ランドマーク',
  },
  nature: {
    color: '#FFB0DD',
    IconComponent: PiTreeFill,
    label: '自然',
  },
  cultural: {
    color: '#661A71',
    IconComponent: PiPaletteFill,
    label: '文化',
  },
  viewpoint: {
    color: '#FFB0DD',
    IconComponent: PiBinocularsFill,
    label: '展望',
  },
  interview: {
    color: '#D55DF4',
    IconComponent: PiMicrophoneFill,
    label: 'インタビュー',
  },
  folktale: {
    color: '#FFB0DD',
    IconComponent: PiScrollFill,
    label: '民話・伝説',
  },
  heritage: {
    color: '#9B30FF',
    IconComponent: PiMaskHappyFill,
    label: '民俗芸能',
  },
  current: {
    color: '#3B82F6',
    IconComponent: PiMapPinFill,
    label: '現代',
  },
  debug: {
    color: '#000',
    IconComponent: PiBugBeetleFill,
    label: 'debug',
  },
};
