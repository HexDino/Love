// ============================================================================
// LoveBox 3D - Mock Supabase (PostgREST + Storage) cho DEV
// ----------------------------------------------------------------------------
// Muc dich: chay thu toan bo luong (tao don -> polling -> webhook -> mo khoa)
// ma KHONG can tai khoan Supabase that.
//
// Cach dung:
//   Terminal 1:  node tools/mock-supabase.cjs
//   Terminal 2:  npm run dev:demo
//
// Du lieu chi luu trong RAM, tat server la mat sach. KHONG dung cho production.
// ============================================================================

const http = require('http');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.MOCK_PORT || 3199);
const gifts = [];

function send(res, status, body, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Expose-Headers': '*',
    ...extra
  };
  if (body === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

// PostgREST tra loi nay khi .single()/.maybeSingle() khong tim thay dong nao
function noRows(res) {
  send(res, 406, {
    code: 'PGRST116',
    details: 'The result contains 0 rows',
    hint: null,
    message: 'JSON object requested, multiple (or no) rows returned'
  });
}

function applyFilters(rows, params) {
  let out = rows.slice();
  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    if (!value.startsWith('eq.')) continue;
    const wanted = value.slice(3);
    out = out.filter((row) => String(row[key]) === wanted);
  }
  return out;
}

function project(row, selectRaw) {
  if (!selectRaw || selectRaw === '*') return { ...row };
  const cols = selectRaw.split(',').map((c) => c.trim()).filter(Boolean);
  const out = {};
  for (const col of cols) out[col] = row[col];
  return out;
}

function log(...args) {
  console.log(`[mock-supabase]`, ...args);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const wantsObject = (req.headers.accept || '').includes('pgrst.object');

    // ---------------- Storage ----------------
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const key = url.pathname.replace('/storage/v1/object/', '');
      log(`STORAGE ${req.method} ${key}`);
      return send(res, 200, { Key: key });
    }

    // ---------------- RPC ----------------
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.replace('/rest/v1/rpc/', '');
      if (fn === 'increment_gift_view') {
        const { p_slug } = JSON.parse(raw || '{}');
        const gift = gifts.find((g) => g.slug === p_slug);
        if (gift) gift.view_count += 1;
        log(`RPC increment_gift_view slug=${p_slug} -> ${gift ? gift.view_count : 'not found'}`);
        return send(res, 200, null);
      }
      log(`RPC ${fn} (khong ho tro)`);
      return send(res, 404, { message: `function ${fn} not found` });
    }

    // ---------------- REST /rest/v1/gifts ----------------
    if (url.pathname.startsWith('/rest/v1/gifts')) {
      const params = url.searchParams;
      const select = params.get('select') || '*';

      if (req.method === 'POST') {
        const body = JSON.parse(raw || '{}');
        const row = Array.isArray(body) ? body[0] : body;
        if (gifts.some((g) => g.slug === row.slug)) {
          return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        }
        const record = {
          id: randomUUID(),
          view_count: 0,
          is_paid: false,
          paid_at: null,
          payment_ref: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row
        };
        gifts.push(record);
        log(`INSERT slug=${record.slug} code=${record.transfer_code} receiver="${record.receiver_name}"`);
        return send(res, 201, project(record, select));
      }

      if (req.method === 'PATCH') {
        const body = JSON.parse(raw || '{}');
        const matched = applyFilters(gifts, params);
        log(`PATCH -> ${matched.length} dong khop`, JSON.stringify(body));
        if (matched.length === 0) return noRows(res);
        Object.assign(matched[0], body, { updated_at: new Date().toISOString() });
        return send(res, 200, project(matched[0], select));
      }

      if (req.method === 'GET') {
        const matched = applyFilters(gifts, params);
        log(`SELECT ${select} -> ${matched.length} dong`);
        if (matched.length === 0) {
          if (wantsObject) return noRows(res);
          return send(res, 200, []);
        }
        if (wantsObject) return send(res, 200, project(matched[0], select));
        return send(res, 200, matched.map((r) => project(r, select)));
      }
    }

    log(`KHONG XU LY DUOC ${req.method} ${url.pathname}`);
    send(res, 404, { message: 'not found' });
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌────────────────────────────────────────────────┐');
  console.log('  │  LoveBox 3D - Mock Supabase dang chay           │');
  console.log(`  │  http://localhost:${PORT}                          │`);
  console.log('  │  Du lieu luu trong RAM, tat la mat sach         │');
  console.log('  └────────────────────────────────────────────────┘');
  console.log('');
});
