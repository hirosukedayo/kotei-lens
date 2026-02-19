export interface AudioTrack {
  id: string;
  title: string;
  filename: string;
  emoji: string;
}

export const audioTracks: AudioTrack[] = [
  { id: 'himenoishi-kannon', title: '姫の石観音', filename: 'himenoishi-kannon.mp3', emoji: '👶' },
  { id: 'kashiwan', title: '貸椀', filename: 'kashiwan.mp3', emoji: '🍚' },
  { id: 'kinno-chagama', title: '金の茶釜', filename: 'kinno-chagama.mp3', emoji: '🛎️' },
  { id: 'nekoodori-hibun', title: '猫踊り秘聞', filename: 'nekoodori-hibun.mp3', emoji: '🐱' },
  { id: 'onnanokaminoketo-oishi', title: '女の髪の毛と大石', filename: 'onnanokaminoketo-oishi.mp3', emoji: '🪨' },
  { id: 'otsuneno-nakizaka', title: 'おつねの泣き坂', filename: 'otsuneno-nakizaka.mp3', emoji: '😢' },
  { id: 'ozake-kistune', title: '尾裂狐', filename: 'ozake-kistune.mp3', emoji: '🦊' },
  { id: 'senrigan-basan', title: '千里眼婆さん', filename: 'senrigan-basan.mp3', emoji: '🐍' },
  { id: 'tsurunoonsen-kotohazime', title: '鶴の温泉事始め', filename: 'tsurunoonsen-kotohazime.mp3', emoji: '♨️' },
  { id: 'yamanba-monogatari', title: 'やまんばあ物語', filename: 'yamanba-monogatari.mp3', emoji: '👹' },
];
