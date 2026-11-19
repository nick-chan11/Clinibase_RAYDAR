import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.jsx';
import './styles.css';
import * as store from './engine/store.js';

// Dev only: inspect and drive the store from the console (window.raydar.S, window.raydar.act('confirm'))
if (import.meta.env.DEV) window.raydar = store;

// reducedMotion="user": Motion drops transform and layout animation when the OS asks;
// the tokens in src/motion/tokens.js also zero every duration, fades included.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
);
