import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "QuantumFX AI | Intelligent Trading", description: "Private autonomous paper-trading research terminal." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="min-h-screen antialiased">{children}</body></html>;
}
