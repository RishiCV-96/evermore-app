// The brand kit (brand-kit/, the designer's files) read as data, and the app's logo assets made from it.
// Shared by scripts/make-brand-assets.mjs (writes them) and scripts/check-brand.mjs (fails if any differs).
// No dependencies: the kit's SVGs are only circles, clip paths and one outlined path (absolute M, H, V,
// L, C and Z), so a small renderer here draws the composed PNGs, and the same renderer must reproduce the
// kit's own stacked PNG before anything it makes is trusted.
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';

export const KIT = new URL('../brand-kit/', import.meta.url);
export const ASSETS = new URL('../assets/images/', import.meta.url);
export const LOGO_DATA = new URL('../src/components/tandem-logo-data.ts', import.meta.url);

/** One lobe's radius in the kit's units: the clear space on every side (the brand guide). */
export const LOBE_RADIUS = 34;

const kitText = (name) => readFileSync(new URL(name, KIT), 'utf8');
const num = (value) => Number(value);

/** An SVG from the kit as shapes: its size, background, the mark's circles and the wordmark's path. */
export function parseSvg(text) {
  const box = text.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!box) throw new Error('no viewBox');
  const svg = { width: num(box[1]), height: num(box[2]), background: undefined, mark: undefined, word: undefined };
  const offsets = [[0, 0]];
  const clipped = [false];
  let inClip = false;
  const mark = { offset: undefined, clip: [], rose: [], sky: [], sun: [], colors: {} };
  for (const [, close, tag, attrs, selfClose] of text.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    const attr = (name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    if (tag === 'g' && close) {
      offsets.pop();
      clipped.pop();
    } else if (tag === 'g' && !selfClose) {
      const transform = attr('transform');
      if (transform && !/^translate\([^)]*\)$/.test(transform)) throw new Error(`unsupported transform ${transform}`);
      const [dx, dy] = transform ? transform.slice(10, -1).split(',').map(num) : [0, 0];
      const [x, y] = offsets.at(-1);
      offsets.push([x + dx, y + dy]);
      clipped.push(clipped.at(-1) || !!attr('clip-path'));
    } else if (tag === 'clipPath') inClip = !close;
    else if (tag === 'mask' && !close) throw new Error('masks are not read (the one-color files are not used by the app)');
    else if (tag === 'rect' && attr('fill')) svg.background = attr('fill');
    else if (tag === 'circle') {
      const circle = [num(attr('cx')), num(attr('cy')), num(attr('r'))];
      mark.offset ??= offsets.at(-1);
      if (inClip) mark.clip.push(circle);
      else {
        const role = clipped.at(-1) ? 'sun' : mark.rose.length < 4 ? 'rose' : 'sky';
        mark[role].push(circle);
        if (mark.colors[role] && mark.colors[role] !== attr('fill')) throw new Error(`${role} circles differ in color`);
        mark.colors[role] = attr('fill');
      }
    } else if (tag === 'path') {
      const transform = attr('transform') ?? 'translate(0,0)';
      const [dx, dy] = transform.slice(10, -1).split(',').map(num);
      const [x, y] = offsets.at(-1);
      svg.word = { offset: [x + dx, y + dy], d: attr('d'), fill: attr('fill') };
    }
  }
  if (mark.rose.length) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // The kit's construction: the sun is the right set clipped to the left set.
    if (!same(mark.clip, mark.rose) || !same(mark.sun, mark.sky) || mark.rose.length !== 4) throw new Error('the mark is not the kit’s construction');
    svg.mark = { offset: mark.offset, left: mark.rose, right: mark.sky, colors: mark.colors };
  }
  return svg;
}

/** Everything the app takes from the kit, checked to be one consistent design. */
export function readKit() {
  const horizontal = parseSvg(kitText('tandem-logo-horizontal.svg'));
  const reversed = parseSvg(kitText('tandem-logo-horizontal-reversed.svg'));
  const stacked = parseSvg(kitText('tandem-logo-stacked.svg'));
  const markOnly = parseSvg(kitText('tandem-mark.svg'));
  const geometry = (svg) => JSON.stringify([svg.mark.left, svg.mark.right]);
  for (const svg of [reversed, stacked, markOnly]) if (geometry(svg) !== geometry(horizontal)) throw new Error('the kit’s marks differ');
  if (reversed.word.d !== horizontal.word.d) throw new Error('the reversed wordmark differs');
  const palette = (svg) => ({ rose: svg.mark.colors.rose, sky: svg.mark.colors.sky, sun: svg.mark.colors.sun, word: svg.word.fill });
  return {
    mark: { left: horizontal.mark.left, right: horizontal.mark.right },
    palettes: { normal: palette(horizontal), reversed: palette(reversed) },
    reversedBackground: reversed.background,
    layouts: { horizontal, stacked, mark: markOnly },
  };
}

