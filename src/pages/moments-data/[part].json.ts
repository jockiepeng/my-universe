import snapshot from '../../data/moments.json';
import { buildMomentIndex, MOMENTS_PAGE_SIZE } from '../../lib/moments-search.mjs';

export function getStaticPaths() {
  const moments = snapshot.moments;
  return [
    { params: { part: 'index' }, props: { data: buildMomentIndex(moments) } },
    ...Array.from({ length: Math.ceil(moments.length / MOMENTS_PAGE_SIZE) }, (_, i) => ({
      params: { part: String(i + 1) }, props: { data: moments.slice(i * MOMENTS_PAGE_SIZE, (i + 1) * MOMENTS_PAGE_SIZE) },
    })),
  ];
}

export function GET({ props }: { props: { data: unknown } }) {
  return new Response(JSON.stringify(props.data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
