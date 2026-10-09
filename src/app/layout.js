import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { themeInitScript } from '@/lib/theme';
import VersionUpdater from '@/components/VersionUpdater';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Inter, Cormorant_Garamond, Pinyon_Script } from 'next/font/google';
import { headers } from 'next/headers';

// Font Setup
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic']
});
// Codex drop caps only
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-pinyon' });

// Determine Base URL for SEO
const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

// SEO METADATA
export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Realm of Allania | Immersive RPG Forum',
    template: '%s | Realm of Allania'
  },
  description: 'Join the Chronicles. A text-based roleplaying realm featuring a dynamic world map, character creation, and collaborative storytelling.',
  keywords: ['RPG', 'Text-based Game', 'Fantasy Forum', 'Roleplay', 'Dungeons', 'Dragons', 'Writing Community'],
  authors: [{ name: 'Realm Admin' }],
  creator: 'Realm of Allania',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Realm of Allania',
    description: 'Create your hero, explore the map, and write your legend in this immersive RPG forum.',
    siteName: 'Realm of Allania',
    images: [
      {
        url: '/og-image.jpg', // 1200x630 crop of the world map
        width: 1200,
        height: 630,
        alt: 'Map of Allania',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Realm of Allania',
    description: 'Join the immersive text-based RPG forum.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({ children }) {
  // This request's CSP nonce (set by src/proxy.js): inline scripts without it
  // don't run. Reading headers renders every page per request, which nonces need.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${pinyon.variable}`} data-theme="dark" data-accent="gold" suppressHydrationWarning>
      <head>
        {/* Apply the saved/system theme before first paint (no dark flash in light mode) */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#b45309" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className="bg-ink-950 text-ink-200 antialiased h-full overflow-hidden">
        <ErrorBoundary>
          <ThemeProvider>
            <GameProvider>
              {children}
              <VersionUpdater />
            </GameProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
