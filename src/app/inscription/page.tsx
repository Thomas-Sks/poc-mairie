import { communePublique } from "@/modules/inscriptions/infrastructure";
import { ChargeurFormulaire } from "@/modules/inscriptions/ui/formulaire/chargeur";

export default async function PageInscription() {
  const c = await communePublique();
  return (
    <ChargeurFormulaire
      commune={{ nom: c.nom, codePostal: c.codePostal, structureNom: c.structureNom, structureTelephone: c.structureTelephone, rgpd: c.rgpd }}
    />
  );
}
