// The five "artifact" scenes: screenshots of the software a US tech job seeker
// lives inside. A job req, a rejection email, a market chart, a levels.fyi
// band, a ChatGPT answer. Each one is illegible to most of the planet and
// magnetic to exactly one person — that is the targeting mechanism.
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from '../theme.js';
import {ease, center, kicker, mono, Card, TitleBar, Source} from './ui.jsx';

// Cards sit a little above centre so the caption band underneath stays clear.
const stage = {...center, padding: '0 70px 220px'};

// A source chip inside a card wraps instead of running off the edge — the
// card is only 940px wide and a citation can be long.
const inCard = {fontSize: 22, padding: '8px 18px', whiteSpace: 'normal', display: 'inline-block', maxWidth: '100%', lineHeight: 1.35};

// `*like this*` inside any sheet cell renders orange. A line that only opens
// the star (`*Python, 5+ years`) is orange to the end.
const hi = (text, on = 1) => {
  const parts = String(text ?? '').split(/(\*[^*]*\*?)/g);
  return parts.map((p, i) =>
    p.startsWith('*') ? (
      <span key={i} style={{color: on ? C.orange : C.paper, transition: 'none'}}>
        {p.replace(/^\*|\*$/g, '')}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
};

// "Label|value" rows out of a multi-line sheet cell.
const rows = (lines = []) =>
  lines
    .filter((l) => l.trim())
    .map((l) => {
      const [label, value = ''] = l.split('|');
      return {label: label.trim(), value: value.trim()};
    });

// Count a "$185,000 /yr" string up from zero, keeping its prefix and suffix.
const countUp = (value, s) => {
  const m = String(value).match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!m) return value;
  const n = Number(m[2].replace(/,/g, ''));
  return `${m[1]}${Math.round(n * s).toLocaleString('en-US')}${m[3]}`;
};

const fadeAt = (frame, at, len = 10) =>
  interpolate(frame, [at, at + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// ---------------------------------------------------------------- posting
// A Greenhouse/Workday-style req card. Title, US location, $ band, and a
// requirements list with the bullets that matter turned orange.
export const Posting = ({title, company, location, pay, lines = [], source}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const s = ease(frame, fps, 0, 30);
  const reqs = lines.filter((l) => l.trim());
  // The card lands in the first second; the highlights are the story, so
  // they arrive one at a time across the middle of the scene, and the Apply
  // button last. A ten-second req with nothing moving reads as a screenshot.
  const hot = reqs.map((l, i) => i).filter((i) => reqs[i].trim().startsWith('*'));
  const hotAt = (i) => {
    const k = hot.indexOf(i);
    return k === -1 ? Infinity : Math.round(durationInFrames * (0.3 + (0.4 * k) / Math.max(1, hot.length - 1 || 1)));
  };
  const applyAt = Math.round(durationInFrames * 0.82);

  return (
    <div style={stage}>
      <Card s={s}>
        <TitleBar label={`boards.greenhouse.io/${(company || 'company').toLowerCase().replace(/\W+/g, '')}`} />
        <div style={{padding: '38px 44px 44px'}}>
          {company ? (
            <div style={{...mono, fontSize: 28, color: C.steel, letterSpacing: '3px', textTransform: 'uppercase'}}>
              {company}
            </div>
          ) : null}
          <div style={{fontSize: 68, fontWeight: 800, color: C.paper, lineHeight: 1.05, marginTop: 10}}>{title}</div>
          <div style={{...mono, fontSize: 30, color: C.steel, marginTop: 20, lineHeight: 1.4}}>{location}</div>
          {pay ? (
            <div style={{fontSize: 58, fontWeight: 700, color: C.paper, marginTop: 22, lineHeight: 1}}>
              {pay}
              <span style={{...mono, fontSize: 26, color: C.steel, marginLeft: 18}}>base</span>
            </div>
          ) : null}

          <div style={{...kicker, fontSize: 30, letterSpacing: '3px', marginTop: 44, marginBottom: 14}}>
            Requirements
          </div>
          {reqs.map((l, i) => {
            const o = fadeAt(frame, 14 + i * 5);
            const on = frame >= hotAt(i);
            const pop = on ? 1 + 0.03 * Math.max(0, 1 - (frame - hotAt(i)) / 10) : 1;
            const hot = l.trim().startsWith('*');
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 22,
                  padding: '10px 0',
                  fontSize: 38,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: C.paper,
                  opacity: o,
                  transform: `scale(${pop})`,
                  transformOrigin: 'left center',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 8,
                    borderRadius: 4,
                    background: hot && on ? C.orange : C.line,
                    boxShadow: hot && on ? '0 0 18px 2px rgba(255,77,46,0.6)' : 'none',
                    marginTop: 4,
                  }}
                />
                <span>{hi(l, on)}</span>
              </div>
            );
          })}

          <div
            style={{
              display: 'inline-block',
              marginTop: 36,
              padding: '16px 40px',
              borderRadius: 12,
              background: C.orange,
              color: C.void,
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '1px',
              whiteSpace: 'nowrap',
              opacity: ease(frame, fps, applyAt, 20),
              transform: `scale(${0.9 + 0.1 * ease(frame, fps, applyAt, 20)})`,
            }}
          >
            Apply for this job
          </div>
          <div style={{marginTop: 26}}>
            <Source source={source} frame={frame} at={30} style={inCard} />
          </div>
        </div>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- rejection
// The most recognised email in this audience's inbox, at the hour it usually
// arrives. Wrap the phrase that stings in *stars* and it turns orange late.
const DEFAULT_BODY =
  'Thank you for your interest in the role. After careful review, *we’ve decided to move forward with other candidates* whose experience more closely aligns with our needs at this time.\n\nWe’ll keep your resume on file for future openings.';

export const Rejection = ({company = 'Talent Team', title, text, time = '4:12 AM'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = ease(frame, fps, 0, 30);
  const body = (text && text.trim()) || DEFAULT_BODY;
  const paras = body.split(/\n+/);
  const subject = title || `Your application to ${company}`;
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return (
    <div style={stage}>
      <Card s={s}>
        <TitleBar label="Inbox — 1 new" />
        <div style={{padding: '34px 44px 44px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <div style={{fontSize: 40, fontWeight: 700, color: C.paper}}>
              {company} Recruiting
              <span style={{...mono, fontSize: 24, color: C.steel, marginLeft: 16}}>no-reply@{slug}.com</span>
            </div>
            <div style={{...mono, fontSize: 26, color: C.steel, whiteSpace: 'nowrap'}}>{time}</div>
          </div>
          <div style={{...mono, fontSize: 24, color: C.steel, marginTop: 6}}>to me</div>
          <div style={{fontSize: 50, fontWeight: 800, color: C.paper, lineHeight: 1.1, marginTop: 30}}>
            {subject}
          </div>
          <div style={{height: 2, background: C.line, margin: '28px 0'}} />
          {paras.map((p, i) => (
            <div
              key={i}
              style={{
                fontSize: 40,
                fontWeight: 500,
                color: C.paper,
                lineHeight: 1.32,
                marginTop: i ? 26 : 0,
                opacity: fadeAt(frame, 12 + i * 8, 12),
              }}
            >
              {hi(p, frame > 34)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- market
// Two (or three) bars for the repositioning pillar. `lines` are
// "Label|-49" rows; negative bars are orange, positive are paper.
export const Market = ({label, lines = [], suffix = '%', source}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = rows(lines).map((r) => ({...r, n: Number(r.value.replace(/[^-\d.]/g, ''))}));
  const max = Math.max(1, ...data.map((d) => Math.abs(d.n)));

  return (
    <div style={{...stage, padding: '0 90px 220px'}}>
      {label ? <div style={{...kicker, marginBottom: 60, alignSelf: 'flex-start'}}>{label}</div> : null}
      <div style={{width: '100%'}}>
        {data.map((d, i) => {
          const grow = ease(frame, fps, 8 + i * 12, 40);
          const neg = d.n < 0;
          const w = (Math.abs(d.n) / max) * 640 * grow;
          return (
            <div key={i} style={{marginBottom: 64}}>
              <div style={{fontSize: 46, fontWeight: 600, color: C.paper, marginBottom: 18}}>{d.label}</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
                <div
                  style={{
                    width: w,
                    height: 72,
                    borderRadius: 10,
                    background: neg ? C.orange : C.paper,
                    boxShadow: neg ? '0 0 40px 8px rgba(255,77,46,0.35)' : 'none',
                  }}
                />
                <div style={{fontSize: 96, fontWeight: 800, color: neg ? C.orange : C.paper, lineHeight: 1}}>
                  {neg ? '−' : '+'}
                  {Math.round(Math.abs(d.n) * grow)}
                  {suffix}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Source source={source} frame={frame} at={40} style={{alignSelf: 'flex-start'}} />
    </div>
  );
};

// ---------------------------------------------------------------- comp
// A levels.fyi-style band. `lines` are "Base|$185,000" rows; `sub` is the
// counter-offer delta and comes in last, in orange.
export const Comp = ({title, lines = [], sub, source}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = ease(frame, fps, 0, 30);
  const data = rows(lines);
  const delta = ease(frame, fps, 14 + data.length * 8, 22);

  return (
    <div style={stage}>
      <Card s={s}>
        <TitleBar label="levels.fyi" />
        <div style={{padding: '34px 44px 40px'}}>
          <div style={{fontSize: 48, fontWeight: 800, color: C.paper, lineHeight: 1.1}}>{title}</div>
          <div style={{marginTop: 22}}>
            {data.map((d, i) => {
              const g = ease(frame, fps, 8 + i * 8, 30);
              const total = /total/i.test(d.label);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '20px 0',
                    borderTop: `2px solid ${C.line}`,
                    opacity: fadeAt(frame, 8 + i * 8),
                  }}
                >
                  <div style={{...mono, fontSize: 30, color: total ? C.paper : C.steel, letterSpacing: '2px'}}>
                    {d.label.toUpperCase()}
                  </div>
                  <div style={{fontSize: total ? 74 : 60, fontWeight: 800, color: C.paper, lineHeight: 1}}>
                    {countUp(d.value, g)}
                  </div>
                </div>
              );
            })}
          </div>
          {sub ? (
            <div
              style={{
                marginTop: 26,
                padding: '22px 30px',
                borderRadius: 14,
                border: `3px solid ${C.orange}`,
                color: C.orange,
                fontSize: 44,
                fontWeight: 800,
                lineHeight: 1.15,
                opacity: delta,
                transform: `translateY(${(1 - delta) * 20}px)`,
              }}
            >
              ↑ {sub}
            </div>
          ) : null}
          <div style={{marginTop: 30}}>
            <Source source={source} frame={frame} at={30} style={inCard} />
          </div>
        </div>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- terminal
// A ChatGPT-style answer filling in live. Shows what a prompt *does* without
// showing the prompt — the only format allowed for Vault 1, 2, 3 and 26.
export const Terminal = ({title = 'ChatGPT', head = 'Pasted my resume and the job description.', lines = []}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const s = ease(frame, fps, 0, 30);
  const body = lines.join('\n');
  const chars = Math.floor(
    interpolate(frame, [16, durationInFrames * 0.75], [0, body.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const shown = body.slice(0, chars);

  return (
    // anchored to the top, not centred: the card grows as the answer fills in
    // and a centred card would jump on every line
    <div style={{...stage, justifyContent: 'flex-start', paddingTop: 330}}>
      <Card s={s}>
        <TitleBar label={title} />
        <div style={{padding: '34px 40px 40px'}}>
          {head ? (
            <div style={{display: 'flex', justifyContent: 'flex-end'}}>
              <div
                style={{
                  maxWidth: '78%',
                  padding: '18px 30px',
                  borderRadius: 26,
                  borderTopRightRadius: 6,
                  background: '#232935',
                  color: C.paper,
                  fontSize: 34,
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {head}
              </div>
            </div>
          ) : null}
          <div style={{display: 'flex', gap: 22, marginTop: 34, opacity: fadeAt(frame, 10)}}>
            <div
              style={{
                flex: 'none',
                width: 44,
                height: 44,
                borderRadius: 22,
                background: C.orange,
                boxShadow: '0 0 24px 4px rgba(255,77,46,0.4)',
                marginTop: 4,
              }}
            />
            <pre
              style={{
                margin: 0,
                ...mono,
                fontSize: 32,
                lineHeight: 1.5,
                color: C.paper,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                flex: 1,
              }}
            >
              {hi(shown)}
              <span style={{color: C.orange, opacity: Math.floor(frame / 8) % 2 ? 0.2 : 1}}>▌</span>
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
};
