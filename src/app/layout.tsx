import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "VMD Championship — Vehicle Workshop",
  description:
    "The Platypus 3D Engineer. Build a custom machine, battle rival animal engineers, and climb the 100-round VMD Championship.",
  icons: { icon: "/vmd.svg" },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
