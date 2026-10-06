import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installDomFixture } from './dom-fixture.mjs';

const moduleUrl = process.env.CREATOR_UI_DIR
  ? pathToFileURL(path.join(process.env.CREATOR_UI_DIR, 'studio-orb.mjs'))
  : new URL('../../../src/creator/studio-orb.mjs', import.meta.url);
const { createStudioOrb, createStudioOrbGeometry } = await import(moduleUrl);

// These checks exercise geometry and lifecycle in a deliberately mocked scheduler.
// They make no browser, pixels, native preference, or IntersectionObserver claims.
function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type) { for (const listener of [...listeners.get(type) || []]) listener(); },
    count(type) { return listeners.get(type)?.size || 0; }
  };
}

function browserFixture({ reduced = false, hidden = false } = {}) {
  const { document } = installDomFixture();
  const visibility = eventTarget(), mediaEvents = eventTarget();
  const media = Object.assign({ matches: reduced }, mediaEvents);
  const frames = new Map(), cancelled = [], observers = [];
  let nextId = 0, requests = 0;
  Object.assign(document, visibility, { hidden, visibilityState: hidden ? 'hidden' : 'visible' });
  document.defaultView = {
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media; },
    requestAnimationFrame(callback) { requests++; frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { cancelled.push(id); frames.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
    }
  };
  return {
    document, media, frames, observers, cancelled,
    get requests() { return requests; },
    enter(isIntersecting = true, intersectionRatio = isIntersecting ? 1 : 0) {
      const observer = observers[0];
      observer.callback([{ target: observer.target, isIntersecting, intersectionRatio }]);
    },
    flush(now) {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    },
    setReduced(matches) { media.matches = matches; media.emit('change'); },
    setHidden(value) {
      document.hidden = value;
      document.visibilityState = value ? 'hidden' : 'visible';
      document.emit('visibilitychange');
    }
  };
}

const drawing = orb => orb.element.children.map(node => node.getAttribute('d'));

test('deterministic sphere geometry has valid connected mesh and safe 400 × 240 bounds', () => {
  const original = createStudioOrbGeometry();
  assert.deepEqual(original, createStudioOrbGeometry());
  assert.equal(original.width, 400);
  assert.equal(original.height, 240);
  assert.equal(original.points.length, 162);
  assert.equal(original.edges.length, 480);
  assert.equal(new Set(original.edges.map(edge => edge.join(':'))).size, original.edges.length);
  const degree = new Array(original.points.length).fill(0);
  for (const [a, b] of original.edges) {
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a < b && b < degree.length);
    degree[a]++;
    degree[b]++;
  }
  assert.ok(degree.every(count => count === 5 || count === 6));
  assert.ok(original.points.filter(point => point.gold).length >= 12);
  assert.notDeepEqual(original.points, createStudioOrbGeometry(1).points);
  assert.deepEqual(original, createStudioOrbGeometry(Infinity));
  for (let angle = -Math.PI * 2; angle <= Math.PI * 2; angle += Math.PI / 16) {
    for (const point of createStudioOrbGeometry(angle).points) {
      assert.ok(Object.values(point).every(value => typeof value === 'boolean' || Number.isFinite(value)));
      const extent = point.radius * 2.8;
      assert.ok(point.x - extent > 0 && point.x + extent < original.width);
      assert.ok(point.y - extent > 0 && point.y + extent < original.height);
    }
  }
});

