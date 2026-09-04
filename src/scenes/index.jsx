// Every scene type the sheet can name. Adding one means a component here and a
// column mapping in scripts/sheet.mjs — nothing else.
import {Hook, Rank, Stat, Prompt, Test, Cta} from './core.jsx';
import {Posting, Rejection, Market, Comp, Terminal} from './artifacts.jsx';

export const SCENES = {
  hook: Hook,
  rank: Rank,
  stat: Stat,
  prompt: Prompt,
  test: Test,
  cta: Cta,
  posting: Posting,
  rejection: Rejection,
  market: Market,
  comp: Comp,
  terminal: Terminal,
};

// Scenes that already put their line on screen in display type; captioning
// them again underneath says the same thing twice.
export const SELF_CAPTIONED = new Set(['hook', 'cta']);
