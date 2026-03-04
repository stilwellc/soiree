const { Resvg } = require('@resvg/resvg-js');
const { readFile } = require('fs/promises');
const { join } = require('path');

// Card background colors matching styles.css
const CARD_COLORS = {
  'Art & Culture': '#EDE8E0',
  'Perks & Pop-Ups': '#E8D5B0',
  'Food & Drink': '#D4AD8A'
};

// All sizes are scaled 2.88x from the client CSS (375px viewport → 1080px output)
const S = 2.88;

// Cache font + logo data so we only read from disk once per cold start
let assetsCache = null;

async function loadAssets() {
  if (assetsCache) return assetsCache;

  const fontsDir = join(process.cwd(), 'assets', 'fonts');
  const [cormorantRegular, cormorantLight, cormorantLightItalic, jost400, jost600, logoPng] = await Promise.all([
    readFile(join(fontsDir, 'CormorantGaramond-Regular.ttf')),
    readFile(join(fontsDir, 'CormorantGaramond-Light.ttf')),
    readFile(join(fontsDir, 'CormorantGaramond-LightItalic.ttf')),
    readFile(join(fontsDir, 'Jost-Regular.ttf')),
    readFile(join(fontsDir, 'Jost-SemiBold.ttf')),
    readFile(join(process.cwd(), 'assets', 'images', 'soiree-logo-transparent.png')),
  ]);

  assetsCache = {
    fonts: [
      { name: 'Cormorant Garamond', data: cormorantRegular, weight: 400, style: 'normal' },
      { name: 'Cormorant Garamond', data: cormorantLight, weight: 300, style: 'normal' },
      { name: 'Cormorant Garamond', data: cormorantLightItalic, weight: 300, style: 'italic' },
      { name: 'Jost', data: jost400, weight: 400, style: 'normal' },
      { name: 'Jost', data: jost600, weight: 600, style: 'normal' },
    ],
    logoDataUri: `data:image/png;base64,${logoPng.toString('base64')}`,
  };
  return assetsCache;
}

