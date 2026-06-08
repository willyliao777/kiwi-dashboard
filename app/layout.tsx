import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIWI Dashboard",
  description: "Real-time prompt injection threat monitoring for AI agent pipelines",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#111009", color: "#f5f0e8", margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
