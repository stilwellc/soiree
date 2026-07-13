// Source-health reading (ported from lib/source-health.js — serving side only).
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
//
// Writing (recordSourceHealth) happens in the scrape batch jobs, never here.

const LOW_RATIO = 0.4;       // below 40% of expected → low
const MIN_EXPECTED = 4;      // don't cry wolf for naturally tiny sources
const STALE_HOURS = 30;      // missed a daily cycle (no reading in >30h) → down

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

function statusFor(row, now = Date.now()) {
  const ageH = (now - new Date(row.last_seen).getTime()) / 3.6e6;
  const readings = Array.isArray(row.history) ? row.history.length : 0;
  // Order matters:
  //   1) stale (no reading in >STALE_HOURS) → down, regardless of history length —
  //      a source that stopped reporting is broken even if it's new.
  //   2) too few readings → learning — a brand-new venue with 1 reading and a
  //      legitimate 0 count shouldn't false-flag as down before it's established.
  //   3) established source at 0 this run → down — the real silent-failure signal.
  if (ageH > STALE_HOURS) return 'down';
  if (readings < 3) return 'learning';
  if (row.last_count === 0) return 'down';
  if (row.expected >= MIN_EXPECTED && row.last_count < Math.round(row.expected * LOW_RATIO)) return 'low';
  return 'ok';
}

/** Read the current health of every tracked source, worst first. */
export async function readSourceHealth(pool) {
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
