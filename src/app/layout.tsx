import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FournisseurRequetes } from "@/shared/ui/fournisseur-requetes";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Registre des personnes vulnérables", template: "%s · Registre" },
  description: "Suivi des personnes vulnérables et pilotage des alertes pour les CCAS.",
};

export const viewport: Viewport = { themeColor: "#f7f6f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <FournisseurRequetes>
          <TooltipProvider>{children}</TooltipProvider>
        </FournisseurRequetes>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
