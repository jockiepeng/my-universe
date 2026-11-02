import { getZonedClock } from './calendar.mjs';

export const scenePresets = [
  { id: 'galaxy', name: '星系漫游', shortName: '星系', description: '旋臂、星尘与深空' },
  { id: 'aurora', name: '极光之境', shortName: '极光', description: '缓缓流动的光幕' },
  { id: 'ocean', name: '日落海面', shortName: '海面', description: '波浪、倒影与远方' },
];
export const openingPresets = [
  { id: 'particles', name: '粒子汇聚' },
  { id: 'portal', name: '星门开启' },
];

// A fixed seeded shuffle: reproducible on every device, all six pairs included.
const pairs = scenePresets.flatMap(scene => openingPresets.map(opening => ({ scene: scene.id, opening: opening.id })));
let seed = 20261102;
function random() {
  let value = seed += 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
for (let i = pairs.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
}

// The head bootstrap uses the same schedule before browser modules load.
export { pairs as dailyMotionPairs };

export function getDailyMotion(now = new Date()) {
  const { dateKey, day } = getZonedClock(now);
  const tail = day % 10;
  return { dateKey, tail, ...pairs[tail % pairs.length] };
}

export function resolveMotion(preferences = {}, now = new Date()) {
  const daily = getDailyMotion(now);
  const today = preferences.selectionDate === daily.dateKey;
  const manualScene = today && scenePresets.some(scene => scene.id === preferences.scene);
  const manualOpening = today && openingPresets.some(opening => opening.id === preferences.opening);
  return {
    ...daily,
    scene: manualScene ? preferences.scene : daily.scene,
    opening: manualOpening ? preferences.opening : daily.opening,
    sceneMode: manualScene ? 'manual' : 'daily',
    openingMode: manualOpening ? 'manual' : 'daily',
  };
}
