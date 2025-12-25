import './globals.css';
import { GameProvider } from '@/context/GameContext';
import VersionUpdater from '@/components/VersionUpdater';
import { Inter, Cormorant_Garamond } from 'next/font/google';

// Font Setup
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic']
});

// SEO METADATA
export const metadata = {
  metadataBase: new URL('https://realm-of-allania.com'), // Replace with your actual Vercel domain
  title: {
    default: 'Realm of Allania | Immersive RPG Forum',
    template: '%s | Realm of Allania'
  },
  description: 'Join the Chronicles. A text-based roleplaying realm featuring a dynamic world map, character creation, and collaborative storytelling.',
  keywords: ['RPG', 'Text-based Game', 'Fantasy Forum', 'Roleplay', 'Dungeons', 'Dragons', 'Writing Community'],
  authors: [{ name: 'Realm Admin' }],
  creator: 'Realm of Allania',
  openGraph: {
    title: 'Realm of Allania',
    description: 'Create your hero, explore the map, and write your legend in this immersive RPG forum.',
    url: 'https://realm-of-allania.com',
    siteName: 'Realm of Allania',
    images: [
      {
        url: '/map.jpg', // Ensure you have a good default social share image in public folder
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
    images: ['/map.jpg'],
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        {/* Preload critical assets if needed */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-slate-950 text-slate-200 antialiased overflow-hidden">
        <GameProvider>
          {children}
          <VersionUpdater />
        </GameProvider>
      </body>
    </html>
  );
}