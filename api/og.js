module.exports = async function handler(req, res) {
  const { ImageResponse } = await import('@vercel/og');

  const image = new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0A',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '32px',
                left: '32px',
                right: '32px',
                bottom: '32px',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '4px',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                width: '60px',
                height: '1px',
                background: '#D4AF37',
                marginBottom: '32px',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '14px',
                color: '#D4AF37',
                marginBottom: '20px',
                letterSpacing: '8px',
              },
              children: '\u25C6',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '96px',
                fontWeight: 300,
                color: '#FAF8F3',
                letterSpacing: '-1px',
                lineHeight: 1,
                marginBottom: '16px',
                fontFamily: 'serif',
              },
              children: 'Soir\u00E9e',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                width: '40px',
                height: '1px',
                background: 'rgba(212, 175, 55, 0.5)',
                marginTop: '12px',
                marginBottom: '24px',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '22px',
                fontWeight: 300,
                color: '#8B7355',
                letterSpacing: '6px',
                textTransform: 'uppercase',
              },
              children: 'Curated Events in NYC',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '16px',
                fontWeight: 300,
                color: 'rgba(212, 175, 55, 0.6)',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginTop: '16px',
              },
              children: 'Art \u00B7 Music \u00B7 Culture \u00B7 Free',
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
    }
  );

  const buffer = Buffer.from(await image.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.send(buffer);
};
