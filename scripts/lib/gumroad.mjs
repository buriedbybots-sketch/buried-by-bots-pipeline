// Gumroad, for one purpose: knowing which video sold. Every video gets its
// own 10% discount code (YT0828 for 2026-08-28), the code rides in the
// product URL so the buyer never types it, and sales.mjs reads the sales
// back by code. Free API, token from GUMROAD_TOKEN (Settings → Advanced →
// Applications → generate access token). No token → no codes, plain links.
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

// Make sure an offer code exists on the product; returns true when it does.
export const ensureCode = async (pid, name, percent = 10) => {
  if (!process.env.GUMROAD_TOKEN) return false;
  const existing = await call('GET', `/products/${pid}/offer_codes`);
  if (existing.offer_codes.some((c) => c.name.toLowerCase() === name.toLowerCase())) return true;
  await call('POST', `/products/${pid}/offer_codes`, {name, amount_off: String(percent), offer_type: 'percent'});
  return true;
};

// Every sale of a product since a date (paginates), each with .offer_code.
export const sales = async (pid, after) => {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await call('GET', '/sales', {product_id: pid, after, page: String(page)});
    if (!res) return out;
    out.push(...(res.sales || []));
    if (!res.next_page_url) return out;
    page++;
  }
};
