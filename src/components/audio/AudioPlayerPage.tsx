import { useCallback, useEffect, useRef, useState } from 'react';
import { MdForward5, MdPause, MdPlayArrow, MdReplay5 } from 'react-icons/md';
import { type AudioTrack, audioTracks } from '../../data/audio-tracks';

const STORAGE_KEY = 'audio-player-last-track';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayerPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [selectedTrack, setSelectedTrack] = useState<AudioTrack>(() => {
    const queryId = new URLSearchParams(window.location.search).get('id');
    if (queryId) {
      const found = audioTracks.find((t) => t.id === queryId);
      if (found) return found;
    }
    const savedId = localStorage.getItem(STORAGE_KEY);
    return audioTracks.find((t) => t.id === savedId) ?? audioTracks[0];
  });
  const autoplayRef = useRef(!!new URLSearchParams(window.location.search).get('id'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const selectTrack = useCallback(
    (track: AudioTrack) => {
      setSelectedTrack(track);
      localStorage.setItem(STORAGE_KEY, track.id);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);

      const url = new URL(window.location.href);
      url.searchParams.set('id', track.id);
      window.history.replaceState(null, '', url.toString());

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = `${import.meta.env.BASE_URL}audio/${track.filename}`;
        audio.load();
      }
    },
    []
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration || 0));
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !audio.duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = `${import.meta.env.BASE_URL}audio/${selectedTrack.filename}`;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      if (autoplayRef.current) {
        autoplayRef.current = false;
        audio.play().catch(() => {});
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [selectedTrack]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={styles.page}>
      <h1 style={styles.srOnly}>-奥多摩 小河内の民話-</h1>
      {/* biome-ignore lint/a11y/useMediaCaption: audio-only folk tale narration, no captions available */}
      <audio ref={audioRef} preload="metadata" />

      <div style={styles.container}>
        <div style={styles.header}>-奥多摩 小河内の民話-</div>

        <div style={styles.photoWrapper}>
          <img
            src={`${import.meta.env.BASE_URL}images/arasawa_hiroshi.jpg`}
            alt="荒澤弘"
            style={styles.photo}
          />
          <div style={styles.narrator}>語り：荒澤弘</div>
        </div>

        <div style={styles.card}>
          <select
            style={styles.trackSelect}
            value={selectedTrack.id}
            onChange={(e) => {
              const track = audioTracks.find((t) => t.id === e.target.value);
              if (track) selectTrack(track);
            }}
          >
            {audioTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.emoji} {track.title}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.controls}>
          <button type="button" style={styles.controlBtn} onClick={() => skip(-5)}>
            <MdReplay5 />
          </button>
          <button type="button" style={styles.playBtn} onClick={togglePlay}>
            {isPlaying ? <MdPause /> : <MdPlayArrow />}
          </button>
          <button type="button" style={styles.controlBtn} onClick={() => skip(5)}>
            <MdForward5 />
          </button>
        </div>

        <div
          ref={progressRef}
          style={styles.progressBar}
          onClick={handleProgressClick}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') skip(5);
            if (e.key === 'ArrowLeft') skip(-5);
          }}
          role="slider"
          aria-label="再生位置"
          aria-valuenow={Math.round(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          tabIndex={0}
        >
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        <div style={styles.timeDisplay}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    margin: 0,
    padding: '16px',
    height: '100dvh',
    background: 'linear-gradient(180deg, #5a7a4e 0%, #8b6340 100%)',
    fontFamily: '"Noto Sans JP", sans-serif',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
  container: {
    width: '100%',
    maxWidth: '480px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    color: '#f8f1e6',
    fontSize: '24px',
    fontWeight: 700,
    textAlign: 'center',
    padding: '4px 0 16px',
  },
  photoWrapper: {
    margin: '0 auto 16px',
    textAlign: 'center' as const,
  },
  photo: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    display: 'block',
    margin: '0 auto',
    border: '3px solid #f8f1e6',
    boxShadow: '0 4px 16px rgba(30,20,10,0.3)',
  },
  card: {
    background: '#f8f1e6',
    borderRadius: '16px',
    padding: '20px 24px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(30,20,10,0.25)',
    marginBottom: '24px',
  },
  trackSelect: {
    width: '100%',
    fontSize: '20px',
    fontWeight: 700,
    color: '#3e2c1a',
    background: 'transparent',
    border: 'none',
    textAlign: 'center',
    textAlignLast: 'center',
    fontFamily: '"Noto Sans JP", sans-serif',
    cursor: 'pointer',
    appearance: 'auto' as const,
  },
  narrator: {
    fontSize: '12px',
    color: 'rgba(248,241,230,0.8)',
    marginTop: '8px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '32px',
  },
  controlBtn: {
    background: '#f8f1e6',
    border: 'none',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    fontSize: '28px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    background: '#f8f1e6',
    border: 'none',
    borderRadius: '50%',
    width: '80px',
    height: '80px',
    fontSize: '36px',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(30,20,10,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    background: 'rgba(248,241,230,0.3)',
    borderRadius: '4px',
    height: '8px',
    cursor: 'pointer',
    marginBottom: '8px',
    overflow: 'hidden',
  },
  progressFill: {
    background: '#f8f1e6',
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.1s linear',
  },
  timeDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'rgba(248,241,230,0.8)',
    fontSize: '12px',
    marginBottom: '24px',
  },
};
