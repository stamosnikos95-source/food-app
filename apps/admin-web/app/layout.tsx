import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Food App — Admin",
  description: "Διαχείριση μενού, παραγγελιών και λειτουργίας",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
