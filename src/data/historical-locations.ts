// 小河内ダムに沈んだ歴史的地点のデータ

import type { GPSCoordinate } from '../utils/coordinate-converter';

export interface HistoricalLocation {
  id: string;
  name: string;
  description: string;
  gpsCoordinate: GPSCoordinate;
  type: 'village' | 'temple' | 'school' | 'bridge' | 'house' | 'field' | 'road' | 'restaurant' | 'station';
  importance: 'high' | 'medium' | 'low';
  constructedYear?: number;
  demolishedYear?: number;
  stories?: string[];
  images?: string[];
}

// 小河内ダム建設前の主要地点（推定座標）と現代の実在地点
export const HISTORICAL_LOCATIONS: HistoricalLocation[] = [
  {
    id: 'ogochi-village-center',
    name: '小河内村中心部',
    description: 'かつて約500人が暮らしていた小河内村の中心地。商店や役場があった。',
    gpsCoordinate: {
      latitude: 35.7845,
      longitude: 139.0395,
      altitude: 450
    },
    type: 'village',
    importance: 'high',
    constructedYear: 1600,
    demolishedYear: 1957,
    stories: [
      '江戸時代から続く山間の集落だった',
      '甲州街道の脇往還として賑わった',
      'ダム建設により全村民が移住を余儀なくされた'
    ]
  },
  {
    id: 'koya-village',
    name: '小屋村',
    description: '小河内村の北部にあった集落。林業で栄えた。',
    gpsCoordinate: {
      latitude: 35.7885,
      longitude: 139.0375,  
      altitude: 470
    },
    type: 'village',
    importance: 'medium',
    constructedYear: 1650,
    demolishedYear: 1957,
    stories: [
      '林業を営む家々が点在していた',
      '急斜面に建てられた茅葺き屋根の家が特徴的だった'
    ]
  },
  {
    id: 'ogochi-elementary',
    name: '小河内小学校',
    description: '村の子どもたちが通った木造校舎の小学校。',
    gpsCoordinate: {
      latitude: 35.7840,
      longitude: 139.0385,
      altitude: 455
    },
    type: 'school',
    importance: 'high',
    constructedYear: 1875,
    demolishedYear: 1957,
    stories: [
      '明治8年に開校した歴史ある小学校',
      '最後の卒業生たちは移住先でも同窓会を続けた',
      '校庭の桜の木は村民の心のよりどころだった'
    ]
  },
  {
    id: 'koshin-temple',
    name: '庚申堂',
    description: '村民の信仰の中心だった小さなお堂。',
    gpsCoordinate: {
      latitude: 35.7835,
      longitude: 139.0405,
      altitude: 465
    },
    type: 'temple',
    importance: 'medium',
    constructedYear: 1750,
    demolishedYear: 1957,
    stories: [
      '村民が安全を祈願する場所だった',
      '毎月庚申の日には村民が集まった',
      'ダム建設の無事を祈る最後の法要が行われた'
    ]
  },
  {
    id: 'old-bridge',
    name: '古い石橋',
    description: '多摩川に架かっていた石造りの橋。村への唯一の入口だった。',
    gpsCoordinate: {
      latitude: 35.7820,
      longitude: 139.0420,
      altitude: 440
    },
    type: 'bridge',
    importance: 'high',
    constructedYear: 1800,
    demolishedYear: 1957,
    stories: [
      '村外との唯一の交通路だった',
      '江戸時代後期の石工技術の粋を集めて建設',
      '多くの村民がこの橋を渡って故郷を後にした'
    ]
  },
  {
    id: 'yamada-house',
    name: '山田家住宅',
    description: '村で最も古い農家。茅葺き屋根の古民家だった。',
    gpsCoordinate: {
      latitude: 35.7855,
      longitude: 139.0370,
      altitude: 480
    },
    type: 'house',
    importance: 'medium',
    constructedYear: 1700,
    demolishedYear: 1957,
    stories: [
      '江戸時代から続く旧家だった',
      '村の庄屋を務めた家柄',
      '建物の一部は移築されて保存されている'
    ]
  },
  {
    id: 'terraced-fields',
    name: '段々畑',
    description: '急斜面を利用した美しい段々畑。',
    gpsCoordinate: {
      latitude: 35.7870,
      longitude: 139.0390,
      altitude: 500
    },
    type: 'field',
    importance: 'low',
    constructedYear: 1650,
    demolishedYear: 1957,
    stories: [
      '急斜面を開墾して作られた段々畑',
      '主に雑穀や野菜を栽培していた',
      '秋の黄金色の稲穂が美しかった'
    ]
  },
  {
    id: 'mountain-road',
    name: '山道',
    description: '隣村へと続く山間の小道。',
    gpsCoordinate: {
      latitude: 35.7900,
      longitude: 139.0350,
      altitude: 520
    },
    type: 'road',
    importance: 'low',
    constructedYear: 1600,
    demolishedYear: 1957,
    stories: [
      '隣の村々を結ぶ重要な交通路',
      '商人や旅人が通った古い道',
      '今も山の中に痕跡が残っている'
    ]
  },
  
  // === 現代の実在地点 ===
  {
    id: 'shunsuiteien-restaurant',
    name: '春水亭',
    description: '奥多摩の渓流沿いにある老舗料理旅館。美しい自然景観と共に楽しめる。',
    gpsCoordinate: {
      latitude: 35.820833, // 35°49'15.0"N
      longitude: 139.092722, // 139°05'33.8"E
      altitude: 350
    },
    type: 'restaurant',
    importance: 'medium',
    constructedYear: 1950, // 推定
    stories: [
      '奥多摩の自然に囲まれた料理旅館',
      '渓流の音を聞きながら食事を楽しめる',
      '四季折々の山の幸を味わうことができる'
    ]
  },
  {
    id: 'okutama-station',
    name: '奥多摩駅',
    description: 'JR青梅線の終着駅。奥多摩観光の玄関口として多くの登山客や観光客が利用する。',
    gpsCoordinate: {
      latitude: 35.8093061,
      longitude: 139.0964224,
      altitude: 343
    },
    type: 'station',
    importance: 'high',
    constructedYear: 1944,
    stories: [
      'JR青梅線の終着駅として開業',
      '奥多摩の自然への玄関口',
      '多くの登山客や観光客が利用する交通の要所'
    ]
  }
];

// 重要度に応じた表示優先度
export function getLocationPriority(location: HistoricalLocation): number {
  switch (location.importance) {
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    default: return 4;
  }
}

// タイプに応じた色分け
export function getLocationColor(type: HistoricalLocation['type']): string {
  switch (type) {
    case 'village': return '#FF6B35'; // オレンジ
    case 'temple': return '#8E44AD'; // 紫
    case 'school': return '#3498DB'; // 青
    case 'bridge': return '#2ECC71'; // 緑
    case 'house': return '#F39C12'; // 黄色
    case 'field': return '#27AE60'; // 深緑
    case 'road': return '#95A5A6'; // グレー
    case 'restaurant': return '#E74C3C'; // 赤
    case 'station': return '#9B59B6'; // 紫
    default: return '#BDC3C7';
  }
}

// タイプに応じたアイコン
export function getLocationIcon(type: HistoricalLocation['type']): string {
  switch (type) {
    case 'village': return '🏘️';
    case 'temple': return '⛩️';
    case 'school': return '🏫';
    case 'bridge': return '🌉';
    case 'house': return '🏠';
    case 'field': return '🌾';
    case 'road': return '🛤️';
    case 'restaurant': return '🍽️';
    case 'station': return '🚉';
    default: return '📍';
  }
}