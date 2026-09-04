// Gumroad, for one purpose: knowing which video sold. Every video gets its
// own 10% discount code (YT0828 for 2026-08-28), the code rides in the
// product URL so the buyer never types it, and sales.mjs reads usage back
// by code. Free API, token from GUMROAD_TOKEN (Settings → Advanced →
// Applications → generate access token). No token → no codes, plain links.
//
// Two facts about the v2 API shape this file, both unverified against a live
// account until the operator has a token — verify with one real call:
//  - a sale object is NOT documented to carry the offer code it used, so the
//    primary attribution is the per-code usage count on
//    GET /products/:id/offer_codes (`claims_count` in the wild, `times_used`
//    in older writeups — both are read). Sales are still totalled, and
//    grouped by code only if the field happens to be there.
//  - /sales paginates with `page_key` → `next_page_key`, not a page number.
const API = 'https://api.gumroad.com/v2';

const call = async (method, path, params = {}) => {
  const token = process.env.GUMROAD_TOKEN;
  if (!token) return null;
  const body = new URLSearchParams({access_token: token, ...params});
  const res = await fetch(method === 'GET' ? `${API}${path}?${body}` : `${API}${path}`, {
    method,
    ...(method === 'GET' ? {} : {body}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`gumroad ${method} ${path}: ${res.status} ${json.message || ''}`);
  return json;
};

// The product id for a Gumroad short URL (…/l/zpydx → the id the API wants).
export const productId = async (url) => {
  const res = await call('GET', '/products');
  if (!res) return null;
  const slug = url.replace(/\/+$/, '').split('/').pop();
  const p = res.products.find((x) => x.short_url?.endsWith(`/${slug}`) || x.custom_permalink === slug);
  if (!p) throw new Error(`gumroad: no product with permalink "${slug}"`);
  return p.id;
};

// Every offer code on a product, with a normalised usage count (null when the
// API gives none — then only the sales list can tell you anything).
export const codes = async (pid) => {
  const res = await call('GET', `/products/${pid}/offer_codes`);
  if (!res) return [];
  return (res.offer_codes || []).map((c) => ({
    name: String(c.name || '').toUpperCase(),
    used: c.claims_count ?? c.times_used ?? c.uses_count ?? c.uses ?? null,
    percent: c.percent_off ?? (c.offer_type === 'percent' ? c.amount_cents ?? c.amount_off : null),
  }));
};

// Make sure an offer code exists on the product; returns true when it does.
export const ensureCode = async (pid, name, percent = 10) => {
  if (!process.env.GUMROAD_TOKEN) return false;
  if ((await codes(pid)).some((c) => c.name === name.toUpperCase())) return true;
  await call('POST', `/products/${pid}/offer_codes`, {name, amount_off: String(percent), offer_type: 'percent'});
  return true;
};

// Every sale of a product since a date. Each sale gets a normalised
// `.code` (upper-case string or null) whatever shape the API used, if any.
export const sales = async (pid, after) => {
  const out = [];
  let page_key;
  for (let guard = 0; guard < 50; guard++) {
    const res = await call('GET', '/sales', {product_id: pid, after, ...(page_key ? {page_key} : {})});
    if (!res) return out;
    for (const s of res.sales || []) {
      const raw = s.offer_code ?? s.offer_code_name ?? s.discount_code ?? null;
      const code = raw == null ? null : typeof raw === 'object' ? raw.name ?? raw.code ?? null : String(raw);
      out.push({...s, code: code ? code.toUpperCase() : null});
    }
    page_key = res.next_page_key;
    if (!page_key) return out;
  }
  return out;
};
