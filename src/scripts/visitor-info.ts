import { canCountView } from '../lib/services.mjs';
import { formatVisitorLocation } from '../lib/visitor-location.mjs';
import { getLanguage } from '../lib/i18n.mjs';

const locationValue = document.querySelector<HTMLElement>('[data-visitor-location]');
if (locationValue) {
  if (!canCountView(import.meta.env.PROD, location.origin, document.body.dataset.productionOrigin || '')) {
    locationValue.textContent = '本地预览不定位';
  } else {
    let locationData: unknown;
    const renderLocation = () => { if (locationData) locationValue.textContent = formatVisitorLocation(locationData, getLanguage()) || '暂不可用'; };
    document.addEventListener('universe:language', renderLocation);
    locationValue.textContent = '查询中…';
    const loadLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/', {
          credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Location unavailable');
        locationData = await response.json();
        renderLocation();
      } catch {
        locationValue.textContent = '暂不可用';
      }
    };
    void loadLocation();
  }
}