// ---- Paths ----

/** The wordmark's outline as closed polygons, in the kit's units, flattened finely enough for any size used. */
export function polygons(d, [ox, oy], steps = 24) {
  const out = [];
  let ring = [];
  let x = 0;
  let y = 0;
  const tokens = d.match(/[MHVLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0;
  const next = () => num(tokens[i++]);
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') {
      if (ring.length) out.push(ring);
      x = next();
      y = next();
      ring = [[x + ox, y + oy]];
    } else if (command === 'H') ring.push([(x = next()) + ox, y + oy]);
    else if (command === 'V') ring.push([x + ox, (y = next()) + oy]);
    else if (command === 'L') {
      x = next();
      y = next();
      ring.push([x + ox, y + oy]);
    } else if (command === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [next(), next(), next(), next(), next(), next()];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        ring.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3 + ox, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 + oy]);
      }
      x = x3;
      y = y3;
    } else if (command === 'Z') {
      if (ring.length) out.push(ring);
      ring = [];
    } else throw new Error(`unsupported path command ${command}`);
  }
  if (ring.length) out.push(ring);
  return out;
}

/** The smallest box around the logo's drawing (circles and wordmark), in the kit's units. */
export function contentBox(layout) {
  const [mx, my] = layout.mark.offset;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [cx, cy, r] of [...layout.mark.left, ...layout.mark.right]) {
    x0 = Math.min(x0, mx + cx - r);
    y0 = Math.min(y0, my + cy - r);
    x1 = Math.max(x1, mx + cx + r);
    y1 = Math.max(y1, my + cy + r);
  }
  if (layout.word) {
    for (const ring of polygons(layout.word.d, layout.word.offset, 64)) {
      for (const [x, y] of ring) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ---- Rendering ----

const SUB = 8; // sub-scanlines per pixel; horizontal coverage is exact

function circleSpans(circles, y) {
  const spans = [];
  for (const [cx, cy, r] of circles) {
    const dy = y - cy;
    if (dy * dy < r * r) {
      const dx = Math.sqrt(r * r - dy * dy);
      spans.push([cx - dx, cx + dx]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  return merged;
}

function intersect(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (lo < hi) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return out;
}

function pathSpans(edges, y) {
  const crossings = [];
  for (const [x0, y0, x1, y1] of edges) {
    if ((y >= y0 && y < y1) || (y >= y1 && y < y0)) crossings.push([x0 + ((y - y0) * (x1 - x0)) / (y1 - y0), y1 > y0 ? 1 : -1]);
  }
  crossings.sort((a, b) => a[0] - b[0]);
  const spans = [];
  let winding = 0;
  let start = 0;
  for (const [x, dir] of crossings) {
    const before = winding;
    winding += dir;
    if (before === 0 && winding !== 0) start = x;
    else if (before !== 0 && winding === 0) spans.push([start, x]);
  }
  return spans;
}

/**
 * Draws a layout of the kit into RGBA pixels: `scale` pixels per kit unit, the kit's point (`origin`)
 * at the image's top left, on a transparent background unless `background` is given.
 */
export function render({ layout, palette, width, height, scale, origin = [0, 0], background }) {
  const toPixels = ([x, y]) => [(x - origin[0]) * scale, (y - origin[1]) * scale];
  const [mx, my] = layout.mark.offset;
  const circles = (list) => list.map(([cx, cy, r]) => [...toPixels([mx + cx, my + cy]), r * scale]);
  const left = circles(layout.mark.left);
  const right = circles(layout.mark.right);
  const edges = [];
  if (layout.word) {
    for (const ring of polygons(layout.word.d, layout.word.offset)) {
      const points = ring.map(toPixels);
      for (let k = 0; k < points.length; k++) {
        const [x0, y0] = points[k];
        const [x1, y1] = points[(k + 1) % points.length];
        if (y0 !== y1) edges.push([x0, y0, x1, y1]);
      }
    }
  }
  const layers = [
    { color: palette.rose, spans: (y) => circleSpans(left, y) },
    { color: palette.sky, spans: (y) => circleSpans(right, y) },
    { color: palette.sun, spans: (y) => intersect(circleSpans(left, y), circleSpans(right, y)) },
    ...(layout.word ? [{ color: palette.word, spans: (y) => pathSpans(edges, y) }] : []),
  ];
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const out = new Float64Array(width * height * 4);
  if (background) {
    const [r, g, b] = rgb(background);
    for (let p = 0; p < width * height; p++) out.set([r, g, b, 1], p * 4);
  }
  const cover = new Float64Array(width);
  for (const layer of layers) {
    const [r, g, b] = rgb(layer.color);
    for (let py = 0; py < height; py++) {
      cover.fill(0);
      let any = false;
      for (let s = 0; s < SUB; s++) {
        for (const [a, z] of layer.spans(py + (s + 0.5) / SUB)) {
          const lo = Math.max(0, a);
          const hi = Math.min(width, z);
          for (let px = Math.floor(lo); px < hi; px++) {
            const part = Math.min(hi, px + 1) - Math.max(lo, px);
            if (part > 0) {
              cover[px] += part / SUB;
              any = true;
            }
          }
        }
      }
      if (!any) continue;
      for (let px = 0; px < width; px++) {
        const alpha = Math.min(1, cover[px]);
        if (!alpha) continue;
        const k = (py * width + px) * 4;
        out[k] = r * alpha + out[k] * (1 - alpha);
        out[k + 1] = g * alpha + out[k + 1] * (1 - alpha);
        out[k + 2] = b * alpha + out[k + 2] * (1 - alpha);
        out[k + 3] = alpha + out[k + 3] * (1 - alpha);
      }
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const alpha = out[p * 4 + 3];
    const a8 = Math.round(alpha * 255);
    if (!a8) continue;
    for (let c = 0; c < 3; c++) pixels[p * 4 + c] = Math.round((out[p * 4 + c] / alpha) * 255);
    pixels[p * 4 + 3] = a8;
  }
  return { width, height, pixels };
}

// ---- PNG ----

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, tail]);
}

/** RGBA pixels as a PNG, every row unfiltered. */
export function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** A PNG (8-bit RGB or RGBA, not interlaced) as RGBA pixels. */
export function decodePng(file) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const data = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0 || ![2, 6].includes(body[9])) throw new Error('only 8-bit RGB or RGBA, not interlaced');
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? rows[y * stride + x - channels] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      rows[y * stride + x] = (value + [0, a, b, (a + b) >> 1, paeth][filter]) & 255;
    }
  }
  if (channels === 4) return { width, height, pixels: rows };
  const pixels = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) pixels.set([rows[p * 3], rows[p * 3 + 1], rows[p * 3 + 2], 255], p * 4);
  return { width, height, pixels };
}

