// Optional stock-photo backdrops from Pixabay. A scene's `photo` cell is a
// search term ("empty office desk") or a numeric Pixabay image id, for when
// the first search hit has a logo in it and you want to pick by hand.
//
// Free API, key from PIXABAY_KEY, never in a file. No key → no photos, and
// the build says so once and carries on; the scenes render exactly as before.
// Pixabay asks that API results be cached, so each image is fetched once into
// public/photos/<id>/<n>.jpg and reused on every rebuild.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';

// Blank cell → the default term for the scene type from links.json. `none` →
// no backdrop. Card scenes have no default: the card is the frame.
const defaults = () => JSON.parse(readFileSync('content/links.json', 'utf8')).photos || {};

export const fetchPhotos = async (content) => {
  const fallback = defaults();
  for (const s of content.scenes) {
    if (s.photo == null || s.photo === '') s.photo = fallback[s.type];
    if (String(s.photo).toLowerCase() === 'none') delete s.photo;
  }
  const wanted = content.scenes.map((s, i) => [s, i]).filter(([s]) => s.photo);
  if (!wanted.length) return;
  const key = process.env.PIXABAY_KEY;
  if (!key) {
    console.warn(`  ⚠ ${wanted.length} scene(s) name a photo but PIXABAY_KEY is not set — rendering without backdrops`);
    return;
  }
  mkdirSync(`public/photos/${content.id}`, {recursive: true});
  for (const [scene, i] of wanted) {
    const file = `photos/${content.id}/${i}.jpg`;
    scene.photoFile = file;
    if (existsSync(`public/${file}`)) continue;

    // "term @category" — the category is Pixabay's own taxonomy and is the
    // only lever that keeps a fish out of a "keyboard" search and a face out
    // of a "phone" search. Relevance falls off fast past the first few hits,
    // so only the top 6 are candidates.
    const q = new URLSearchParams({key, image_type: 'photo', orientation: 'vertical', safesearch: 'true', per_page: '6'});
    const [term, category] = String(scene.photo).split('@').map((x) => x.trim());
    if (/^\d+$/.test(term)) q.set('id', term);
    else {
      q.set('q', term);
      if (category) q.set('category', category);
    }
    const res = await fetch(`https://pixabay.com/api/?${q}`);
    if (!res.ok) throw new Error(`pixabay: ${res.status} ${await res.text()}`);
    // Same search term every day would mean the same photo every day. Pick
    // from the top hits by a hash of the video id so each date lands elsewhere.
    const hits = (await res.json()).hits || [];
    const seed = [...content.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, i + 7);
    const hit = hits.length ? hits[seed % hits.length] : null;
    if (!hit) {
      console.warn(`  ⚠ scene ${i + 1}: no Pixabay result for "${scene.photo}" — rendering without a backdrop`);
      delete scene.photoFile;
      continue;
    }
    // largeImageURL is 1280px on the long side, no watermark, enough for a
    // backdrop that is blurred and dimmed anyway.
    const img = await fetch(hit.largeImageURL);
    writeFileSync(`public/${file}`, Buffer.from(await img.arrayBuffer()));
    console.log(`  photo ${i + 1}: pixabay #${hit.id} by ${hit.user} → ${file}`);
  }
};
