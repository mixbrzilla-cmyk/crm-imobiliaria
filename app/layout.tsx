import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Imobiliária Moderna",
  description: "CRM Imobiliária Moderna",
  icons: {
    icon: "https://imobmoderna.com.br/wp-content/uploads/2026/03/Sem-Titulo-2-1024x1024-1.png",
    apple: "https://imobmoderna.com.br/wp-content/uploads/2026/03/Sem-Titulo-2-1024x1024-1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