/** How far two images are apart: the mean and the largest channel difference, over color drawn on transparency too. */
export function difference(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { mean: Infinity, max: Infinity, size: `${a.width}x${a.height} against ${b.width}x${b.height}` };
  let total = 0;
  let max = 0;
  for (let k = 0; k < a.pixels.length; k += 4) {
    // Compare premultiplied, so a transparent pixel's leftover color doesn't count.
    for (let c = 0; c < 4; c++) {
      const va = c === 3 ? a.pixels[k + 3] : (a.pixels[k + c] * a.pixels[k + 3]) / 255;
      const vb = c === 3 ? b.pixels[k + 3] : (b.pixels[k + c] * b.pixels[k + 3]) / 255;
      const diff = Math.abs(va - vb);
      total += diff;
      max = Math.max(max, diff);
    }
  }
  return { mean: total / a.pixels.length, max };
}

// ---- What the app gets ----

export const ROOT = new URL('../', import.meta.url);

/** The kit's files the app uses exactly as they are, by their path in the project. */
export const COPIED = {
  'assets/images/icon.png': 'tandem-app-icon-1024.png',
  // app.json's web.favicon: Expo makes /favicon.ico from it.
  'assets/images/favicon.png': 'tandem-favicon-256.png',
  'assets/images/splash-logo.png': 'tandem-logo-stacked.png',
  // The web build's head (public/index.html): the SVG where browsers take one, and the PNG.
  'public/favicon.svg': 'tandem-favicon.svg',
  'public/favicon.png': 'tandem-favicon-256.png',
};

/** Android's adaptive icon: 1024 square on Ink, the mark well inside the 66/108 safe circle (its widest point at 280 of 313). */
const ADAPTIVE = { size: 1024, scale: 2.5 };

/** The kit's navy app icon as a drawing: its 1024 square, background, and where the mark sits (translate and scale). */
export function appIcon(kit = readKit()) {
  const text = kitText('tandem-app-icon-1024.svg');
  const [, x, y, scale] = text.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)">/).map(Number);
  const colors = [...text.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((match) => match[1]);
  const [background, rose, , , , sky, , , , sun] = colors;
  if (rose !== kit.palettes.reversed.rose || sky !== kit.palettes.reversed.sky || sun !== kit.palettes.reversed.sun) throw new Error('the app icon’s colors differ from the reversed logo’s');
  return { size: 1024, background, at: [x, y], scale };
}

