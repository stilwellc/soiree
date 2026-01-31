import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler() {
  return new ImageResponse(
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
          // Subtle gold border frame
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
          // Small decorative line above
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
          // Diamond accent
          {
            type: 'div',
            props: {
              style: {
                fontSize: '14px',
                color: '#D4AF37',
                marginBottom: '20px',
                letterSpacing: '8px',
              },
              children: '◆',
            },
          },
          // Main title
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
              children: 'Soirée',
            },
          },
          // Divider
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
          // Tagline
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
          // Subtitle
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
              children: 'Art · Music · Culture · Free',
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
}