test('minimal DOM receives complete accessible-hidden static SVG without touching synchronous global rAF', () => {
  const { document } = installDomFixture();
  let calls = 0;
  globalThis.requestAnimationFrame = callback => { calls++; callback(); };
  const orb = createStudioOrb(document);
  assert.equal(orb.element.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(orb.element.getAttribute('aria-hidden'), 'true');
  assert.equal(orb.element.getAttribute('focusable'), 'false');
  assert.equal(orb.element.getAttribute('viewBox'), '0 0 400 240');
  assert.equal(orb.element.children.length, 7);
  assert.ok(drawing(orb).every(data => data && !/NaN|Infinity/.test(data)));
  orb.setMotion('auto');
  orb.setMotion('off');
  orb.dispose();
  orb.dispose();
  assert.equal(calls, 0);
});

test('missing observation or media capability leaves static geometry without animation requests', () => {
  for (const capability of ['IntersectionObserver', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    const fixture = browserFixture();
    delete fixture.document.defaultView[capability];
    const orb = createStudioOrb(fixture.document);
    orb.setMotion('auto');
    assert.equal(fixture.requests, 0, capability);
    assert.equal(fixture.document.count('visibilitychange'), 0, capability);
    assert.ok(drawing(orb).every(Boolean));
    orb.dispose();
  }
});

test('reduced motion blocks initial animation and live preference changes cancel or resume it', () => {
  const fixture = browserFixture({ reduced: true });
  const orb = createStudioOrb(fixture.document);
  const initial = drawing(orb);
  fixture.enter();
  assert.equal(fixture.frames.size, 0);
  fixture.setReduced(false);
  assert.equal(fixture.frames.size, 1);
  fixture.flush(0);
  fixture.flush(34);
  assert.notDeepEqual(drawing(orb), initial);
  fixture.setReduced(true);
  assert.equal(fixture.frames.size, 0);
  const stopped = drawing(orb);
  fixture.flush(1000);
  assert.deepEqual(drawing(orb), stopped);
  fixture.setReduced(false);
  assert.equal(fixture.frames.size, 1);
  orb.dispose();
});

test('explicit off overrides visibility and system motion preference, including repeated changes', () => {
  const fixture = browserFixture();
  const orb = createStudioOrb(fixture.document, { motion: 'off' });
  fixture.enter();
  fixture.setReduced(false);
  assert.equal(fixture.requests, 0);
  orb.setMotion('auto');
  orb.setMotion('auto');
  assert.equal(fixture.frames.size, 1);
  assert.equal(fixture.requests, 1);
  orb.setMotion('off');
  assert.equal(fixture.frames.size, 0);
  fixture.setHidden(true);
  fixture.setHidden(false);
  fixture.enter();
  assert.equal(fixture.frames.size, 0);
  orb.setMotion('auto');
  assert.equal(fixture.frames.size, 1);
  orb.dispose();
});

test('document hidden and out-of-view gates cancel frames and resume without catch-up jumps', () => {
  const fixture = browserFixture({ hidden: true });
  const orb = createStudioOrb(fixture.document);
  fixture.enter();
  assert.equal(fixture.frames.size, 0);
  fixture.setHidden(false);
  fixture.flush(0);
  fixture.flush(34);
  const firstFrame = drawing(orb);
  fixture.setHidden(true);
  assert.equal(fixture.frames.size, 0);
  fixture.setHidden(false);
  fixture.flush(100000);
  assert.deepEqual(drawing(orb), firstFrame, 'Resuming establishes a fresh clock instead of catching up');
  fixture.enter(false);
  assert.equal(fixture.frames.size, 0);
  fixture.enter(true, 0);
  assert.equal(fixture.frames.size, 0, 'Touching the viewport edge is not visible content');
  fixture.enter(true, 0.01);
  assert.equal(fixture.frames.size, 1);
  orb.dispose();
});

test('geometry paints at no more than 30 fps and repeated intersection events keep one pending frame', () => {
  const fixture = browserFixture();
  const orb = createStudioOrb(fixture.document);
  let paints = 0;
  const pathNode = orb.element.children[0], setAttribute = pathNode.setAttribute.bind(pathNode);
  pathNode.setAttribute = (name, value) => { if (name === 'd') paints++; setAttribute(name, value); };
  fixture.enter();
  fixture.enter();
  assert.equal(fixture.frames.size, 1);
  for (let now = 0; now <= 1000; now++) {
    fixture.flush(now);
    assert.equal(fixture.frames.size, 1);
  }
  assert.ok(paints > 0 && paints <= 30, `Observed ${paints} paints in one second`);
  orb.dispose();
});

test('dispose cancels the clock, disconnects observation, removes listeners and ignores stale callbacks', () => {
  const fixture = browserFixture();
  const orb = createStudioOrb(fixture.document);
  fixture.enter();
  const staleFrame = [...fixture.frames.values()][0];
  const requests = fixture.requests, before = drawing(orb);
  assert.equal(fixture.document.count('visibilitychange'), 1);
  assert.equal(fixture.media.count('change'), 1);
  orb.dispose();
  orb.dispose();
  assert.equal(fixture.cancelled.length, 1);
  assert.equal(fixture.frames.size, 0);
  assert.equal(fixture.observers[0].disconnected, true);
  assert.equal(fixture.document.count('visibilitychange'), 0);
  assert.equal(fixture.media.count('change'), 0);
  fixture.enter();
  fixture.setReduced(false);
  fixture.setHidden(false);
  staleFrame(5000);
  orb.setMotion('auto');
  assert.equal(fixture.requests, requests);
  assert.deepEqual(drawing(orb), before);
});

test('legacy media listeners also clean up, and unsupported synchronous clocks never recurse', () => {
  const fixture = browserFixture();
  const listeners = new Set();
  fixture.document.defaultView.matchMedia = () => ({
    matches: false,
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); }
  });
  let calls = 0;
  fixture.document.defaultView.requestAnimationFrame = callback => { calls++; callback(0); return 10; };
  const orb = createStudioOrb(fixture.document);
  assert.equal(listeners.size, 1);
  fixture.enter();
  assert.equal(calls, 1);
  orb.setMotion('auto');
  assert.equal(calls, 1);
  assert.deepEqual(fixture.cancelled, [10]);
  orb.dispose();
  assert.equal(listeners.size, 0);
});

test('observer startup failure preserves the full static SVG and releases installed listeners', () => {
  const fixture = browserFixture();
  fixture.document.defaultView.IntersectionObserver = class {
    observe() { throw new Error('observation unavailable'); }
    disconnect() { this.disconnected = true; }
  };
  const orb = createStudioOrb(fixture.document);
  assert.ok(drawing(orb).every(Boolean));
  assert.equal(fixture.requests, 0);
  assert.equal(fixture.media.count('change'), 0);
  assert.equal(fixture.document.count('visibilitychange'), 0);
  orb.dispose();
});