/** The navy app icon drawn at `size` pixels square, from the kit's own placement of the mark. */
export function renderAppIcon(size, kit = readKit()) {
  const icon = appIcon(kit);
  const { mark } = kit.layouts;
  const k = size / icon.size;
  // A kit unit (cx) lands at (at + scale * cx) * k pixels; the mark layout already adds its own offset.
  const origin = [mark.mark.offset[0] - icon.at[0] / icon.scale, mark.mark.offset[1] - icon.at[1] / icon.scale];
  return render({ layout: mark, palette: kit.palettes.reversed, width: size, height: size, scale: icon.scale * k, origin, background: icon.background });
}

/** The images composed from the kit's shapes and colors, which the kit doesn't have as files. */
export function composed(kit = readKit()) {
  const { stacked, mark } = kit.layouts;
  const box = contentBox(mark);
  const half = ADAPTIVE.size / 2 / ADAPTIVE.scale;
  return {
    // The web build's home screen icon on iPhone: the navy app icon at 180 square.
    'public/apple-touch-icon.png': () => renderAppIcon(180, kit),
    // The stacked logo in the reversed colors, framed and sized exactly as the kit's stacked PNG (3x).
    'assets/images/splash-logo-dark.png': () =>
      render({ layout: stacked, palette: kit.palettes.reversed, width: Math.ceil(stacked.width * 3), height: Math.ceil(stacked.height * 3), scale: 3 }),
    'assets/images/android-icon-foreground.png': () =>
      render({
        layout: mark,
        // On Ink, as the kit's navy app icon: the reversed tints.
        palette: kit.palettes.reversed,
        width: ADAPTIVE.size,
        height: ADAPTIVE.size,
        scale: ADAPTIVE.scale,
        origin: [box.x + box.width / 2 - half, box.y + box.height / 2 - half],
      }),
  };
}

/** The renderer drawn against the kit's own PNGs (the stacked logo and the navy app icon): if either drifts, nothing it composes is trusted. */
export function rendererFidelity(kit = readKit()) {
  const { stacked } = kit.layouts;
  const kitStacked = decodePng(readFileSync(new URL('tandem-logo-stacked.png', KIT)));
  // The kit drew it at exactly 3x, on a canvas rounded up to whole pixels.
  const drawn = render({ layout: stacked, palette: kit.palettes.normal, width: kitStacked.width, height: kitStacked.height, scale: 3 });
  const stackedDiff = difference(drawn, kitStacked);
  const iconDiff = difference(renderAppIcon(1024, kit), decodePng(readFileSync(new URL('tandem-app-icon-1024.png', KIT))));
  return { mean: Math.max(stackedDiff.mean, iconDiff.mean), max: Math.max(stackedDiff.max, iconDiff.max), stacked: stackedDiff, icon: iconDiff };
}

/** JSON as TypeScript: unquoted keys, single quotes, and each list of numbers on one line. */
const tidy = (value) =>
  JSON.stringify(value, null, 2)
    .replace(/"(\w+)":/g, '$1:')
    .replace(/"([^"\n]*)"/g, "'$1'")
    .replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(', ')}]`);

/** src/components/tandem-logo-data.ts: the shapes and colors the app draws, from the kit. */
export function logoData(kit = readKit()) {
  const round = (value) => Math.round(value * 1000) / 1000;
  const frame = (layout) => {
    // Framed by the drawing itself plus one lobe radius on every side (the guide's clear space).
    const box = contentBox(layout);
    return [round(box.x - LOBE_RADIUS), round(box.y - LOBE_RADIUS), round(box.width + 2 * LOBE_RADIUS), round(box.height + 2 * LOBE_RADIUS)];
  };
  const layout = (svg) => ({
    viewBox: frame(svg),
    mark: svg.mark.offset,
    ...(svg.word ? { word: { at: svg.word.offset, d: svg.word.d } } : {}),
    markWidth: round(contentBox({ mark: svg.mark }).width),
  });
  const data = {
    MARK: kit.mark,
    PALETTES: kit.palettes,
    LAYOUTS: { horizontal: layout(kit.layouts.horizontal), stacked: layout(kit.layouts.stacked), mark: layout(kit.layouts.mark) },
  };
  const lines = [
    '// Generated by scripts/make-brand-assets.mjs from brand-kit/ (the designer’s files). Do not edit:',
    '// replace the kit and run it again. scripts/check-brand.mjs fails if this differs from the kit.',
    '// Each layout is framed by its drawing plus one lobe radius of clear space on every side.',
    '',
    `/** One lobe's radius in the kit's units: the clear space on every side. */`,
    `export const LOBE_RADIUS = ${LOBE_RADIUS};`,
    '',
    ...Object.entries(data).map(([name, value]) => `export const ${name} = ${tidy(value)} as const;\n`),
  ];
  return lines.join('\n');
}
