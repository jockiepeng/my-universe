import { sceneFragmentShader } from '../lib/scene-shaders.mjs';

const canvas = document.querySelector<HTMLCanvasElement>('[data-home-scene]');
if (canvas) {
  const surface = canvas;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let gl: WebGLRenderingContext | null = null;
  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  let frame = 0, last = 0, elapsed = 0, warp = 0;
  let pointer = [.5, .5];
  let onScreen = true;

  function initialize() {
    try {
      const context = surface.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (!context) throw new Error('WebGL unavailable');
      const compile = (type: number, source: string) => {
        const shader = context.createShader(type)!;
        context.shaderSource(shader, source); context.compileShader(shader);
        if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
          const message = context.getShaderInfoLog(shader); context.deleteShader(shader);
          throw new Error(message || 'Shader compilation failed');
        }
        return shader;
      };
      const vertex = compile(context.VERTEX_SHADER, 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}');
      const fragment = compile(context.FRAGMENT_SHADER, sceneFragmentShader);
      const program = context.createProgram()!;
      context.attachShader(program, vertex); context.attachShader(program, fragment); context.linkProgram(program);
      context.deleteShader(vertex); context.deleteShader(fragment);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Shader linking failed');
      context.useProgram(program);
      const buffer = context.createBuffer(); context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), context.STATIC_DRAW);
      const position = context.getAttribLocation(program, 'position');
      context.enableVertexAttribArray(position); context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
      uniforms = Object.fromEntries(['resolution', 'mouse', 'time', 'warp', 'mode'].map(name => [name, context.getUniformLocation(program, `u_${name}`)]));
      gl = context; surface.dataset.renderer = 'webgl';
    } catch {
      gl = null; surface.dataset.renderer = 'fallback';
    }
  }
  function draw() {
    if (!gl) return;
    gl.viewport(0, 0, surface.width, surface.height);
    gl.uniform2f(uniforms.resolution, surface.width, surface.height);
    gl.uniform2f(uniforms.mouse, pointer[0], pointer[1]);
    gl.uniform1f(uniforms.time, elapsed); gl.uniform1f(uniforms.warp, warp);
    gl.uniform1i(uniforms.mode, root.dataset.scene === 'ocean' ? 2 : root.dataset.scene === 'aurora' ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function enabled() { return Boolean(gl) && root.dataset.motion !== 'off' && !reduced.matches && !document.hidden && onScreen; }
  function tick(now: number) {
    frame = 0;
    if (!enabled()) return;
    if (!last || now - last >= 32) {
      elapsed += last ? Math.min((now - last) / 1000, .1) * .65 : 0;
      last = now; draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    surface.dataset.state = enabled() ? 'running' : 'paused'; draw();
    if (enabled()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const box = surface.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1, 1100 / Math.max(1, box.width));
    surface.width = Math.max(1, Math.round(box.width * ratio)); surface.height = Math.max(1, Math.round(box.height * ratio));
    sync();
  }
  initialize(); resize();
  new ResizeObserver(resize).observe(surface);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-scene', 'data-motion'] });
  new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); }).observe(surface);
  window.addEventListener('universe:entry-progress', event => { warp = (event as CustomEvent<{ warp: number }>).detail.warp; });
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !enabled()) return;
    const box = surface.getBoundingClientRect(); pointer = [event.clientX / box.width, 1 - event.clientY / box.height];
  });
  document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); last = 0; }); window.addEventListener('pageshow', sync);
  surface.addEventListener('webglcontextlost', event => { event.preventDefault(); gl = null; surface.dataset.renderer = 'fallback'; sync(); });
  surface.addEventListener('webglcontextrestored', () => { initialize(); resize(); });
}
