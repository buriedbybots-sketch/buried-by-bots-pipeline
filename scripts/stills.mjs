// One still per scene, at the frame where its animation has settled, so the
// look of a row can be checked in a minute instead of a three-minute render:
//
//   npm run stills -- showcase          → out/stills/showcase-1-hook.jpg …
//
// Needs out/<id>.props.json, which build.mjs writes before it renders — so
// run the build once (or let it fail at the render) and this works after.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';

const id = process.argv[2] || 'sample';
const at = Number(process.argv[3] || 45); // frames into the scene

const {content, audio} = JSON.parse(readFileSync(`out/${id}.props.json`, 'utf8'));
const lens = audio.scenes.map((s) => Math.max(1, Math.ceil((s.durationMs / 1000) * 30)) + 8);
mkdirSync('out/stills', {recursive: true});

let from = 0;
content.scenes.forEach((scene, i) => {
  const frame = from + Math.min(at, lens[i] - 1);
  const file = `out/stills/${id}-${i + 1}-${scene.type}.jpg`;
  execFileSync('npx', ['remotion', 'still', 'src/index.jsx', 'Short', file, `--frame=${frame}`, `--props=out/${id}.props.json`], {
    stdio: 'ignore',
    shell: true,
  });
  console.log(`${file}  (frame ${frame})`);
  from += lens[i];
});
