import type { IconType } from 'react-icons';
import {
  PiHouseFill,
  PiUserSoundFill,
  PiMicrophoneFill,
  PiFilmStripFill,
  PiMapPinFill,
  PiBugBeetleFill,
} from 'react-icons/pi';

// ピン情報の型定義
export type PinType =
  | 'historical'
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
  folktaleId?: string; // 関連する民話のID（外部リンク用）（オプション）
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
    color: '#771D7B',
    IconComponent: PiHouseFill,
    label: '歴史',
  },
  interview: {
    color: '#FA51C2',
    IconComponent: PiUserSoundFill,
    label: 'インタビュー',
  },
  folktale: {
    color: '#ff786a',
    IconComponent: PiMicrophoneFill,
    label: '民話・伝説',
  },
  heritage: {
    color: '#726aff',
    IconComponent: PiFilmStripFill,
    label: '伝統芸能',
  },
  current: {
    color: '#49B5D2',
    IconComponent: PiMapPinFill,
    label: '現代',
  },
  debug: {
    color: '#000',
    IconComponent: PiBugBeetleFill,
    label: 'debug',
  },
};
