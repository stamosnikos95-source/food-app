import type { Metadata } from "next";
import { Shell } from "../components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Food App — Διαχείριση",
  description: "Παραγγελίες, μενού και αναφορές του καταστήματος",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
