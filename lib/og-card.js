// OG/Twitter card renderer — 1200x630 PNG on the Concierge Ledger register.
// satori (JSX-object -> SVG) + resvg (SVG -> PNG), same machinery as
// lib/social-image.js. Fonts are read from /assets/fonts once per cold start.
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const { readFile } = require('fs/promises');
const { join } = require('path');

// Ledger palette (BUILD_BRIEF §5)
const C = {
  paper: '#171009',
  panel: '#221708',
  ink: '#f2e8d5',
  inkSoft: '#cbbb9e',
  muted: '#8d7c63',
  gold: '#c9a96a',
  goldHi: '#e6c98d',
  hairline: 'rgba(201,169,106,0.16)',
  hairlineSoft: 'rgba(201,169,106,0.09)',
};

let fontsCache = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;
  const dir = join(process.cwd(), 'assets', 'fonts');
  const [cormorant, cormorantLight, cormorantLightItalic, jost400, jost600] = await Promise.all([
    readFile(join(dir, 'CormorantGaramond-Regular.ttf')),
    readFile(join(dir, 'CormorantGaramond-Light.ttf')),
    readFile(join(dir, 'CormorantGaramond-LightItalic.ttf')),
    readFile(join(dir, 'Jost-Regular.ttf')),
    readFile(join(dir, 'Jost-SemiBold.ttf')),
  ]);
  fontsCache = [
    { name: 'Cormorant Garamond', data: cormorant, weight: 400, style: 'normal' },
    { name: 'Cormorant Garamond', data: cormorantLight, weight: 300, style: 'normal' },
    { name: 'Cormorant Garamond', data: cormorantLightItalic, weight: 300, style: 'italic' },
    { name: 'Jost', data: jost400, weight: 400, style: 'normal' },
    { name: 'Jost', data: jost600, weight: 600, style: 'normal' },
  ];
  return fontsCache;
}

function div(style, children) {
  return { type: 'div', props: { style: Object.assign({ display: 'flex' }, style), children } };
}

/**
 * Render the brand card.
 * @param {object} opts
 * @param {string} opts.title    - big serif line (event name, or brand line)
 * @param {string} [opts.meta]   - gold small-caps line (date · time)
 * @param {string} [opts.sub]    - soft ink line (venue · neighborhood)
 * @param {boolean} [opts.italicTitle] - editorial voice for the default card
 * @returns {Promise<Buffer>} PNG buffer, 1200x630
 */
async function renderOgCard(opts) {
  const fonts = await loadFonts();
  const title = String(opts.title || 'Soirée').slice(0, 140);
  const meta = opts.meta ? String(opts.meta).toUpperCase().slice(0, 80) : null;
  const sub = opts.sub ? String(opts.sub).slice(0, 90) : null;

  const titleSize = title.length <= 34 ? 76 : title.length <= 64 ? 60 : title.length <= 96 ? 48 : 40;

  const rule = (w) => div({ width: w, height: 1, backgroundColor: C.gold, opacity: 0.55 }, []);

  const card = div(
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: C.paper,
      padding: '26px',
    },
    [
      // Hairline frame
      div(
        {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          border: `1px solid ${C.hairline}`,
          padding: '44px 72px 38px',
        },
        [
          // Masthead
          div({ flexDirection: 'column', alignItems: 'center' }, [
            div(
              {
                fontFamily: 'Cormorant Garamond',
                fontWeight: 400,
                fontSize: 46,
                color: C.goldHi,
                letterSpacing: 1,
              },
              'soirée'
            ),
            div({ marginTop: 12 }, [rule(56)]),
            div(
              {
                marginTop: 14,
                fontFamily: 'Jost',
                fontWeight: 400,
                fontSize: 15,
                letterSpacing: 6,
                color: C.muted,
              },
              'THE CONCIERGE LEDGER · NEW YORK'
            ),
          ]),

          // Body
          div({ flexDirection: 'column', alignItems: 'center', maxWidth: 980 }, [
            div(
              {
                fontFamily: 'Cormorant Garamond',
                fontWeight: opts.italicTitle ? 300 : 400,
                fontStyle: opts.italicTitle ? 'italic' : 'normal',
                fontSize: titleSize,
                lineHeight: 1.12,
                color: C.ink,
                textAlign: 'center',
              },
              title
            ),
            ...(meta
              ? [
                  div(
                    {
                      marginTop: 26,
                      fontFamily: 'Jost',
                      fontWeight: 600,
                      fontSize: 21,
                      letterSpacing: 5,
                      color: C.gold,
                      textAlign: 'center',
                    },
                    meta
                  ),
                ]
              : []),
            ...(sub
              ? [
                  div(
                    {
                      marginTop: 12,
                      fontFamily: 'Jost',
                      fontWeight: 400,
                      fontSize: 19,
                      letterSpacing: 2,
                      color: C.inkSoft,
                      textAlign: 'center',
                    },
                    sub
                  ),
                ]
              : []),
          ]),

          // Colophon
          div({ flexDirection: 'column', alignItems: 'center' }, [
            div({ marginBottom: 14 }, [rule(36)]),
            div(
              {
                fontFamily: 'Jost',
                fontWeight: 400,
                fontSize: 14,
                letterSpacing: 4,
                color: C.muted,
              },
              'SOIREE.TODAY — WE PRINT WHAT WE CAN VERIFY'
            ),
          ]),
        ]
      ),
    ]
  );

  const { default: satori } = await import('satori');
  const svg = await satori(card, { width: 1200, height: 630, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return Buffer.from(resvg.render().asPng());
}

module.exports = { renderOgCard };
