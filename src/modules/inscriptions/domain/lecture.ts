/**
 * Lecture « humaine » des réponses brutes d'une inscription (détail de la file de validation).
 * Tolérante : les réponses anciennes ou partielles (seed, versions précédentes du formulaire) restent lisibles.
 */
import { formaterDate } from "@/shared/domain/dates";
import { formaterNom, formaterPrenom } from "@/shared/domain/normalisation";
import { AIDE_FORMULAIRE_LIBELLES } from "./formulaire";
import {
  CAISSE_RETRAITE_LIBELLES,
  CATEGORIE_LIBELLES,
  DEPLACEMENT_LIBELLES,
  INDISPONIBILITE_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  PRISE_EN_CHARGE_LIBELLES,
  PROTECTION_LIBELLES,
  RELATION_LIBELLES,
} from "@/shared/domain/vocabulaire";

export type ElementLu = { libelle: string; valeur: string | null };
export type SectionLue = { titre: string; elements: ElementLu[] };

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.map(objet) : []);
const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const ouiNon = (v: unknown): string | null => (v === true ? "Oui" : v === false ? "Non" : null);
const libelle = <K extends string>(table: Record<K, string>, v: unknown): string | null =>
  typeof v === "string" && v in table ? table[v as K] : texte(v);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formaterDate(v) : texte(v));
const joindre = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ") || null;

const JOURS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export function lireReponses(reponses: Brut): SectionLue[] {
  const sections: SectionLue[] = [];
  const tiers = objet(reponses.tiers);
  sections.push({
    titre: "Qui a rempli le formulaire",
    elements:
      reponses.remplisseur === "tiers"
        ? [
            { libelle: "Rempli par", valeur: "Un proche ou un tiers" },
            { libelle: "Personne informée et d'accord", valeur: ouiNon(reponses.personneInformee) },
            { libelle: "Nom du tiers", valeur: joindre(texte(tiers.prenom), texte(tiers.nom)) },
            { libelle: "Lien", valeur: texte(tiers.lien) },
            { libelle: "Téléphone du tiers", valeur: texte(tiers.telephone) },
          ]
        : [{ libelle: "Rempli par", valeur: "La personne elle-même" }],
  });

  liste(reponses.personnes).forEach((p, i, toutes) => {
    const protection = libelle(PROTECTION_LIBELLES, p.protection);
    sections.push({
      titre: toutes.length > 1 ? `Personne ${i + 1}` : "Personne concernée",
      elements: [
        { libelle: "Identité", valeur: joindre(texte(p.civilite), texte(p.prenom) && formaterPrenom(String(p.prenom)), texte(p.nom) && formaterNom(String(p.nom))) },
        { libelle: "Date de naissance", valeur: date(p.dateNaissance) },
        { libelle: "Téléphone", valeur: texte(p.telephone) },
        { libelle: "Email", valeur: texte(p.email) },
        { libelle: "Déplacement dans le domicile", valeur: libelle(DEPLACEMENT_LIBELLES, p.deplacement) },
        {
          libelle: "Mesure de protection",
          valeur: protection && p.protection !== "non" ? [protection, texte(p.protectionStructure), texte(p.protectionTelephone)].filter(Boolean).join(" · ") : protection,
        },
      ],
    });
  });

  const a = objet(reponses.adresse);
  sections.push({
    titre: "Adresse",
    elements: [
      { libelle: "Adresse", valeur: joindre(texte(a.numero), texte(a.rep), texte(a.voie)) },
      { libelle: "Résidence, bâtiment", valeur: joindre(texte(a.residence), texte(a.batiment)) },
      { libelle: "Entrée, appartement", valeur: [texte(a.entree) && `Entrée ${a.entree}`, texte(a.appartement) && `Appt ${a.appartement}`].filter(Boolean).join(", ") || null },
      { libelle: "Étage", valeur: a.etage === 0 ? "Rez-de-chaussée" : texte(a.etage) },
      { libelle: "Ascenseur", valeur: ouiNon(a.ascenseur) },
      { libelle: "Adresse reconnue (BAN)", valeur: a.banId ? "Oui" : "Non, à vérifier" },
    ],
  });

  sections.push({
    titre: "Situation",
    elements: [
      { libelle: "Mode de vie", valeur: libelle(MODE_DE_VIE_LIBELLES, reponses.modeDeVie) },
      { libelle: "Catégorie", valeur: libelle(CATEGORIE_LIBELLES, reponses.categorie) },
      {
        libelle: "Aides",
        valeur: (Array.isArray(reponses.aides) ? reponses.aides : []).map((a) => libelle(AIDE_FORMULAIRE_LIBELLES, a)).filter(Boolean).join(", ") || "Aucune indiquée",
      },
      { libelle: "Caisse de retraite", valeur: libelle(CAISSE_RETRAITE_LIBELLES, reponses.caisseRetraite) || "Non indiquée" },
    ],
  });

  const intervenants = liste(reponses.intervenants);
  sections.push({
    titre: "Intervenants à domicile",
    elements: intervenants.length
      ? intervenants.map((i) => {
          const jours = Array.isArray(i.joursPassage) ? (i.joursPassage as number[]).map((j) => JOURS[j - 1]).filter(Boolean) : [];
          const passage = jours.length ? `passe le ${jours.join(", ")}${texte(i.heurePassage) ? ` vers ${i.heurePassage}` : ""}` : null;
          return {
            libelle: libelle(PRISE_EN_CHARGE_LIBELLES, i.type) ?? "Intervenant",
            valeur: [texte(i.nom), texte(i.telephone), i.possedeCles ? "a les clés" : null, passage].filter(Boolean).join(" · "),
          };
        })
      : [{ libelle: "Services à domicile", valeur: reponses.servicesADomicile === undefined ? null : "Aucun" }],
  });

  sections.push({
    titre: "Personnes à prévenir",
    elements: liste(reponses.contactsUrgence).map((c, i) => ({
      libelle: `${i + 1}. ${libelle(RELATION_LIBELLES, c.relation) ?? "Contact"}`,
      valeur: [joindre(texte(c.prenom), texte(c.nom)), texte(c.telephone), texte(c.ville), c.possedeCles ? "a les clés" : null].filter(Boolean).join(" · "),
    })),
  });

  const absences = liste(reponses.absences);
  if (absences.length) {
    sections.push({
      titre: "Absences prévues",
      elements: absences.map((x) => ({
        libelle: libelle(INDISPONIBILITE_LIBELLES, x.type) ?? "Absence",
        valeur: `du ${date(x.debut)} au ${date(x.fin)}`,
      })),
    });
  }

  sections.push({
    titre: "Informations complémentaires",
    elements: [
      { libelle: "Logement sous les toits", valeur: ouiNon(reponses.sousLesToits) },
      { libelle: "Pièce fraîche", valeur: ouiNon(reponses.pieceFraiche) },
      { libelle: "Entend mal au téléphone", valeur: ouiNon(reponses.troublesAuditifs) },
      { libelle: "Préférence d'horaire d'appel", valeur: texte(reponses.preferenceHoraire) },
      { libelle: "Accord pour l'assistant automatique", valeur: ouiNon(reponses.accordAppelIa) },
      { libelle: "Consentement au registre", valeur: reponses.consentement === true ? "Accepté (case cochée)" : null },
    ],
  });

  return sections;
}
