/**
 * Onglet « Infos » : identité, logement, situation, santé (si habilité), habitudes,
 * foyer (lien vers l'autre membre), consentements, score expliqué, maquette « assistant IA » (E11).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Bot, ChevronRight, Lock, Users } from "lucide-react";
import { formaterDate, formaterDateHeure, prochainAnniversaire, aujourdhui } from "@/shared/domain/dates";
import {
  CAISSE_RETRAITE_LIBELLES,
  CATEGORIE_LIBELLES,
  DEPLACEMENT_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  ORIGINE_INSCRIPTION_LIBELLES,
  PREFERENCE_CONTACT_LIBELLES,
  PROTECTION_LIBELLES,
  SEXE_LIBELLES,
  STATUT_CIBLE_LIBELLES,
  TYPE_LOGEMENT_LIBELLES,
} from "@/shared/domain/vocabulaire";
import { Pastille, Proprietes, Section, Surface } from "@/shared/ui/elements";
import { nomComplet } from "../domain/fiche";
import { casDUsage } from "../infrastructure";
import { chargerFiche } from "./cadre-fiche";
import { InterrupteurIa } from "./interrupteur-ia";
import { tonResultat } from "./libelles";

const ouiNon = (v: boolean | null) => (v === null ? null : v ? "Oui" : "Non");
const tel = (numero: string | null) =>
  numero ? (
    <a href={`tel:${numero.replace(/\s/g, "")}`} className="tabular font-medium text-primary hover:underline">
      {numero}
    </a>
  ) : null;

/** N'affiche que les informations renseignées (écran plus court et plus lisible). */
function Renseignees({ items, className }: { items: { libelle: string; valeur: ReactNode }[]; className?: string }) {
  const remplis = items.filter((i) => i.valeur !== null && i.valeur !== undefined && i.valeur !== "" && i.valeur !== false);
  return remplis.length ? <Proprietes items={remplis} className={className} /> : <p className="text-muted-foreground">Rien de renseigné.</p>;
}

/** Rubrique d'une colonne : les rubriques partagent une seule surface, séparées par un filet (pas de cartes empilées). */
function Bloc({ titre, actions, children }: { titre: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="p-5 sm:p-6">
      <Section titre={titre} actions={actions}>
        {children}
      </Section>
    </div>
  );
}

