module.exports = function handler(req, res) {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <rect x="32" y="32" width="1136" height="566" rx="4" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1"/>
  <line x1="570" y1="200" x2="630" y2="200" stroke="#D4AF37" stroke-width="1"/>
  <text x="600" y="240" text-anchor="middle" fill="#D4AF37" font-size="14" letter-spacing="8" font-family="serif">&#9670;</text>
  <text x="600" y="340" text-anchor="middle" fill="#FAF8F3" font-size="96" font-weight="300" letter-spacing="-1" font-family="Georgia, 'Times New Roman', serif">Soir&#233;e</text>
  <line x1="580" y1="370" x2="620" y2="370" stroke="rgba(212,175,55,0.5)" stroke-width="1"/>
  <text x="600" y="410" text-anchor="middle" fill="#8B7355" font-size="20" letter-spacing="6" font-weight="300" font-family="Helvetica, Arial, sans-serif">CURATED EVENTS IN NYC</text>
  <text x="600" y="445" text-anchor="middle" fill="rgba(212,175,55,0.6)" font-size="14" letter-spacing="3" font-weight="300" font-family="Helvetica, Arial, sans-serif">ART &#183; MUSIC &#183; CULTURE &#183; FREE</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.send(svg);
};
