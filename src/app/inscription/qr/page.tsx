import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { communePublique } from "@/modules/inscriptions/infrastructure";
import { BoutonImprimer } from "@/modules/inscriptions/ui/bouton-imprimer";

export const metadata: Metadata = { title: "Affiche à imprimer : QR code d'inscription" };

/** E7-US1 — Affichette imprimable (flyers, courriers) avec un QR code généré localement en SVG. */
export default async function PageQrCode() {
  const commune = await communePublique();
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocole = h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const url = `${protocole}://${hote}/inscription`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#23272e", light: "#ffffff" } });

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-lg font-semibold text-primary">{commune.structureNom}</p>
        <h1 className="text-[2rem] font-bold leading-tight">Inscrivez-vous au registre des personnes vulnérables</h1>
        <p className="mx-auto max-w-[40ch] text-lg text-muted-foreground">
          En cas de canicule, de grand froid ou d&apos;inondation, la Ville de {commune.nom} prend des nouvelles des personnes inscrites. L&apos;inscription est
          gratuite et volontaire.
        </p>
      </div>
      <figure className="flex flex-col items-center gap-3">
        <div
          role="img"
          aria-label={`QR code menant au formulaire d'inscription : ${url}`}
          className="size-64 rounded-lg border bg-card p-3 [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <figcaption className="text-lg">
          Scannez ce code avec l&apos;appareil photo de votre téléphone,
          <br />
          ou rendez-vous sur <strong className="break-all">{url}</strong>
        </figcaption>
      </figure>
      <p className="text-lg">
        Vous préférez être aidé(e) ? Appelez le <strong>{commune.structureTelephone}</strong>.
      </p>
      <BoutonImprimer libelle="Imprimer l'affichette" />
    </div>
  );
}
