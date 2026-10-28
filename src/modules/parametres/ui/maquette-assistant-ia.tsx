import { Switch } from "@/components/ui/switch";
import { Surface } from "@/shared/ui/elements";
import { SousTitre } from "./champs";

/**
 * E11-US1 / E11-US2 — MAQUETTE non fonctionnelle (§10.2 : appels IA mis de côté).
 * Les valeurs sont figées ; aucun contrôle n'est actif.
 */
const REGLES: { libelle: string; aide?: string; actif: boolean; verrouille?: boolean }[] = [
  { libelle: "Consentement à l'appel par l'assistant obligatoire", aide: "Une personne sans consentement explicite n'est jamais appelée.", actif: true, verrouille: true },
  { libelle: "Priorités 2 et 3 uniquement", aide: "Les personnes en priorité 1 sont appelées par un agent.", actif: true },
  { libelle: "Exclure les personnes avec des troubles cognitifs", actif: true },
  { libelle: "Exclure les personnes avec des troubles auditifs", actif: true },
];

const REGLAGES: { libelle: string; valeur: string }[] = [
  { libelle: "Plages horaires d'appel", valeur: "9 h – 12 h et 15 h – 19 h" },
  { libelle: "Tentatives par personne", valeur: "3, espacées de 30 minutes puis 2 heures" },
  { libelle: "Appel du cercle si pas de réponse", valeur: "Oui, jusqu'au rang 2" },
  { libelle: "Script", valeur: "Le même que celui des appelants humains" },
  { libelle: "Voix", valeur: "Voix féminine, débit lent" },
  { libelle: "Langue", valeur: "Français" },
];

export function MaquetteAssistantIa() {
  return (
    <Surface aria-label="Maquette des réglages de l'assistant IA">
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        <SousTitre>Qui peut être appelé par l&apos;assistant</SousTitre>
        <ul className="flex flex-col gap-3">
          {REGLES.map((r) => (
            <li key={r.libelle} className="flex min-h-11 items-center justify-between gap-4">
              <span className="flex flex-col">
                <span>{r.libelle}</span>
                {r.aide && <span className="text-sm text-muted-foreground">{r.aide}</span>}
              </span>
              <Switch checked={r.actif} disabled aria-label={r.libelle} />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4 border-t px-5 py-5 sm:px-6">
        <SousTitre>Déroulement des appels</SousTitre>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(14rem,auto)_1fr]">
          {REGLAGES.map((r) => (
            <div key={r.libelle} className="contents">
              <dt className="text-muted-foreground">{r.libelle}</dt>
              <dd className="max-sm:-mt-2.5">{r.valeur}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Surface>
  );
}
