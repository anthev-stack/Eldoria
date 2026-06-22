import { initLayout } from './layout.js';
import { initAuth } from './auth.js';
import { initDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  await initAuth();
  initDashboard();
});
