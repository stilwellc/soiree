// Source-health tracking & alerting.
//
// Each scrape records how many events every source produced. Over time each
// source learns its own "expected" level (the median of recent runs), so a
// silently-broken scraper — one that drops from 20 events to 0 — surfaces as a
// warning on the About page instead of quietly starving the site.
//
// A source is:
//   down     — produced 0 this run, or hasn't reported in >48h
//   low      — produced well below its own recent norm (< 40% of expected)
//   learning — too few readings yet to judge
//   ok       — healthy

const HISTORY_CAP = 14;      // readings retained per source
const LOW_RATIO = 0.4;       // below 40% of expected → low
const MIN_EXPECTED = 4;      // don't cry wolf for naturally tiny sources
const STALE_HOURS = 30;      // missed a daily cycle (no reading in >30h) → down

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_health (
      source     VARCHAR(120) PRIMARY KEY,
      last_count INTEGER      NOT NULL DEFAULT 0,
      last_seen  TIMESTAMP    NOT NULL DEFAULT NOW(),
      expected   INTEGER      NOT NULL DEFAULT 0,
      history    JSONB        NOT NULL DEFAULT '[]'
    )
  `);
}

/**
 * Record per-source counts for the events produced in one scrape run.
 * `events` is the array about to be (or just) upserted; only sources present
 * in it are updated, so a group scrape only touches its own sources.
 */
async function recordSourceHealth(pool, events, zeroFill = []) {
  const arr = Array.isArray(events) ? events : [];
  if (!arr.length && !zeroFill.length) return 0;
  await ensureTable(pool);

  const counts = {};
  // Seed every source that was ATTEMPTED this run at 0, so a source that ran
  // but produced nothing records a 0 (→ flagged down) instead of vanishing.
  for (const name of zeroFill) if (name) counts[String(name)] = 0;
  for (const e of arr) {
    const src = (e && e.source) ? String(e.source) : null;
    if (src) counts[src] = (counts[src] || 0) + 1;
  }

  const nowIso = new Date().toISOString();
  for (const [source, count] of Object.entries(counts)) {
    const { rows } = await pool.query('SELECT history FROM source_health WHERE source = $1', [source]);
    const prev = (rows[0] && Array.isArray(rows[0].history)) ? rows[0].history : [];
    // "expected" = median of PRIOR readings (excludes this run), so a fresh
    // drop is measured against the established norm, not itself.
    const priorCounts = prev.map(h => h.c).filter(n => typeof n === 'number');
    const expected = median(priorCounts.slice(-7));
    const history = [...prev, { c: count, t: nowIso }].slice(-HISTORY_CAP);

    await pool.query(`
      INSERT INTO source_health (source, last_count, last_seen, expected, history)
      VALUES ($1, $2, NOW(), $3, $4)
      ON CONFLICT (source) DO UPDATE
        SET last_count = EXCLUDED.last_count,
            last_seen  = NOW(),
            expected   = EXCLUDED.expected,
            history    = EXCLUDED.history
    `, [source, count, expected, JSON.stringify(history)]);
  }
  return Object.keys(counts).length;
}

function statusFor(row, now = Date.now()) {
  const ageH = (now - new Date(row.last_seen).getTime()) / 3.6e6;
  const readings = Array.isArray(row.history) ? row.history.length : 0;
  if (row.last_count === 0 || ageH > STALE_HOURS) return 'down';
  if (readings < 3) return 'learning';
  if (row.expected >= MIN_EXPECTED && row.last_count < Math.round(row.expected * LOW_RATIO)) return 'low';
  return 'ok';
}

/** Read the current health of every tracked source, worst first. */
async function readSourceHealth(pool) {
  await ensureTable(pool);
  const { rows } = await pool.query('SELECT * FROM source_health ORDER BY source ASC');
  const now = Date.now();
  const rank = { down: 0, low: 1, learning: 2, ok: 3 };
  const sources = rows.map(r => ({
    source: r.source,
    current: r.last_count,
    expected: r.expected,
    status: statusFor(r, now),
    lastSeen: r.last_seen,
    ageHours: Math.round((now - new Date(r.last_seen).getTime()) / 3.6e6),
  })).sort((a, b) => (rank[a.status] - rank[b.status]) || (b.expected - a.expected));

  const summary = { total: sources.length, ok: 0, low: 0, down: 0, learning: 0 };
  for (const s of sources) summary[s.status]++;
  return { sources, summary };
}

module.exports = { recordSourceHealth, readSourceHealth };
