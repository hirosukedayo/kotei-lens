import React, { useState, useEffect } from 'react';
import SensorPermissionRequest from './components/ui/SensorPermissionRequest';
import Scene3D from './components/viewer/Scene3D';
import './App.css';

type AppState = 'welcome' | 'permissions' | '3d-view' | 'permission-error';

function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [permissionErrors, setPermissionErrors] = useState<string[]>([]);

  // 3Dビュー表示時にrootに全画面クラスを追加
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      if (appState === '3d-view') {
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
    setAppState('permissions');
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
    return <Scene3D />;
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>湖底レンズ (Kotei Lens)</h1>
        <p>小河内ダムに沈んだ村の記憶を3D空間で再現</p>
        <p>
          <strong>React Three Fiber セットアップ完了</strong>
        </p>
        <button
          type="button"
          onClick={handleStart3D}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#FF6B35',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          3D ビューを開始
        </button>
        <p style={{ marginTop: '15px', fontSize: '14px', opacity: 0.8 }}>
          ※ 3D表示にはWebGLが必要です
        </p>
      </header>
    </div>
  );
}

export default App;