export async function OngletInfos({ id }: { id: string }) {
  const { ctx, fiche, synthese, criteres, droits } = await chargerFiche(id);
  const { interactions, notes } = await casDUsage.consulterJournal(ctx, { beneficiaireId: id });
  const appelsIa = interactions.filter((i) => i.type === "appel_ia");
  const b = fiche.beneficiaire;
  const f = fiche.foyer;
  const s = fiche.sante;
  const anniversaire = prochainAnniversaire(b.dateNaissance, aujourdhui(ctx.maintenant));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Surface className="flex flex-col divide-y">
        <Bloc titre="Identité et coordonnées">
          <Renseignees
            items={[
              { libelle: "Date de naissance", valeur: `${formaterDate(b.dateNaissance)} (${synthese.age} ans)` },
              { libelle: "Nom de naissance", valeur: b.nomNaissance },
              { libelle: "Sexe", valeur: SEXE_LIBELLES[b.sexe] },
              { libelle: "Téléphone fixe", valeur: b.pasDeTelephone ? <span className="font-medium text-warn">Pas de téléphone : visite nécessaire</span> : tel(b.telephoneFixe) },
              { libelle: "Téléphone mobile", valeur: b.pasDeTelephone ? "—" : tel(b.telephoneMobile) },
              { libelle: "Email", valeur: b.email },
              { libelle: "Langue parlée", valeur: b.langue },
              { libelle: "Préférence de contact", valeur: b.preferenceContact && PREFERENCE_CONTACT_LIBELLES[b.preferenceContact] },
              { libelle: "Créneaux d'appel", valeur: b.creneauxAppel },
            ]}
          />
        </Bloc>

        <Bloc titre="Logement">
          <Renseignees
            items={[
              {
                libelle: "Complément",
                valeur:
                  [f.residence && `Résidence ${f.residence}`, f.batiment && `bât. ${f.batiment}`, f.entree && `entrée ${f.entree}`, f.appartement && `appt ${f.appartement}`]
                    .filter(Boolean)
                    .join(", ") || null,
              },
              {
                libelle: "Étage",
                valeur: f.etage === null ? null : `${f.etage === 0 ? "Rez-de-chaussée" : `${f.etage}e étage`}${f.ascenseur === null ? "" : f.ascenseur ? ", avec ascenseur" : ", sans ascenseur"}`,
              },
              { libelle: "Code d'accès", valeur: f.codeAcces },
              { libelle: "Type de logement", valeur: f.typeLogement && TYPE_LOGEMENT_LIBELLES[f.typeLogement] },
              { libelle: "Sous les toits", valeur: ouiNon(f.sousLesToits) },
              { libelle: "Pièce fraîche", valeur: ouiNon(f.pieceFraiche) },
              { libelle: "Animaux", valeur: f.animaux },
              { libelle: "Quartier", valeur: f.quartier },
            ]}
          />
        </Bloc>

        <Bloc titre="Situation">
          <Renseignees
            items={[
              { libelle: "Mode de vie", valeur: b.modeDeVie && MODE_DE_VIE_LIBELLES[b.modeDeVie] },
              { libelle: "Catégorie", valeur: CATEGORIE_LIBELLES[b.categorie] },
              {
                libelle: "Mesure de protection",
                valeur:
                  b.protection === "non" ? (
                    PROTECTION_LIBELLES.non
                  ) : (
                    <span>
                      {PROTECTION_LIBELLES[b.protection]} · {b.mandataireStructure} {tel(b.mandataireTelephone)}
                    </span>
                  ),
              },
            ]}
          />
        </Bloc>

        <Bloc titre="Aides et droits">
          <Renseignees
            items={[
              { libelle: "Caisse de retraite", valeur: b.caisseRetraite && CAISSE_RETRAITE_LIBELLES[b.caisseRetraite] },
              { libelle: "Aide de la caisse de retraite", valeur: b.aideCaisseRetraite ? "Oui" : "Non" },
              { libelle: "Origine de l'inscription", valeur: ORIGINE_INSCRIPTION_LIBELLES[b.origineInscription] },
            ]}
          />
        </Bloc>

        {s ? (
          <Bloc titre="Autonomie et santé">
            <Renseignees
              items={[
                { libelle: "Déplacement dans le domicile", valeur: s.deplacement && DEPLACEMENT_LIBELLES[s.deplacement] },
                { libelle: "GIR", valeur: s.gir ? `GIR ${s.gir}` : null },
                {
                  libelle: "Troubles",
                  valeur:
                    [s.troublesAuditifs && "auditifs", s.troublesVisuels && "visuels", s.troublesCognitifs && "cognitifs"].filter(Boolean).join(", ") || "Aucun signalé",
                },
                { libelle: "Handicap", valeur: s.handicap },
                { libelle: "Appareillage", valeur: s.appareillage.length ? s.appareillage.join(", ") : null },
                { libelle: "Téléassistance", valeur: s.teleassistance ? `Oui${s.teleassistanceFournisseur ? ` · ${s.teleassistanceFournisseur}` : ""}` : "Non" },
                { libelle: "Médecin traitant", valeur: s.medecinTraitant },
              ]}
            />
          </Bloc>
        ) : (
          <Bloc titre="Autonomie et santé">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              Données de santé réservées aux personnes habilitées.
            </p>
          </Bloc>
        )}

        <Bloc titre="Habitudes">
          <Renseignees
            items={[
              { libelle: "Au quotidien", valeur: b.habitudes },
              { libelle: "Centres d'intérêt", valeur: b.centresInteret },
              {
                libelle: "Étiquettes",
                valeur: b.tags.length ? (
                  <span className="flex flex-wrap gap-2">
                    {b.tags.map((t) => (
                      <Pastille key={t} ton="accent">
                        {t}
                      </Pastille>
                    ))}
                  </span>
                ) : null,
              },
            ]}
          />
        </Bloc>

        {notes.length > 0 && (
          <Bloc titre={`Notes (${notes.length})`}>
            <ul className="flex flex-col divide-y">
              {notes.map((n) => (
                <li key={n.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="whitespace-pre-line">{n.texte}</p>
                  <p className="text-sm text-muted-foreground">
                    {n.source === "import" ? "Importée" : "Ajoutée"} le {formaterDateHeure(n.at)}
                    {n.auteur && ` par ${n.auteur}`}
                  </p>
                </li>
              ))}
            </ul>
          </Bloc>
        )}
      </Surface>

      <Surface className="flex flex-col divide-y">
        <Bloc titre="Foyer">
          {fiche.autresMembresFoyer.length ? (
            <ul className="flex flex-col gap-1">
              {fiche.autresMembresFoyer.map((m) => (
                <li key={m.id}>
                  <Link href={`/beneficiaires/${m.id}`} className="flex min-h-11 items-center gap-2 font-medium text-primary hover:underline">
                    <Users className="size-4" aria-hidden />
                    {nomComplet(m)}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                  <p className="text-sm text-muted-foreground">Partage l&apos;adresse, les intervenants et les contacts.</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Seule personne inscrite à cette adresse.</p>
          )}
        </Bloc>

        <Bloc titre="Pourquoi cette priorité">
          {fiche.niveauForce && <p className="text-sm text-muted-foreground">Niveau calculé : {fiche.niveauPriorite}</p>}
          {fiche.niveauForce && fiche.niveauForceJustification && <p className="text-sm">Forcé : « {fiche.niveauForceJustification} »</p>}
          {criteres.length ? (
            <ul className="divide-y">
              {criteres.map((c) => (
                <li key={c.critere} className="flex justify-between gap-3 py-2 text-[0.9375rem]">
                  <span>{c.critere}</span>
                  <span className="tabular font-semibold">+{c.points}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Aucun critère de fragilité retenu.</p>
          )}
        </Bloc>

        <Bloc titre="Dates clés">
          <Renseignees
            className="sm:grid-cols-1"
            items={[
              { libelle: "Prochain anniversaire", valeur: `${formaterDate(anniversaire.date)} (${anniversaire.age} ans)` },
              { libelle: "Inscription", valeur: formaterDate(fiche.dateInscription) },
            ]}
          />
        </Bloc>

        <Bloc titre="Consentements">
          <ul className="flex flex-col gap-1.5 text-[0.9375rem]">
            {[
              { l: "Inscription au registre", v: b.consentementRegistre },
              { l: "Personne informée", v: b.personneInformee },
              { l: "Partage avec les intervenants", v: b.consentementPartage },
              { l: "Appel par l'assistant IA", v: b.consentementIa },
            ].map((c) => (
              <li key={c.l} className="flex justify-between gap-3">
                <span>{c.l}</span>
                <span className={c.v ? "font-semibold text-ok" : "text-muted-foreground"}>{c.v ? "Oui" : "Non"}</span>
              </li>
            ))}
          </ul>
          {(b.consentementDate || b.consentementCanal) && (
            <p className="text-sm text-muted-foreground">
              Recueilli{b.consentementDate && ` le ${formaterDate(b.consentementDate)}`}
              {b.consentementCanal && ` · ${b.consentementCanal}`}
            </p>
          )}
        </Bloc>

        <Bloc
          titre={
            <span className="flex items-center gap-2">
              <Bot className="size-5 text-primary" aria-hidden />
              Appels par l&apos;assistant IA
            </span>
          }
        >
          <p className="text-sm text-muted-foreground">Fonctionnalité à venir : écran de démonstration.</p>
          <InterrupteurIa beneficiaireId={id} active={fiche.iaActivee} consentement={b.consentementIa} modifiable={droits.ecrire} />
          {appelsIa.length ? (
            <ul className="divide-y border-t">
              {appelsIa.map((a) => {
                const resume = (
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="font-medium">{formaterDateHeure(a.survenueLe)}</span>
                    {a.resultat && <Pastille ton={tonResultat(a.resultat)}>{STATUT_CIBLE_LIBELLES[a.resultat]}</Pastille>}
                  </span>
                );
                return (
                  <li key={a.id}>
                    {/* Seuls les appels avec transcription ont une page de détail. */}
                    {a.aDetailIa ? (
                      <Link href={`/beneficiaires/${id}/appels-ia/${a.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:text-primary">
                        {resume}
                        <span className="flex items-center gap-1 text-sm font-medium text-primary">
                          Transcription
                          <ChevronRight className="size-4" aria-hidden />
                        </span>
                      </Link>
                    ) : (
                      <div className="py-2.5">{resume}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t pt-3 text-muted-foreground">Aucun appel par l&apos;assistant pour le moment.</p>
          )}
        </Bloc>
      </Surface>
    </div>
  );
}
