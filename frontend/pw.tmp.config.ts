import base from './playwright.config';
export default { ...base, use: { ...(base as any).use, launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } } };
