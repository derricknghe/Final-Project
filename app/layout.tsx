import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripbudgeter — Conversational Travel Budget",
  description:
    "Chat about your trip and watch your travel budget tally itself in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
