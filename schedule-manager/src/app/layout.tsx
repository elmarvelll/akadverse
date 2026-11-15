import type { Metadata } from "next";
import "./globals.css";
import "./figma-fonts.css";
import "./figma.css";
export const metadata: Metadata = {
  title: "Productivity Layer",
  description: "Your schedule and to-do list in one workspace.",
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
