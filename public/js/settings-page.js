import { initLayout } from './layout.js';
import { initAuth } from './auth.js';
import { initSettings } from './settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  await initAuth();
  initSettings();
});
