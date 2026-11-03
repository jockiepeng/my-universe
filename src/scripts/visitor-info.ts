import { canCountView } from '../lib/services.mjs';
import { formatVisitorLocation } from '../lib/visitor-location.mjs';

const locationValue = document.querySelector<HTMLElement>('[data-visitor-location]');
if (locationValue) {
  if (!canCountView(import.meta.env.PROD, location.origin, document.body.dataset.productionOrigin || '')) {
    locationValue.textContent = '本地预览不定位';
  } else {
    locationValue.textContent = '查询中…';
    const loadLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/', {
          credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Location unavailable');
        locationValue.textContent = formatVisitorLocation(await response.json()) || '暂不可用';
      } catch {
        locationValue.textContent = '暂不可用';
      }
    };
    void loadLocation();
  }
}
