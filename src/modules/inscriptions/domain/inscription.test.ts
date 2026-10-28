import { describe, expect, it } from "vitest";
import { detecterDoublons, motifsDoublon } from "./doublons";
import {
  contactVide,
  inscriptionBloquee,
  intervenantVide,
  premiereEtapeEnErreur,
  saisieVersReponses,
  saisieVide,
  validerEtape,
  validerFormulaire,
  type Saisie,
} from "./etapes";
import { heurePlusUne, transformerInscription } from "./transformation";

const AUJOURDHUI = "2026-10-28";

/** Mme Germaine VASSEUR (§10.4) : 88 ans, seule, en fauteuil, sous les toits, inscrite par sa fille. */
function saisieGermaine(): Saisie {
  const s = saisieVide();
  s.remplisseur = "tiers";
  s.personneInformee = true;
  s.tiers = { prenom: "Martine", nom: "Vasseur", lien: "Fille", telephone: "06.39.98.77.01" };
  s.personnes[0] = {
    ...s.personnes[0],
    civilite: "Mme",
    nom: "vasseur",
    prenom: "germaine",
    dateNaissance: "14/03/1938",
    telephone: "0199007701",
    deplacement: "fauteuil",
    protection: "non",
  };
  s.adresse = { ...s.adresse, libelle: "12 Avenue de Dunkerque", banId: "59350_1234_00012", numero: "12", voie: "Avenue de Dunkerque", lon: 3.0, lat: 50.63, etage: "6", ascenseur: true };
  s.modeDeVie = "seul";
  s.categorie = "senior";
  s.servicesADomicile = false;
  s.contactsUrgence = [{ prenom: "martine", nom: "Vasseur", relation: "enfant", telephone: "06 39 98 77 01", possedeCles: false, ville: "Lille" }];
  s.sousLesToits = true;
  s.pieceFraiche = false;
  s.consentement = true;
  return s;
}

describe("validation étape par étape", () => {
  it("un formulaire vide est en erreur dès l'étape 1", () => {
    expect(validerEtape(0, saisieVide())).toEqual({ remplisseur: "Indiquez qui remplit le formulaire" });
    expect(premiereEtapeEnErreur(saisieVide())).toBe(0);
  });

  it("un tiers non informé bloque l'inscription", () => {
    const s = saisieVide();
    s.remplisseur = "tiers";
    s.personneInformee = false;
    expect(inscriptionBloquee(s)).toBe(true);
    expect(validerEtape(0, s).personneInformee).toMatch(/volontaire/);
  });

  it("le tiers doit donner son nom et son téléphone", () => {
    const s = saisieVide();
    s.remplisseur = "tiers";
    s.personneInformee = true;
    const erreurs = validerEtape(0, s);
    expect(erreurs["tiers.nom"]).toBe("Indiquez votre nom");
    expect(erreurs["tiers.telephone"]).toBe("Indiquez votre numéro de téléphone");
  });

  it("signale une date de naissance illisible avec un message clair", () => {
    const s = saisieGermaine();
    s.personnes[0].dateNaissance = "31/02/1938";
    expect(validerEtape(1, s)["personnes.0.dateNaissance"]).toMatch(/JJ\/MM\/AAAA/);
  });

  it("ne valide que les personnes déclarées (1 ou 2)", () => {
    const s = saisieGermaine();
    expect(validerEtape(1, s)).toEqual({});
    s.nombrePersonnes = 2;
    expect(validerEtape(1, s)["personnes.1.nom"]).toBe("Indiquez le nom");
  });

  it("une mesure de protection demande la structure", () => {
    const s = saisieGermaine();
    s.personnes[0].protection = "curatelle";
    expect(validerEtape(3, s)["personnes.0.protectionStructure"]).toBeDefined();
  });

  it("des services à domicile annoncés demandent au moins un intervenant", () => {
    const s = saisieGermaine();
    s.servicesADomicile = true;
    expect(validerEtape(4, s).intervenants).toMatch(/au moins un service/);
    s.intervenants = [{ ...intervenantVide("aide_domicile"), nom: "ADMR Lomme", joursPassage: [1, 3], heurePassage: "09:00" }];
    expect(validerEtape(4, s)).toEqual({});
  });

  it("au moins une personne à prévenir, avec un téléphone valide", () => {
    const s = saisieGermaine();
    s.contactsUrgence = [contactVide()];
    const erreurs = validerEtape(5, s);
    expect(erreurs["contactsUrgence.0.telephone"]).toBeDefined();
    expect(erreurs["contactsUrgence.0.nom"]).toBe("Indiquez le nom");
  });

  it("une absence se termine après son début", () => {
    const s = saisieGermaine();
    s.absences = [{ type: "vacances", debut: "2026-11-10", fin: "2026-11-01" }];
    expect(validerEtape(6, s)["absences.0.fin"]).toMatch(/après/);
  });

  it("le consentement est obligatoire", () => {
    const s = saisieGermaine();
    s.consentement = false;
    expect(validerEtape(8, s).consentement).toMatch(/accepter/);
  });

  it("un formulaire complet est valide et normalisé", () => {
    const r = validerFormulaire(saisieVersReponses(saisieGermaine()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.formulaire.personnes[0].dateNaissance).toBe("1938-03-14");
      expect(r.formulaire.tiers?.telephone).toBe("06 39 98 77 01");
      expect(r.formulaire.adresse.etage).toBe(6);
    }
    expect(premiereEtapeEnErreur(saisieGermaine())).toBeNull();
  });
});

