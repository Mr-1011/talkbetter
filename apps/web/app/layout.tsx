import type { Metadata } from "next";
import { Archivo, Fraunces, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const poster = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });
const label = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  // The one public address. Link previews and the canonical URL use it, also on the vercel.app address.
  metadataBase: new URL("https://www.talkbetter.app"),
  alternates: { canonical: "/" },
  title: "Talk Better - practice hard conversations by voice",
  description: "Pick a scene, talk to an AI character, get a verdict and a debrief on your words, voice and face.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${poster.variable} ${label.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