function formatShortDate(startDate) {
  if (!startDate) return '';
  const dt = startDate instanceof Date ? startDate : new Date(startDate);
  if (isNaN(dt.getTime())) return '';
  const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${dt.getMonth() + 1}/${dt.getDate()}`;
}

/**
 * Generate a social card image as a PNG buffer.
 * Replicates the client-side .social-post design from /social.
 * All dimensions are scaled 2.88x from the client CSS values.
 *
 * @param {string} categoryName - "Art & Culture", "Perks & Pop-Ups", or "Food & Drink"
 * @param {Array} events - Array of event objects from DB
 * @param {string} weekLabel - e.g. "Feb 27 – Mar 5, 2026"
 * @param {number} totalWeekEvents - Total events across all categories (for tagline)
 * @returns {Promise<Buffer>} PNG image buffer (1080x1350)
 */
async function generateSocialCard(categoryName, events, weekLabel, totalWeekEvents) {
  const { fonts, logoDataUri } = await loadAssets();
  const bgColor = CARD_COLORS[categoryName] || '#EDE8E0';
  const displayEvents = events.slice(0, 9);
  const count = displayEvents.length;

  // Font size scaling based on event count (matches client distributeSocialSpacing)
  const nameFontSize = count <= 4 ? Math.round(17 * S) : count <= 6 ? Math.round(15 * S) : count <= 8 ? Math.round(13 * S) : Math.round(12 * S);
  const rowPadding = count <= 4 ? 18 : count <= 6 ? 10 : count <= 8 ? 4 : 2;

  // Perks card uses slightly lighter border
  const borderColor = categoryName === 'Perks & Pop-Ups'
    ? 'rgba(28, 20, 16, 0.06)'
    : 'rgba(28, 20, 16, 0.08)';

  // Build event rows
  const eventRows = displayEvents.map((event, i) => {
    const shortDate = formatShortDate(event.start_date);
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          gap: Math.round(16 * S),
          padding: `${rowPadding}px 0`,
          borderBottom: i < count - 1 ? `1px solid ${borderColor}` : 'none',
        },
        children: [
          // Number
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'Cormorant Garamond',
                fontSize: Math.round(16 * S),
                fontWeight: 300,
                color: 'rgba(28, 20, 16, 0.3)',
                width: Math.round(22 * S),
                textAlign: 'right',
                flexShrink: 0,
              },
              children: String(i + 1).padStart(2, '0'),
            },
          },
          // Event name
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'Cormorant Garamond',
                fontSize: nameFontSize,
                fontWeight: 400,
                color: '#1C1410',
                flex: 1,
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
              children: event.name,
            },
          },
          // Date meta
          ...(shortDate ? [{
            type: 'div',
            props: {
              style: {
                fontFamily: 'Jost',
                fontSize: Math.round(12 * S),
                fontWeight: 300,
                color: 'rgba(28, 20, 16, 0.45)',
                flexShrink: 0,
                textAlign: 'right',
                whiteSpace: 'nowrap',
                letterSpacing: 0.5,
              },
              children: shortDate,
            },
          }] : []),
        ],
      },
    };
  });

  // No events fallback
  if (count === 0) {
    eventRows.push({
      type: 'div',
      props: {
        style: {
          textAlign: 'center',
          padding: `${Math.round(40 * S)}px ${Math.round(24 * S)}px`,
          color: 'rgba(28, 20, 16, 0.4)',
          fontFamily: 'Jost',
          fontSize: Math.round(15 * S),
          fontStyle: 'italic',
        },
        children: 'No events this week',
      },
    });
  }

  // Full card layout — matches client .social-post-inner
  const card = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
        padding: `${Math.round(20 * S)}px ${Math.round(28 * S)}px ${Math.round(24 * S)}px`,
      },
      children: [
        // === TOP: Logo + Category + Week ===
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              paddingBottom: Math.round(4 * S),
            },
            children: [
              // Logo image (matches .social-logo: 120px CSS width)
              {
                type: 'img',
                props: {
                  src: logoDataUri,
                  width: Math.round(120 * S),
                  style: {
                    marginBottom: Math.round(8 * S),
                  },
                },
              },
              // Category with rules
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Math.round(16 * S),
                    width: '100%',
                    marginBottom: Math.round(4 * S),
                  },
                  children: [
                    // Left rule
                    {
                      type: 'div',
                      props: {
                        style: {
                          flex: 1,
                          maxWidth: Math.round(60 * S),
                          height: 1,
                          backgroundColor: 'rgba(28, 20, 16, 0.25)',
                        },
                      },
                    },
                    // Category text
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontFamily: 'Jost',
                          fontSize: Math.round(11 * S),
                          fontWeight: 400,
                          color: '#1C1410',
                          letterSpacing: Math.round(4 * S),
                          textTransform: 'uppercase',
                        },
                        children: categoryName,
                      },
                    },
                    // Right rule
                    {
                      type: 'div',
                      props: {
                        style: {
                          flex: 1,
                          maxWidth: Math.round(60 * S),
                          height: 1,
                          backgroundColor: 'rgba(28, 20, 16, 0.25)',
                        },
                      },
                    },
                  ],
                },
              },
              // Week label
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Jost',
                    fontSize: Math.round(9 * S),
                    fontWeight: 400,
                    color: 'rgba(28, 20, 16, 0.5)',
                    letterSpacing: Math.round(2.5 * S),
                    textTransform: 'uppercase',
                  },
                  children: weekLabel,
                },
              },
            ],
          },
        },
        // === Vertical rule (hidden when 9 events to save space) ===
        ...(count < 9 ? [{
          type: 'div',
          props: {
            style: {
              width: 1,
              height: Math.round(20 * S),
              backgroundColor: 'rgba(28, 20, 16, 0.2)',
              alignSelf: 'center',
              margin: `${Math.round(4 * S)}px 0`,
              flexShrink: 0,
            },
          },
        }] : []),
        // === EVENTS LIST ===
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              padding: '0',
              overflow: 'hidden',
            },
            children: eventRows,
          },
        },
        // === BOTTOM: Tagline + URL ===
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              paddingTop: Math.round(12 * S),
            },
            children: [
              // Tagline
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Cormorant Garamond',
                    fontSize: Math.round(14 * S),
                    fontWeight: 300,
                    fontStyle: 'italic',
                    color: 'rgba(28, 20, 16, 0.5)',
                    marginBottom: Math.round(4 * S),
                  },
                  children: `Visit for all ${totalWeekEvents} curated events this week`,
                },
              },
              // URL
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Jost',
                    fontSize: Math.round(11 * S),
                    fontWeight: 600,
                    color: '#1C1410',
                    letterSpacing: Math.round(3 * S),
                    textTransform: 'uppercase',
                  },
                  children: 'soiree.today',
                },
              },
            ],
          },
        },
      ],
    },
  };

  // Render with satori → SVG → PNG (dynamic import — satori is ESM-only)
  const { default: satori } = await import('satori');
  const svg = await satori(card, {
    width: 1080,
    height: 1350,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1080 },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

module.exports = { generateSocialCard };
