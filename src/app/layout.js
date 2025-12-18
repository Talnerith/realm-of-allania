import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { GameProvider } from "@/context/GameContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cormorant = Cormorant_Garamond({ 
  subsets: ["latin"], 
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant"
});

export const metadata = {
  title: "Realm of Allania",
  description: "A text-based RPG forum and codex.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cormorant.variable} bg-black text-slate-200`}>
        <GameProvider>
           {children}
        </GameProvider>
      </body>
    </html>
  );
}