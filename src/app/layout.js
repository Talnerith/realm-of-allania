import "./globals.css";

export const metadata = {
  title: "Realm of Allania",
  description: "A fantasy play-by-post roleplaying community.",
  icons: {
    icon: [
      // This tells the browser to use an SVG containing the Crown emoji as the favicon
      { url: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👑</text></svg>', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}