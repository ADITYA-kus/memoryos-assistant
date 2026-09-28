import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar Assistant",
  description: "A customer assistant with context that carries across sessions.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider><html lang="en"><body>{children}</body></html></ClerkProvider>;
}
