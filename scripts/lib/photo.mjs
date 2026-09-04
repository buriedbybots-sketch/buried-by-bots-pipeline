// Optional stock-photo backdrops from Pixabay. A scene's `photo` cell is a
// search term ("empty office desk") or a numeric Pixabay image id, for when
// the first search hit has a logo in it and you want to pick by hand.
//
// Free API, key from PIXABAY_KEY, never in a file. No key → no photos, and
// the build says so once and carries on; the scenes render exactly as before.
// Pixabay asks that API results be cached, so each image is fetched once into
// public/photos/<id>/<n>.jpg and reused on every rebuild.
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';

export const fetchPhotos = async (content) => {
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

    const q = new URLSearchParams({key, image_type: 'photo', orientation: 'vertical', safesearch: 'true', per_page: '3'});
    if (/^\d+$/.test(scene.photo)) q.set('id', scene.photo);
    else {
      q.set('q', scene.photo);
      q.set('editors_choice', 'true');
    }
    const res = await fetch(`https://pixabay.com/api/?${q}`);
    if (!res.ok) throw new Error(`pixabay: ${res.status} ${await res.text()}`);
    const hit = (await res.json()).hits?.[0];
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
