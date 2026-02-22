import React, { useState, useEffect, useRef } from 'react';
import { FaMapLocationDot } from 'react-icons/fa6';
import SensorPermissionRequest from './components/ui/SensorPermissionRequest';
import Scene3D from './components/viewer/Scene3D';
import OkutamaMap2D, { type Initial3DPosition } from './components/map/OkutamaMap2D';
import { useDevModeStore } from './stores/devMode';
import type { PinData } from './types/pins';
import { trackEnter3DView, trackBackTo2D } from './utils/analytics';
import './App.css';

type AppState = '2d-view' | 'permissions' | '3d-view' | 'permission-error';

function App() {
  const [appState, setAppState] = useState<AppState>('2d-view');
  const [permissionErrors, setPermissionErrors] = useState<string[]>([]);
  const [initial3DPosition, setInitial3DPosition] = useState<Initial3DPosition | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const { isDevMode, toggleDevMode } = useDevModeStore();
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CORNER_SIZE = 50; // 右下角の検出範囲（px）
  const REQUIRED_TAPS = 5; // devモード切り替えに必要なタップ数
  const TAP_TIMEOUT = 2000; // タップ間のタイムアウト（ms）

  // 3Dビュー表示時にrootに全画面クラスを追加
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      if (appState === '3d-view' || appState === '2d-view') {
        rootElement.classList.add('fullscreen');
      } else {
        rootElement.classList.remove('fullscreen');
      }
    }

    // クリーンアップ
    return () => {
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.classList.remove('fullscreen');
      }
    };
  }, [appState]);

  // 右下角の連続タップでdevモードを切り替える
  useEffect(() => {
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // 右下角（右下からCORNER_SIZE以内）をタップしたかチェック
      if (clientX >= windowWidth - CORNER_SIZE && clientY >= windowHeight - CORNER_SIZE) {
        tapCountRef.current += 1;

        // タイムアウトをリセット
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }

        // 必要な回数タップされたらdevモードを切り替え
        if (tapCountRef.current >= REQUIRED_TAPS) {
          toggleDevMode();
          tapCountRef.current = 0;
          console.log(`Dev mode ${isDevMode ? 'disabled' : 'enabled'}`);
        } else {
          // タイムアウトを設定（一定時間タップがないとリセット）
          tapTimeoutRef.current = setTimeout(() => {
            tapCountRef.current = 0;
          }, TAP_TIMEOUT);
        }
      } else {
        // 右下角以外をタップしたらリセット
        tapCountRef.current = 0;
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }
      }
    };

    // マウスとタッチの両方に対応
    window.addEventListener('click', handleTap);
    window.addEventListener('touchstart', handleTap, { passive: true });

    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchstart', handleTap);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [toggleDevMode, isDevMode]);

  const handleStart3D = (initialPosition: Initial3DPosition) => {
    setInitial3DPosition(initialPosition);
    setAppState('3d-view');
    trackEnter3DView(true);
  };

  const handleBackTo2D = () => {
    setAppState('2d-view');
    trackBackTo2D();
  };

  const handlePermissionsGranted = () => {
    setAppState('3d-view');
  };

  const handlePermissionsDenied = (errors: string[]) => {
    setPermissionErrors(errors);
    setAppState('permission-error');
  };

  const handleRetryPermissions = () => {
    setAppState('permissions');
  };

  const handleContinueWithoutPermissions = () => {
    setAppState('3d-view');
  };

  // 3Dビュー表示
  if (appState === '3d-view') {
    return (
      <div>
        <Scene3D
          initialPosition={initial3DPosition}
          selectedPin={selectedPin}
          onSelectPin={setSelectedPin}
          onDeselectPin={() => setSelectedPin(null)}
        />
        {/* 2Dに戻る（右上・円形アイコンボタン） */}
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            aria-label="2Dマップへ戻る"
            onClick={handleBackTo2D}
            style={{
              width: 72,
              height: 72,
              borderRadius: 9999,
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              boxShadow: '0 3px 10px rgba(60,64,67,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <FaMapLocationDot size={64} />
          </button>
        </div>
        {/* Devモード表示バッジ */}
        {isDevMode && (
          <div
            style={{
              position: 'fixed',
              top: '16px',
              left: '16px',
              zIndex: 1000,
              backgroundColor: '#10b981',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
            }}
          >
            DEV MODE
          </div>
        )}
      </div>
    );
  }

  // センサー許可画面
  if (appState === 'permissions') {
    return (
      <SensorPermissionRequest
        onPermissionsGranted={handlePermissionsGranted}
        onPermissionsDenied={handlePermissionsDenied}
      />
    );
  }

  // 許可エラー画面
  if (appState === 'permission-error') {
    return (
      <div className="App">
        <div
          style={{
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            padding: '20px',
            margin: '20px',
            maxWidth: '500px',
          }}
        >
          <h3 style={{ color: '#d32f2f', marginTop: 0 }}>⚠️ センサー許可エラー</h3>
          <ul style={{ color: '#666', textAlign: 'left' }}>
            {permissionErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <div
            style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}
          >
            <button
              type="button"
              onClick={handleRetryPermissions}
              style={{ backgroundColor: '#2B6CB0' }}
            >
              再試行
            </button>
            <button
              type="button"
              onClick={handleContinueWithoutPermissions}
              style={{ backgroundColor: '#666' }}
            >
              制限モードで続行
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2Dマップをデフォルトで表示
  return (
    <>
      <OkutamaMap2D
        onRequest3D={handleStart3D}
        selectedPin={selectedPin}
        onSelectPin={setSelectedPin}
        onDeselectPin={() => setSelectedPin(null)}
      />
      {/* Devモード表示バッジ */}
      {isDevMode && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 1000,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }}
        >
          DEV MODE
        </div>
      )}
    </>
  );
}

export default App;
