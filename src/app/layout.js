import "./globals.css";

export const metadata = {
  title: "Realm of Allania",
  description: "A fantasy play-by-post roleplaying community.",
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