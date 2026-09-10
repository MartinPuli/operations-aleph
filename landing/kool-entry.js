import { initKoolDownloads } from './kool-download.js?v=1';

try { initKoolDownloads(); }
catch { /* A blocked attribution helper cannot block the landing. */ }
