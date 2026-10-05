// Original mathematical ornament. It has no workspace data or network dependencies.
const SVG_NS = 'http://www.w3.org/2000/svg';
const FRAME_INTERVAL = 1000 / 30;
const INITIAL_ANGLE = 0.43;

function unit([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

// Subdivide a regular icosahedron, then gently perturb its surface analytically.
// Keeping connectivity independent of projection avoids unstable nearest-neighbour lines.
function buildMesh() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ].map(unit);
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  for (let level = 0; level < 2; level++) {
    const midpoints = new Map();
    const midpoint = (a, b) => {
      const key = [a, b].sort((x, y) => x - y).join(':');
      if (!midpoints.has(key)) {
        midpoints.set(key, vertices.length);
        vertices.push(unit(vertices[a].map((v, i) => (v + vertices[b][i]) / 2)));
      }
      return midpoints.get(key);
    };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  const edges = new Map();
  for (const [a, b, c] of faces) {
    for (const pair of [[a, b], [b, c], [c, a]]) {
      pair.sort((x, y) => x - y);
      edges.set(pair.join(':'), Object.freeze(pair));
    }
  }
  return {
    vertices: vertices.map(([x, y, z]) => {
      const ripple = 1 + 0.028 * Math.sin(7 * x + 3 * y) * Math.cos(5 * z - 2 * y);
      return [x * ripple, y * ripple, z * ripple];
    }),
    edges: Object.freeze([...edges.values()])
  };
}

const mesh = buildMesh();

/** Pure deterministic projection, in a 400 × 240 coordinate space. */
export function createStudioOrbGeometry(angle = INITIAL_ANGLE) {
  const turn = Number.isFinite(angle) ? angle : INITIAL_ANGLE;
  const tilt = 0.24 + Math.sin(turn * 0.5) * 0.045;
  const ct = Math.cos(turn), st = Math.sin(turn), cx = Math.cos(tilt), sx = Math.sin(tilt);
  const points = mesh.vertices.map(([x, y, z], index) => {
    const turnedX = x * ct + z * st, turnedZ = z * ct - x * st;
    const tippedY = y * cx - turnedZ * sx, depth = y * sx + turnedZ * cx;
    const perspective = 1 + depth * 0.035;
    return {
      x: 200 + turnedX * 102 * perspective,
      y: 120 + tippedY * 102 * perspective,
      depth,
      gold: index % 11 === 3 || index % 37 === 7,
      radius: 1.2 + (depth + 1.05) * 0.55
    };
  });
  return { width: 400, height: 240, points, edges: mesh.edges };
}

function pathPoint(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function disc(point, radius) {
  const r = radius.toFixed(2), diameter = (radius * 2).toFixed(2);
  return `M${(point.x - radius).toFixed(2)},${point.y.toFixed(2)}a${r},${r} 0 1,0 ${diameter},0a${r},${r} 0 1,0 -${diameter},0`;
}

/** A decorative SVG and its optional, fully disposable motion lifecycle. */
export function createStudioOrb(document, { motion = 'auto' } = {}) {
  const make = (tag, attributes) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  };
  const element = make('svg', {
    class: 'studio-orb', viewBox: '0 0 400 240', width: '400', height: '240',
    'aria-hidden': 'true', focusable: 'false', role: 'presentation',
    fill: 'none', preserveAspectRatio: 'xMidYMid meet'
  });
  const wires = [0.12, 0.24, 0.43].map(opacity => make('path', {
    class: 'studio-orb-wire', stroke: 'var(--studio-orb-wire, #42473c)',
    'stroke-width': '0.72', 'stroke-opacity': opacity, 'stroke-linecap': 'round'
  }));
  const glints = [0.27, 0.66, 0.96].map(opacity => make('path', {
    class: 'studio-orb-point', fill: 'var(--studio-orb-gold, #a58f4e)', 'fill-opacity': opacity
  }));
  const halos = make('path', {
    class: 'studio-orb-halo', fill: 'var(--studio-orb-gold, #a58f4e)', 'fill-opacity': '0.09'
  });
  element.append(...wires, halos, ...glints);

  function paint(angle) {
    const { points, edges } = createStudioOrbGeometry(angle);
    const lines = ['', '', ''], dots = ['', '', ''];
    let glow = '';
    const band = depth => depth < -0.25 ? 0 : depth < 0.35 ? 1 : 2;
    for (const [a, b] of edges) {
      lines[band((points[a].depth + points[b].depth) / 2)] += `M${pathPoint(points[a])}L${pathPoint(points[b])}`;
    }
    for (const point of points) {
      if (!point.gold) continue;
      dots[band(point.depth)] += disc(point, point.radius);
      if (point.depth > 0.35) glow += disc(point, point.radius * 2.8);
    }
    wires.forEach((node, index) => node.setAttribute('d', lines[index]));
    glints.forEach((node, index) => node.setAttribute('d', dots[index]));
    halos.setAttribute('d', glow);
  }

  // Always finish the static SVG before attempting any browser-only capability.
  paint(INITIAL_ANGLE);
  const view = document.defaultView;
  let preference = motion === 'off' ? 'off' : 'auto';
  let disposed = false, inView = false, frame = null, lastPaint = null;
  let angle = INITIAL_ANGLE, reduced = true, observer = null, media = null;
  let removeMediaListener = null, visibilityListening = false;
  let capable = false, scheduling = false, synchronousScheduler = false;

  const canAnimate = () => capable && !disposed && preference !== 'off' && !reduced &&
    inView && document.visibilityState === 'visible' && !document.hidden;

  function stop() {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    lastPaint = null;
  }

  function schedule() {
    if (!canAnimate() || frame !== null) return;
    scheduling = true;
    frame = view.requestAnimationFrame(tick);
    scheduling = false;
    // A synchronous test/polyfill scheduler is not a browser animation clock.
    if (synchronousScheduler) {
      capable = false;
      stop();
    }
  }

  function tick(now) {
    if (scheduling) { synchronousScheduler = true; return; }
    frame = null;
    if (!canAnimate()) { lastPaint = null; return; }
    if (!Number.isFinite(now)) { capable = false; return; }
    if (lastPaint === null) lastPaint = now;
    const elapsed = now - lastPaint;
    if (elapsed >= FRAME_INTERVAL) {
      angle += Math.min(elapsed, 100) * 0.00007;
      lastPaint = now;
      paint(angle);
    }
    schedule();
  }

  function syncMotion() {
    if (canAnimate()) schedule();
    else stop();
  }

  function onMediaChange() {
    reduced = media.matches;
    syncMotion();
  }

  function cleanListeners() {
    observer?.disconnect();
    observer = null;
    removeMediaListener?.();
    removeMediaListener = null;
    if (visibilityListening) document.removeEventListener('visibilitychange', syncMotion);
    visibilityListening = false;
  }

  // Do not touch rAF when observation or motion-preference support is absent.
  if (view && typeof view.requestAnimationFrame === 'function' &&
      typeof view.cancelAnimationFrame === 'function' && typeof view.matchMedia === 'function' &&
      typeof view.IntersectionObserver === 'function' &&
      typeof document.addEventListener === 'function' && typeof document.removeEventListener === 'function') {
    try {
      media = view.matchMedia('(prefers-reduced-motion: reduce)');
      const modern = typeof media.addEventListener === 'function' && typeof media.removeEventListener === 'function';
      const legacy = typeof media.addListener === 'function' && typeof media.removeListener === 'function';
      if (typeof media.matches === 'boolean' && (modern || legacy)) {
        reduced = media.matches;
        observer = new view.IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.target === element) inView = entry.isIntersecting && entry.intersectionRatio > 0;
          }
          syncMotion();
        }, { threshold: [0, 0.01] });
        if (modern) {
          media.addEventListener('change', onMediaChange);
          removeMediaListener = () => media.removeEventListener('change', onMediaChange);
        } else {
          media.addListener(onMediaChange);
          removeMediaListener = () => media.removeListener(onMediaChange);
        }
        document.addEventListener('visibilitychange', syncMotion);
        visibilityListening = true;
        capable = true;
        observer.observe(element);
      }
    } catch {
      capable = false;
      stop();
      cleanListeners();
    }
  }

  return {
    element,
    setMotion(next) {
      if (disposed) return;
      preference = next === 'off' ? 'off' : 'auto';
      syncMotion();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      cleanListeners();
    }
  };
}
