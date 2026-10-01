import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashtiny — AI-Powered Smart Getaways Platform",
  description: "Plan getaways, compare luxury stays & flights, and build AI-curated weekend escapes tailored to you.",
};

import { GoogleAuthModal } from "@/components/auth/GoogleAuthModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jakarta.variable}`}>
      <body className="font-sans bg-[#F8FAFC] text-slate-900 antialiased selection:bg-orange-500 selection:text-white">
        {children}
        <GoogleAuthModal />
      </body>
    </html>
  );
}
