import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import * as s from "@/shared/infrastructure/db/schema";
import type { Contexte } from "@/shared/application/contexte";
import { GRILLE_PAR_DEFAUT } from "@/shared/domain/priorite";
import type { CorrespondanceValeurs } from "../domain/analyse";
import type { Destination } from "../domain/champs";
import type { ImportRepository } from "../application/ports";
import { importerFiches, previsualiserImport, trouverMapping } from "../application/importer";

/** Point dans un polygone [lon, lat][] (lancer de rayon). */
function dansPolygone(lon: number, lat: number, contour: [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [xi, yi] = contour[i];
    const [xj, yj] = contour[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

const importRepositoryDrizzle: ImportRepository = {
  async fichesComparables(communeId) {
    const lignes = await db
      .select({
        id: s.beneficiaires.id,
        civilite: s.beneficiaires.civilite,
        nom: s.beneficiaires.nom,
        prenom: s.beneficiaires.prenom,
        dateNaissance: s.beneficiaires.dateNaissance,
        telephoneFixe: s.beneficiaires.telephoneFixe,
        telephoneMobile: s.beneficiaires.telephoneMobile,
      })
      .from(s.beneficiaires)
      .where(and(eq(s.beneficiaires.communeId, communeId), ne(s.beneficiaires.statut, "archivee")));
    return lignes.map((b) => ({
      id: b.id,
      libelle: `${b.civilite} ${b.prenom} ${b.nom}`,
      nom: b.nom,
      prenom: b.prenom,
      dateNaissance: b.dateNaissance,
      telephones: [b.telephoneFixe, b.telephoneMobile],
    }));
  },

  async voiesConnues(communeId) {
    const lignes = await db.selectDistinct({ voie: s.adresses.voie }).from(s.adresses).where(eq(s.adresses.communeId, communeId));
    return lignes.map((l) => l.voie);
  },

  async grilleScore(communeId) {
    const [c] = await db.select({ parametres: s.communes.parametres }).from(s.communes).where(eq(s.communes.id, communeId));
    return c?.parametres.grilleScore ?? GRILLE_PAR_DEFAUT;
  },

  async communeCodePostal(communeId) {
    const [c] = await db.select({ codePostal: s.communes.codePostal }).from(s.communes).where(eq(s.communes.id, communeId));
    return c.codePostal;
  },

  async creerFiches(communeId, foyers, o) {
    const adresses = await db.select().from(s.adresses).where(eq(s.adresses.communeId, communeId));
    const parCle = new Map(adresses.map((a) => [`${a.voie}|${a.numero}|${a.rep ?? ""}`, a]));
    const quartiers = await db.select().from(s.quartiers).where(eq(s.quartiers.communeId, communeId));
    const quartierDe = (lon: number, lat: number) => quartiers.find((q) => dansPolygone(lon, lat, q.contour))?.nom ?? null;
    let fiches = 0;
    await db.transaction(async (tx) => {
      for (const membres of foyers) {
        const a = membres[0].adresse;
        // Géocodage : l'adresse exacte de la BAN si elle est connue (sinon, à vérifier par le CCAS).
        const ban = a.voieReconnue && a.numero !== null ? (parCle.get(`${a.voie}|${a.numero}|${a.rep ?? ""}`) ?? parCle.get(`${a.voie}|${a.numero}|`)) : undefined;
        const [foyer] = await tx
          .insert(s.foyers)
          .values({
            communeId,
            banId: ban?.id ?? null,
            numero: a.numero,
            rep: a.rep,
            voie: a.voie,
            residence: a.complement,
            etage: a.etage,
            codePostal: o.commune.codePostal,
            ville: o.commune.nom,
            lon: ban?.lon ?? null,
            lat: ban?.lat ?? null,
            quartier: ban ? quartierDe(ban.lon, ban.lat) : null,
            adresseAVerifier: !ban,
          })
          .returning({ id: s.foyers.id });

        for (const f of membres) {
          const [b] = await tx
            .insert(s.beneficiaires)
            .values({
              communeId,
              foyerId: foyer.id,
              civilite: f.civilite,
              sexe: f.sexe,
              nom: f.nom,
              prenom: f.prenom,
              dateNaissance: f.dateNaissance,
              telephoneFixe: f.telephoneFixe,
              telephoneMobile: f.telephoneMobile,
              pasDeTelephone: !f.telephoneFixe && !f.telephoneMobile,
              email: f.email,
              modeDeVie: f.modeDeVie,
              deplacement: f.deplacement,
              protection: f.protection,
              teleassistance: f.teleassistance,
              medecinTraitant: f.medecinTraitant,
              dateInscription: o.aujourdhui,
              consentementCanal: "Import du registre existant",
              statut: o.statut,
              score: f.score,
              niveauPriorite: f.niveauPriorite,
            })
            .returning({ id: s.beneficiaires.id });
          fiches += 1;
          if (f.contact) {
            const [contact] = await tx
              .insert(s.contacts)
              .values({ communeId, prenom: f.contact.prenom, nom: f.contact.nom, telephone: f.contact.telephone, ville: f.contact.ville })
              .returning({ id: s.contacts.id });
            await tx.insert(s.liensCercle).values({ beneficiaireId: b.id, contactId: contact.id, relation: f.contact.relation, rangAppel: 1, estUrgence: true });
          }
          if (f.teleassistance) await tx.insert(s.prisesEnCharge).values({ beneficiaireId: b.id, type: "teleassistance", intervenantNom: "Téléassistance" });
          if (f.notes.length) await tx.insert(s.notesFiche).values(f.notes.map((texte) => ({ beneficiaireId: b.id, texte, source: "import", auteurId: o.auteurId })));
        }
      }
      await tx.insert(s.journalAudit).values({ communeId, utilisateurId: o.auteurId, action: "import.excel", details: { fiches, foyers: foyers.length, statut: o.statut } });
    });
    return { foyers: foyers.length, fiches };
  },

  async trouverMapping(communeId, signature) {
    const [m] = await db
      .select()
      .from(s.mappingsImport)
      .where(and(eq(s.mappingsImport.communeId, communeId), eq(s.mappingsImport.signature, signature)));
    return m ? { signature: m.signature, nom: m.nom, colonnes: m.colonnes as Record<string, Destination>, valeurs: m.valeurs as CorrespondanceValeurs, misAJourLe: m.updatedAt } : null;
  },

  async enregistrerMapping(communeId, m, auteurId) {
    const existant = await this.trouverMapping(communeId, m.signature);
    if (existant) {
      await db
        .update(s.mappingsImport)
        .set({ nom: m.nom, colonnes: m.colonnes, valeurs: m.valeurs, creePar: auteurId, updatedAt: new Date() })
        .where(and(eq(s.mappingsImport.communeId, communeId), eq(s.mappingsImport.signature, m.signature)));
    } else {
      await db.insert(s.mappingsImport).values({ communeId, signature: m.signature, nom: m.nom, colonnes: m.colonnes, valeurs: m.valeurs, creePar: auteurId });
    }
  },
};

const deps = { imports: importRepositoryDrizzle };

export const casDUsage = {
  previsualiserImport: (ctx: Contexte, e: Parameters<typeof previsualiserImport>[2]) => previsualiserImport(deps, ctx, e),
  importerFiches: (ctx: Contexte, e: Parameters<typeof importerFiches>[2]) => importerFiches(deps, ctx, e),
  trouverMapping: (ctx: Contexte, entetes: string[]) => trouverMapping(deps, ctx, entetes),
};
