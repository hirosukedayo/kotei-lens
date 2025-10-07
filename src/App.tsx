import React, { useState, useEffect } from 'react';
import { FaMapLocationDot } from 'react-icons/fa6';
import SensorPermissionRequest from './components/ui/SensorPermissionRequest';
import Scene3D from './components/viewer/Scene3D';
import OkutamaMap2D from './components/map/OkutamaMap2D';
import './App.css';

type AppState = '2d-view' | 'permissions' | '3d-view' | 'permission-error';

function App() {
  const [appState, setAppState] = useState<AppState>('2d-view');
  const [permissionErrors, setPermissionErrors] = useState<string[]>([]);

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

  const handleStart3D = () => {
    setAppState('3d-view');
  };

  const handleBackTo2D = () => {
    setAppState('2d-view');
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
        <Scene3D />
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
              cursor: 'pointer'
            }}
          >
            <FaMapLocationDot size={64} />
          </button>
        </div>
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
            <button type="button" onClick={handleRetryPermissions} style={{ backgroundColor: '#2B6CB0' }}>
              再試行
            </button>
            <button type="button" onClick={handleContinueWithoutPermissions} style={{ backgroundColor: '#666' }}>
              制限モードで続行
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2Dマップをデフォルトで表示
  return (
    <OkutamaMap2D onRequest3D={handleStart3D} />
  );
}

export default App;
