import type { PinData } from '../types/pins';
import { debugPins } from './debug-pins';

// 奥多摩地域のピンデータ
export const okutamaPins: PinData[] = [
  ...debugPins,
  {
    id: 'okutama-damu-suimon-west',
    title: '奥多摩ダム 水門西岸',
    coordinates: [35.792390, 139.049120],
    type: 'historical',
    description: '水門ダムの西岸。',
  },
  {
    id: 'okutama-damu-suimon-east',
    title: '奥多摩ダム 水門東岸',
    coordinates: [35.792048, 139.049548],
    type: 'historical',
    description: '水門ダムの東岸。',
  },
  {
    id: 'okutama-damu-katakuri',
    title: 'ふれあい館 カタクリの花',
    coordinates: [35.792751, 139.048331],
    type: 'historical',
    description: 'かたくりの花',
  },
  {
    id: 'okutama-damu-tenboutou',
    title: '展望塔',
    coordinates: [35.789277, 139.050837],
    type: 'historical',
    description: '展望塔',
  },
  {
    id: 'ogochi-sou',
    title: '小河内荘',
    coordinates: [35.783512, 139.044813],
    type: 'historical',
    description: '小河内荘',
  },
  {
    id: 'nonkiya',
    title: 'のんきや',
    coordinates: [35.778998, 139.031988],
    type: 'restaurant',
    description:
      '1918年創業の老舗ラーメン・そば店。店主は3代目で、30年以上厨房に立ち、昔ながらの手作りのこだわりが特徴です。水没前に移転し、現在も経営・存続している。',
    mapUrl:
      'https://www.google.co.jp/maps/place/Nonkiya/@35.7787394,139.0321038,16.15z/data=!4m6!3m5!1s0x6019482f510eddb5:0x8c67b1ad75b59770!8m2!3d35.7828694!4d139.0358055!16s%2Fg%2F1tffd7h5?entry=ttu&g_ep=EgoyMDI1MTAwNC4wIKXMDSoASAFQAw%3D%3D',
    // externalUrl: 'https://example-blog.com/nonkiya-review' // ブログ記事などの外部リンク例
  },
  {
    id: 'ogouchi-elementary',
    title: '小河内小学校',
    coordinates: [35.776397, 139.023226],
    type: 'historical',
    description:
      '明治6、普門寺に末広学舎開設（河内村・原村共立）。併合、改名を繰り返し、昭和22年に小河内小学校となる。昭和32年、ダム建設に伴い新校舎に移転。平成16年に廃校。 現在、移転先の旧小河内小学校は「OKUTAMA Field」として多目的に利用できる施設となっている。',
    mapUrl:
      'https://www.google.com/maps/place/%E3%80%92198-0221+Tokyo,+Nishitama+District,+Tokyo,+Okutama,+Tozura,+1237+%E6%97%A7%E5%B0%8F%E6%B2%B3%E5%86%85%E5%B0%8F%E5%AD%A6%E6%A0%A1/@35.7869713,139.0096038,17z/data=!3m1!4b1!4m6!3m5!1s0x601949b3db843135:0x1221d615402cacd4!8m2!3d35.7869714!4d139.0144747!16s%2Fg%2F11h6bp1pzg?entry=ttu&g_ep=EgoyMDI1MTAwNi4wIKXMDSoASAFQAw%3D%3D',
  },
  {
    id: 'okutama-dam',
    title: '奥多摩ダム',
    coordinates: [35.791308, 139.049146],
    type: 'landmark',
    description:
      '奥多摩ダムは、1957年に完成した重力式コンクリートダムで、高さ53m・堤長353mを誇ります。多摩川の上流部を堰き止めて形成された人造湖は「奥多摩湖（小河内貯水池）」と呼ばれ、東京都心の重要な水源として、今日まで首都圏の生活と産業を支え続けています。建設当時、戦後復興と急速な都市化に伴う慢性的な水不足を解消することが大きな目的であり、渇水期の安定給水と洪水調節、さらに発電や水質保全といった多目的機能が求められました。\n\n一方で、このダム建設は地域の暮らしに大きな転機をもたらしました。谷あいに拓かれていた小河内村の集落は湖底に沈み、住民は移転を余儀なくされます。長年受け継がれてきた営みや祈りの場、学校、橋、田畑が失われた事実は、都市の水を確保するという公共の利益と、地域社会の記憶・文化を守るという価値の狭間で揺れる、難しい選択の象徴でもあります。本プロジェクトでは、当時の地形・史料・証言を手掛かりに、消えた風景をたどり直し、失われた「時間のレイヤー」を可視化することを目指しています。\n\n技術面では、奥多摩ダムは堅牢な基礎岩盤に自重で水圧に抗する重力式を採用し、急峻な山地・狭い谷に適した設計が取られました。水道原水の確保を最優先に、季節変動に応じた貯留と放流を細やかに調整する運用が行われています。また、周辺は豊かな自然景観を有し、湖畔道路や展望スポットから四季の表情を楽しむことができます。観光地としての賑わいの背後に、都市インフラとしての静かな使命と、湖底に眠る村の記憶が重なり合っていることを、私たちは忘れてはなりません。\n\nここで描かれる「湖底レンズ」は、3Dと2Dのレイヤーを通して、過去と現在を重ね合わせる試みです。地図の透過を調整しながら、見えないはずの道や屋敷、祠の位置を想像する――それは、都市の便益の陰で見えにくくなった物語に耳を澄ませる行為でもあります。あなたが地図上の一点に触れるとき、この湖が生まれる以前の生活が、微かな輪郭を取り戻します。',
    externalUrl: 'https://www.youtube.com/watch?v=WqjpF6hbolM',
  },
  {
    id: 'hara-no-misaki',
    title: '原の岬',
    coordinates: [35.787967, 139.045796],
    type: 'landmark',
    description:
      '奥多摩湖に突き出した風光明媚な岬。かつての小河内村原地区の端にあたり、現在は湖畔の展望スポットとして親しまれています。四季折々の湖面と周囲の山々を一望できる絶好のロケーションであり、ダム建設によって変容した地形の名残を留める重要な地点です。',
  },
  {
    id: 'fureaikant-miharashidai',
    title: 'ふれあい館前の見晴台',
    coordinates: [35.791686, 139.047943],
    type: 'landmark',
    description:
      '水と緑のふれあい館のすぐ目の前にある展望デッキ。奥多摩湖の広大な水面と、そびえ立つ堤体を間近に望むことができます。観光の合間に一息つける、湖畔を象徴する眺望ポイントの一つです。',
  },
  {
    id: 'fureaikant-parking-east',
    title: 'ふれあい館の駐車場入口（東）',
    coordinates: [35.792446, 139.047629],
    type: 'landmark',
    description: '水と緑のふれあい館駐車場の東側入口。奥多摩周遊道路からのアクセスポイントです。',
  },
  {
    id: 'fureaikant-parking-west',
    title: 'ふれあい館の駐車場入口（西）',
    coordinates: [35.791683, 139.046589],
    type: 'landmark',
    description: '水と緑のふれあい館駐車場の西側入口。',
  },
  {
    id: 'omugishiro-parking',
    title: '大麦代駐車場',
    coordinates: [35.789676, 139.043479],
    type: 'landmark',
    description:
      '奥多摩湖畔にある広々とした駐車場。ドライブやツーリングの休憩拠点として賑わい、湖を眺めながらの散策も楽しめます。売店なども併設されており、観光客の憩いの場となっています。',
  },
  {
    id: 'dam-view-tower',
    title: 'ダム展望塔',
    coordinates: [35.789288, 139.050856],
    type: 'landmark',
    description:
      '小河内ダムの堤体近くに位置する展望塔。高い位置からダム全体や奥多摩湖、周囲の山々を眺めることができ、ダムの巨大さを実感できるスポットです。',
  },
  {
    id: 'dam-control-tower',
    title: 'ダム管理塔',
    coordinates: [35.789956, 139.051020],
    type: 'landmark',
    description:
      'ダムの運用と安全管理を担う施設の一つ。堤体にそびえ立つ特徴的な建物で、ダムの機能美を象徴する外観をしています。',
  },
  {
    id: 'atami-south-cape',
    title: '熱海の南の岬',
    coordinates: [35.781761, 139.049189],
    type: 'landmark',
    description:
      '奥多摩湖の南岸、熱海地区の南側に位置する岬。対岸の賑わいから離れた静かな場所にあり、湖面を渡る風を感じながら自然の静寂を味わうことができる地点です。',
  },
  {
    id: 'mineyabashi-north',
    title: '峰谷橋（北）',
    coordinates: [35.779570, 139.016039],
    type: 'landmark',
    description: '奥多摩湖に架かる赤いアーチが特徴的な峰谷橋の北側。峰谷川が奥多摩湖に注ぐ地点に位置します。',
  },
  {
    id: 'mineyabashi-south',
    title: '峰谷橋（南）',
    coordinates: [35.778450, 139.016090],
    type: 'landmark',
    description: '峰谷橋の南側。対岸の峰谷地区へと続く重要な交通の要所です。',
  },
  {
    id: 'batokan',
    title: '馬頭館',
    coordinates: [35.778059, 139.015062],
    type: 'landmark',
    description: '峰谷橋の近くにある宿泊施設。奥多摩の自然に囲まれた静かな宿です。',
  },
  {
    id: 'sakamoto-tunnel-west',
    title: '坂本トンネル（西）',
    coordinates: [35.780958, 139.017915],
    type: 'landmark',
    description: '国道139号線の坂本トンネル西側入口。',
  },
  {
    id: 'sakamoto-tunnel-east',
    title: '坂本トンネル（東）',
    coordinates: [35.781662, 139.020832],
    type: 'landmark',
    description: '国道139号線の坂本トンネル東側入口。',
  },
  {
    id: 'mineyabashi-parking-toilet',
    title: '峰谷橋駐車場のトイレ',
    coordinates: [35.780048, 139.015917],
    type: 'landmark',
    description: '峰谷橋近くの駐車場に併設された公衆トイレ。ドライブの休憩に利用されます。',
  },
  {
    id: 'kawano-chuuzai',
    title: '川野駐在',
    coordinates: [35.783201, 139.015863],
    type: 'landmark',
    description: '地域を見守る川野警察官駐在所。',
  },
  {
    id: 'kawano-seikatsukan',
    title: '川野生活館',
    coordinates: [35.777533, 139.004493],
    type: 'landmark',
    description: '地域の集会や活動に使用される生活館。',
  },
  {
    id: 'mitsutoubashi-east',
    title: '三頭橋（東）',
    coordinates: [35.772642, 138.998954],
    type: 'landmark',
    description: '三頭山の麓、奥多摩湖に架かる三頭橋の東側。',
  },
  {
    id: 'shuyu-road-entrance',
    title: '周遊道路入口の交差点',
    coordinates: [35.773237, 138.997529],
    type: 'landmark',
    description: '奥多摩周遊道路の起点となる重要な交差点。',
  },
  {
    id: 'jinya',
    title: '陣屋',
    coordinates: [35.774151, 138.998430],
    type: 'landmark',
    description: '三頭橋近くにある、歴史を感じさせる趣のある建物。',
  },
  {
    id: 'fukagawabashi-intersection',
    title: '深川橋の交差点',
    coordinates: [35.775583, 139.000479],
    type: 'landmark',
    description: '深川橋近くにある交差点。',
  },
  {
    id: 'fukagawabashi-east-curve',
    title: '深川橋東のカーブ',
    coordinates: [35.774683, 139.002061],
    type: 'landmark',
    description: '深川橋の東側にある展望の良いカーブ地点。',
  },
  {
    id: 'koranbashi',
    title: '香蘭橋',
    coordinates: [35.773375, 139.005007],
    type: 'landmark',
    description: '渓流沿いに架かる趣のある橋。',
  },
];
