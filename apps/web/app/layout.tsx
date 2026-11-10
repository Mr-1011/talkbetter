import type { Metadata } from "next";
import { Archivo, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const label = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Prova - practice hard conversations by voice",
  description: "Pick a scene, talk to an AI character, get a verdict and a debrief on your words, voice and face.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${label.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
