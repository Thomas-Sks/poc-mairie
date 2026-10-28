import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bandeau, EnTetePage, Page, Pastille, Surface } from "@/shared/ui/elements";
import { LienRetour } from "./lien-retour";

const classeSelect = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base disabled:opacity-60";

/** Maquette E11-US2 (mise de côté) : réglages IA d'une campagne, non fonctionnels. */
export function PageReglagesIa({ campagneId }: { campagneId: string }) {
  return (
    <Page className="max-w-3xl">
      <EnTetePage
        retour={<LienRetour href={`/campagnes/${campagneId}`}>Tableau de bord de la campagne</LienRetour>}
        titre={
          <span className="flex flex-wrap items-center gap-3">
            Réglages des appels IA <Pastille ton="accent">Bientôt disponible</Pastille>
          </span>
        }
        description="Paramétrage de l'agent vocal pour cette campagne. Les personnes sans consentement explicite ne sont jamais appelées par l'IA."
      />
      <Bandeau ton="accent" className="flex items-center gap-2">
        <Bot className="size-5 shrink-0" aria-hidden />
        Démonstration : cet écran n&apos;est pas encore actif. Les réglages ne sont pas enregistrés.
      </Bandeau>
      <Surface className="p-5 sm:p-6">
        <fieldset disabled className="flex flex-col gap-6">
          <legend className="sr-only">Réglages IA (inactifs)</legend>
          <div className="flex flex-col gap-2">
            <span className="font-medium">Plages horaires d&apos;appel</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input aria-label="Plage du matin" defaultValue="09:00 – 12:00" />
              <Input aria-label="Plage de l'après-midi" defaultValue="15:00 – 19:00" />
            </div>
          </div>
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-medium">Nombre maximal de tentatives</span>
              <Input defaultValue="3" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-medium">Délai entre tentatives</span>
              <Input defaultValue="30 min, puis 2 h" />
            </label>
          </div>
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-medium">Appel du cercle si non-réponse</span>
              <select className={classeSelect} defaultValue="2">
                <option value="0">Non</option>
                <option value="1">Oui, jusqu&apos;au rang 1</option>
                <option value="2">Oui, jusqu&apos;au rang 2</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-medium">Voix et langue</span>
              <select className={classeSelect} defaultValue="claire">
                <option value="claire">Voix féminine posée · Français</option>
                <option value="grave">Voix masculine posée · Français</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-2 border-t pt-5">
            <span className="font-medium">Escalade vers un humain</span>
            <p className="text-muted-foreground">
              Malaise, chute, détresse, confusion, demande d&apos;un humain, conversation incomplète ou tout doute : l&apos;appel passe en « à rappeler par un
              humain » en tête du tableau de bord, avec une notification.
            </p>
          </div>
          <div className="border-t pt-5">
            <Button size="lg">Enregistrer les réglages</Button>
          </div>
        </fieldset>
      </Surface>
    </Page>
  );
}
