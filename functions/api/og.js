// Compat shim: the Vercel-era OG endpoint (/api/og?id=N) lives on in cached
// social-share URLs. Cards are now pre-rendered by the daily Actions scrape
// (batch doctrine — satori never runs in a serving function); this just
// points old URLs at the static file. No id → the default card.
export function onRequestGet(ctx) {
  const id = new URL(ctx.request.url).searchParams.get('id');
  const target = /^\d+$/.test(id || '') ? `/og-events/${id}.png` : '/og-events/default.png';
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
