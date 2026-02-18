import React from 'react';
import ReactDOM from 'react-dom/client';
import { AudioPlayerPage } from './components/audio/AudioPlayerPage';

const rootElement = document.getElementById('audio-root');
if (!rootElement) throw new Error('audio-root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AudioPlayerPage />
  </React.StrictMode>
);