describe("transformation formulaire → fiches", () => {
  const commune = { nom: "Lomme", codePostal: "59160" };

  it("Mme VASSEUR obtient un score P1 (§10.4)", () => {
    const r = validerFormulaire(saisieVersReponses(saisieGermaine()));
    if (!r.ok) throw new Error("formulaire invalide");
    const t = transformerInscription(r.formulaire, { aujourdhui: AUJOURDHUI, commune });
    expect(t.fiches).toHaveLength(1);
    const [f] = t.fiches;
    expect(f).toMatchObject({ nom: "VASSEUR", prenom: "Germaine", civilite: "Mme", sexe: "F", statut: "en_attente", telephoneFixe: "01 99 00 77 01" });
    // seule 20 + 85 ans 15 + fauteuil 15 + aucune clé 5 + logement chaud 10 + aucune aide 10 = 75
    expect(f.score).toBe(75);
    expect(f.niveauPriorite).toBe("P1");
    expect(t.foyer).toMatchObject({ voie: "Avenue de Dunkerque", numero: 12, etage: 6, sousLesToits: true, codePostal: "59160", ville: "Lomme", adresseAVerifier: false });
    expect(t.contacts[0]).toMatchObject({ prenom: "Martine", nom: "VASSEUR", relation: "enfant", rangAppel: 1 });
  });

  it("un couple donne 2 fiches au même foyer, chacune avec son score", () => {
    const s = saisieGermaine();
    s.nombrePersonnes = 2;
    s.modeDeVie = "couple";
    s.personnes[1] = { ...s.personnes[0], civilite: "M.", prenom: "Marcel", dateNaissance: "02/02/1950", telephone: "", deplacement: "seul" };
    s.servicesADomicile = true;
    s.intervenants = [
      { ...intervenantVide("aide_domicile"), nom: "ADMR", possedeCles: true, joursPassage: [5, 1], heurePassage: "09:00" },
      { ...intervenantVide("medecin_traitant"), nom: "Dr Martin" },
    ];
    s.absences = [{ type: "vacances", debut: "2026-12-20", fin: "2027-01-03" }];
    const r = validerFormulaire(saisieVersReponses(s));
    if (!r.ok) throw new Error(JSON.stringify(r.erreurs));
    const t = transformerInscription(r.formulaire, { aujourdhui: AUJOURDHUI, commune });
    expect(t.fiches.map((f) => f.prenom)).toEqual(["Germaine", "Marcel"]);
    expect(t.fiches[0].score).not.toBe(t.fiches[1].score);
    expect(t.fiches[1]).toMatchObject({ sexe: "M", telephoneFixe: "01 99 00 77 01", pasDeTelephone: false, medecinTraitant: "Dr Martin" });
    expect(t.prisesEnCharge[0].creneau).toEqual({ joursSemaine: [1, 5], heureDebut: "09:00", heureFin: "10:00" });
    expect(t.prisesEnCharge[1].creneau).toBeNull();
    expect(t.indisponibilites).toEqual([{ type: "vacances", debut: "2026-12-20", fin: "2027-01-03", source: "Formulaire d'inscription" }]);
  });

  it("une adresse saisie sans autocomplétion est à vérifier", () => {
    const s = saisieGermaine();
    s.adresse = { ...s.adresse, banId: "", numero: "", voie: "Résidence les Tilleuls", lon: null, lat: null };
    const r = validerFormulaire(saisieVersReponses(s));
    if (!r.ok) throw new Error("formulaire invalide");
    expect(transformerInscription(r.formulaire, { aujourdhui: AUJOURDHUI, commune }).foyer.adresseAVerifier).toBe(true);
  });

  it("ajoute une heure par défaut", () => {
    expect(heurePlusUne("08:30")).toBe("09:30");
    expect(heurePlusUne("23:30")).toBe("23:30");
  });
});

describe("détection des doublons", () => {
  const existants = [
    { id: "a", libelle: "Mme Germaine VASSEUR", nom: "VASSEUR", dateNaissance: "1938-03-14", telephones: ["01 99 00 00 01"] },
    { id: "b", libelle: "M. Roger CARON", nom: "CARON", dateNaissance: "1954-01-01", telephones: ["06 39 98 00 07"] },
  ];

  it("même nom (accents et casse ignorés) et même date de naissance", () => {
    const d = detecterDoublons({ nom: "Vasseur", dateNaissance: "1938-03-14", telephones: [] }, existants);
    expect(d).toEqual([{ id: "a", libelle: "Mme Germaine VASSEUR", motifs: ["identite"] }]);
  });

  it("même téléphone, quel que soit le format", () => {
    const d = detecterDoublons({ nom: "DURAND", dateNaissance: "1940-01-01", telephones: ["+33 6 39 98 00 07"] }, existants);
    expect(d.map((x) => x.id)).toEqual(["b"]);
    expect(d[0].motifs).toEqual(["telephone"]);
  });

  it("homonyme né un autre jour : pas de doublon", () => {
    expect(motifsDoublon({ nom: "VASSEUR", dateNaissance: "1940-03-14", telephones: [] }, existants[0])).toEqual([]);
  });
});
