/* Which RAYDAR this build is (2.8), set by vite.config.js:
   'none'     RAYDAR for recruiters, no study admin inside (the two-file setup's recruiter file)
   'admin'    the study admin file (it also holds the recruiter screens, to preview drafts)
   'combined' one file with both; the admin opens from Tools › Study admin
   The admin code is only bundled when it's used: in 'none' this import is removed at build time. */
import { lazy } from 'react';

export const ADMIN_MODE = typeof __ADMIN_MODE__ !== 'undefined' ? __ADMIN_MODE__ : 'combined';
export const AdminApp = ADMIN_MODE !== 'none' ? lazy(() => import('./AdminApp.jsx')) : null;
