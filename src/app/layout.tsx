import type { Metadata } from "next";
import { Open_Sans, Playwrite_DE_Grund } from "next/font/google";
import "./globals.css";
import { SanctuaryShell } from "@/components/shell";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playwrite = Playwrite_DE_Grund({
  variable: "--font-playwrite",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voice Debrief",
  description: "Talk out your day; get a structured, editable write-up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${playwrite.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SanctuaryShell>{children}</SanctuaryShell>
      </body>
    </html>
  );
}
