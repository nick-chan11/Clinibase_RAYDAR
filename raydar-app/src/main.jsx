import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.jsx';
import './styles.css';
import * as store from './engine/store.js';
import { ADMIN_MODE, AdminApp } from './admin/gate.js';

// 2.8: the study admin file opens straight into the admin (it shows the call screens only to preview a draft)
const Root = ADMIN_MODE === 'admin' ? () => <Suspense fallback={null}><AdminApp /></Suspense> : App;

// Dev only: inspect and drive the store from the console (window.raydar.S, window.raydar.act('confirm'))
if (import.meta.env.DEV) window.raydar = store;

// reducedMotion="user": Motion drops transform and layout animation when the OS asks;
// the tokens in src/motion/tokens.js also zero every duration, fades included.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Root />
    </MotionConfig>
  </StrictMode>
);
