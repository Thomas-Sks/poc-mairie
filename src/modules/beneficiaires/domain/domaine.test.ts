import { describe, expect, it } from "vitest";
import { meilleureCorrespondance, pointDansPolygone, quartierContenant, type SuggestionAdresse } from "./adresse";
import { disposerGraphe, rangSuivant, trierParRang } from "./cercle";
import { trouverDoublons, normaliserNom, normaliserTelephone, type FicheExistante } from "./doublons";
import { comparer, comparerFiches, libelleAdresse, niveauEffectif, SANTE_VIDE, verifierChampsObligatoires, type SaisieFiche } from "./fiche";
import { etatIndisponibilite, indisponibiliteEnCours, rappelDeRetour, verifierPeriode } from "./indisponibilites";
import { filtrerTimeline, rappelDeSuivi } from "./journal";
import { estActive, formaterCreneau, formaterJours, joursAvantEcheance, passagePrevu, planningSemaine } from "./planning";
import { construireSynthese } from "./synthese";

const AUJOURDHUI = "2026-10-28"; // un mercredi

const saisie = (): SaisieFiche => ({
  beneficiaire: {
    civilite: "Mme",
    nom: "Dupont",
    nomNaissance: null,
    prenom: "Simone",
    sexe: "F",
    dateNaissance: "1936-10-29",
    telephoneFixe: "01 99 00 00 01",
    telephoneMobile: null,
    pasDeTelephone: false,
    email: null,
    langue: "Français",
    preferenceContact: null,
    creneauxAppel: null,
    modeDeVie: "seul",
    categorie: "senior",
    protection: "non",
    mandataireStructure: null,
    mandataireTelephone: null,
    habitudes: null,
    centresInteret: null,
    tags: [],
    infoPrioritaire: null,
    consentementRegistre: true,
    personneInformee: true,
    consentementIa: false,
    consentementPartage: false,
    consentementDate: null,
    consentementCanal: null,
  },
  sante: { ...SANTE_VIDE },
  foyer: {
    banId: "59350_x",
    numero: 12,
    rep: null,
    voie: "Rue du Marais",
    lon: 2.98,
    lat: 50.64,
    residence: null,
    batiment: null,
    entree: null,
    appartement: null,
    etage: null,
    ascenseur: null,
    codeAcces: null,
    typeLogement: "maison",
    sousLesToits: false,
    pieceFraiche: true,
    animaux: null,
  },
});

describe("fiche — champs obligatoires (E1-US1)", () => {
  it("accepte une fiche complète", () => {
    expect(verifierChampsObligatoires(saisie(), AUJOURDHUI)).toEqual({});
  });

  it("exige un téléphone ou la mention « pas de téléphone »", () => {
    const s = saisie();
    s.beneficiaire.telephoneFixe = null;
    expect(verifierChampsObligatoires(s, AUJOURDHUI).telephone).toBeDefined();
    s.beneficiaire.pasDeTelephone = true;
    expect(verifierChampsObligatoires(s, AUJOURDHUI).telephone).toBeUndefined();
  });

  it("exige nom, prénom, adresse et une date de naissance passée", () => {
    const s = saisie();
    s.beneficiaire.nom = " ";
    s.beneficiaire.prenom = "";
    s.foyer.voie = "";
    s.beneficiaire.dateNaissance = "2030-01-01";
    expect(Object.keys(verifierChampsObligatoires(s, AUJOURDHUI)).sort()).toEqual(["adresse", "dateNaissance", "nom", "prenom"]);
  });

  it("exige la structure du mandataire en cas de mesure de protection", () => {
    const s = saisie();
    s.beneficiaire.protection = "curatelle";
    expect(verifierChampsObligatoires(s, AUJOURDHUI).mandataireStructure).toBeDefined();
  });

  it("formate l'adresse et le niveau effectif", () => {
    expect(libelleAdresse({ numero: 3, rep: "bis", voie: "Rue Kiener" })).toBe("3 bis Rue Kiener");
    expect(libelleAdresse({ numero: null, rep: null, voie: "Résidence du Parc" })).toBe("Résidence du Parc");
    expect(niveauEffectif("P3", "P1")).toBe("P1");
    expect(niveauEffectif("P2", null)).toBe("P2");
  });
});

describe("fiche — historique des modifications (E1-US3)", () => {
  it("liste les champs modifiés avec libellés et valeurs formatées", () => {
    const avant = saisie();
    const apres = saisie();
    apres.beneficiaire.telephoneMobile = "06 39 98 00 01";
    apres.beneficiaire.consentementIa = true;
    apres.beneficiaire.tags = ["isolement social"];
    apres.foyer.etage = 2;
    apres.foyer.lon = 3; // technique : ignoré
    expect(comparerFiches(avant, apres)).toEqual([
      { champ: "Téléphone mobile", ancienneValeur: null, nouvelleValeur: "06 39 98 00 01" },
      { champ: "Étiquettes", ancienneValeur: null, nouvelleValeur: "isolement social" },
      { champ: "Consentement appel IA", ancienneValeur: "Non", nouvelleValeur: "Oui" },
      { champ: "Étage", ancienneValeur: null, nouvelleValeur: "2" },
    ]);
  });

  it("ignore les données de santé quand elles ne sont pas saisies", () => {
    const avant = saisie();
    const apres = { ...saisie(), sante: null };
    expect(comparerFiches(avant, apres)).toEqual([]);
  });

  it("ne signale rien quand rien ne change (vide et null équivalents)", () => {
    expect(comparer({ a: "", b: [] as string[] }, { a: null as string | null, b: [] as string[] })).toEqual([]);
  });
});

describe("doublons (E1-US1)", () => {
  const existants: FicheExistante[] = [
    { id: "1", civilite: "Mme", prenom: "Simone", nom: "DUPONT", dateNaissance: "1936-10-29", telephones: ["01 99 00 00 09"], statut: "active" },
    { id: "2", civilite: "M.", prenom: "André", nom: "Martin", dateNaissance: "1940-01-01", telephones: ["+33 6 39 98 00 01"], statut: "active" },
  ];

  it("normalise noms et téléphones", () => {
    expect(normaliserNom("  Dupont-Lefèvre ")).toBe("dupont lefevre");
    expect(normaliserTelephone("+33 6 39 98 00 01")).toBe("0639980001");
    expect(normaliserTelephone("12")).toBeNull();
  });

  it("détecte même nom + date de naissance", () => {
    const r = trouverDoublons({ nom: "dupont", dateNaissance: "1936-10-29", telephones: [] }, existants);
    expect(r.map((d) => d.fiche.id)).toEqual(["1"]);
    expect(r[0].motifs).toEqual(["Même nom et même date de naissance"]);
  });

  it("détecte même téléphone quel que soit le format", () => {
    const r = trouverDoublons({ nom: "Autre", dateNaissance: "1950-01-01", telephones: [null, "06.39.98.00.01"] }, existants);
    expect(r.map((d) => d.fiche.id)).toEqual(["2"]);
  });

  it("ne signale pas un homonyme né un autre jour", () => {
    expect(trouverDoublons({ nom: "Dupont", dateNaissance: "1937-10-29", telephones: [] }, existants)).toEqual([]);
  });
});

describe("cercle (E2)", () => {
  const membres = [
    { lienId: "a", contactId: "a", prenom: "Marie", nom: "Durand", relation: "enfant" as const, rangAppel: 2 },
    { lienId: "b", contactId: "b", prenom: "Paul", nom: "Bernard", relation: "voisin" as const, rangAppel: 1 },
    { lienId: "c", contactId: "c", prenom: null, nom: "Cabinet", relation: "infirmiere" as const, rangAppel: 7 },
  ];

  it("trie par rang d'appel", () => {
    expect(trierParRang(membres, (m) => m.nom).map((m) => m.lienId)).toEqual(["b", "a", "c"]);
    expect(rangSuivant(membres)).toBe(8);
    expect(rangSuivant([])).toBe(1);
  });

  it("place les rangs plus élevés plus loin du centre, plafonnés au dernier anneau", () => {
    const g = disposerGraphe(membres, { taille: 400, anneauxMax: 3 });
    const distance = (id: string) => {
      const n = g.noeuds.find((x) => x.membre.lienId === id)!;
      return Math.hypot(n.x - g.centre, n.y - g.centre);
    };
    expect(g.anneaux).toHaveLength(3);
    expect(g.libellesAnneaux).toEqual(["Rang 1", "Rang 2", "Rang 7"]);
    expect(disposerGraphe(membres, { anneauxMax: 2 }).libellesAnneaux).toEqual(["Rang 1", "Rang 2 et +"]);
    expect(distance("b")).toBeLessThan(distance("a"));
    expect(distance("a")).toBeLessThan(distance("c"));
    expect(g.noeuds.find((n) => n.membre.lienId === "c")!.anneau).toBe(3);
  });

  it("répartit plusieurs contacts d'un même rang sans les superposer", () => {
    const memeRang = [1, 2, 3].map((i) => ({ lienId: `${i}`, contactId: `${i}`, prenom: null, nom: `N${i}`, relation: "ami" as const, rangAppel: 1 }));
    const g = disposerGraphe(memeRang);
    const positions = new Set(g.noeuds.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(3);
  });
});

describe("planning (E6)", () => {
  const creneau = { joursSemaine: [1, 3, 5], heureDebut: "08:30", heureFin: "09:30", exceptions: ["2026-10-30"] };

  it("formate jours et créneaux", () => {
    expect(formaterJours([1, 2, 3, 4, 5, 6, 7])).toBe("Tous les jours");
    expect(formaterJours([5, 4, 3, 2, 1])).toBe("Du lundi au vendredi");
    expect(formaterCreneau(creneau)).toBe("Lun, mer, ven, 8h30 – 9h30");
    expect(formaterCreneau({ joursSemaine: [7], heureDebut: "12:00", heureFin: "12:30" })).toBe("Dim, 12h – 12h30");
  });

  it("tient compte des exceptions", () => {
    expect(passagePrevu(creneau, AUJOURDHUI)).toBe(true); // mercredi
    expect(passagePrevu(creneau, "2026-10-30")).toBe(false); // vendredi en exception
    expect(passagePrevu(creneau, "2026-10-27")).toBe(false); // mardi
  });

  it("calcule l'activité et l'échéance (E6-US7)", () => {
    expect(estActive({ dateDebut: "2026-01-01", dateFin: null }, AUJOURDHUI)).toBe(true);
    expect(estActive({ dateDebut: "2026-11-01", dateFin: null }, AUJOURDHUI)).toBe(false);
    expect(joursAvantEcheance({ dateDebut: null, dateFin: "2026-11-12" }, AUJOURDHUI)).toBe(15);
    expect(joursAvantEcheance({ dateDebut: null, dateFin: "2027-03-01" }, AUJOURDHUI)).toBeNull();
    expect(joursAvantEcheance({ dateDebut: null, dateFin: "2026-10-01" }, AUJOURDHUI)).toBeNull();
  });

  it("construit la semaine avec passages triés et exceptions marquées", () => {
    const prises = [
      { id: "repas", dateDebut: null, dateFin: null, creneaux: [{ joursSemaine: [1, 2, 3, 4, 5, 6, 7], heureDebut: "12:00", heureFin: "12:15", exceptions: [] }] },
      { id: "aide", dateDebut: null, dateFin: null, creneaux: [creneau] },
    ];
    const semaine = planningSemaine(prises, AUJOURDHUI);
    expect(semaine[0].date).toBe("2026-10-26");
    expect(semaine[0].passages.map((p) => p.prise.id)).toEqual(["aide", "repas"]);
    expect(semaine[1].passages.map((p) => p.prise.id)).toEqual(["repas"]);
    expect(semaine[4].passages.find((p) => p.prise.id === "aide")!.annule).toBe(true);
  });
});

describe("indisponibilités (E5)", () => {
  const vacances = { type: "vacances" as const, debut: "2026-10-20", fin: "2026-11-02" };

  it("détermine l'état et l'indisponibilité en cours", () => {
    expect(etatIndisponibilite(vacances, AUJOURDHUI)).toBe("en_cours");
    expect(etatIndisponibilite(vacances, "2026-11-03")).toBe("terminee");
    expect(etatIndisponibilite({ ...vacances, fin: null }, "2027-01-01")).toBe("en_cours");
    expect(etatIndisponibilite(vacances, "2026-10-01")).toBe("a_venir");
    expect(indisponibiliteEnCours([vacances], AUJOURDHUI)).toBe(vacances);
    expect(indisponibiliteEnCours([vacances], "2026-12-01")).toBeNull();
  });

  it("refuse une fin avant le début", () => {
    expect(verifierPeriode({ ...vacances, fin: "2026-10-01" })).toBe("fin_avant_debut");
    expect(verifierPeriode(vacances)).toBeNull();
  });

  it("crée le rappel « Vérifier le retour » à la date de fin (E5-US3)", () => {
    expect(rappelDeRetour(vacances, "M. André MARTIN")).toEqual({ objet: "Vérifier le retour de M. André MARTIN", echeance: "2026-11-02" });
    expect(rappelDeRetour({ ...vacances, fin: null }, "x")).toBeNull();
    expect(rappelDeRetour({ ...vacances, type: "hospitalisation" }, "x")!.objet).toContain("hospitalisation");
  });
});

describe("journal (E3)", () => {
  it("crée un rappel de suivi seulement si une action est saisie (E3-US3)", () => {
    expect(rappelDeSuivi({ actionSuivi: "  ", echeance: null, assigneA: null }, { auteurId: "u1", aujourdhui: AUJOURDHUI })).toBeNull();
    expect(rappelDeSuivi({ actionSuivi: "Rappeler la fille", echeance: null, assigneA: null }, { auteurId: "u1", aujourdhui: AUJOURDHUI })).toEqual({
      objet: "Rappeler la fille",
      echeance: "2026-10-29",
      assigneA: "u1",
    });
    expect(rappelDeSuivi({ actionSuivi: "Visite", echeance: "2026-11-05", assigneA: "u2" }, { auteurId: "u1", aujourdhui: AUJOURDHUI })!.assigneA).toBe("u2");
  });

  it("filtre la timeline par type et période, du plus récent au plus ancien (E3-US2)", () => {
    const ev = [
      { id: 1, genre: "interaction" as const, type: "appel_sortant" as const, date: new Date("2026-10-20T10:00:00Z"), campagneId: null },
      { id: 2, genre: "interaction" as const, type: "appel_ia" as const, date: new Date("2026-07-15T10:00:00Z"), campagneId: "c1" },
      { id: 3, genre: "modification" as const, type: null, date: new Date("2026-10-25T10:00:00Z"), campagneId: null },
      { id: 4, genre: "interaction" as const, type: "visite" as const, date: new Date("2025-01-01T10:00:00Z"), campagneId: null },
    ];
    expect(filtrerTimeline(ev, { type: "tous", periode: "tout" }, AUJOURDHUI).map((e) => e.id)).toEqual([3, 1, 2, 4]);
    expect(filtrerTimeline(ev, { type: "tous", periode: "30j" }, AUJOURDHUI).map((e) => e.id)).toEqual([3, 1]);
    expect(filtrerTimeline(ev, { type: "campagne", periode: "12m" }, AUJOURDHUI).map((e) => e.id)).toEqual([2]);
    expect(filtrerTimeline(ev, { type: "modification", periode: "tout" }, AUJOURDHUI).map((e) => e.id)).toEqual([3]);
    expect(filtrerTimeline(ev, { type: "visite", periode: "tout" }, AUJOURDHUI).map((e) => e.id)).toEqual([4]);
  });
});

describe("synthèse (E1-US2)", () => {
  it("réunit âge, priorité, prises actives, absence, dernier contact et prochain rappel", () => {
    const s = construireSynthese({
      dateNaissance: "1936-10-29",
      modeDeVie: "seul",
      score: 45,
      niveauPriorite: "P2",
      niveauForce: "P1",
      prises: [
        { type: "aide_domicile", dateDebut: "2025-01-01", dateFin: null },
        { type: "apa", dateDebut: "2025-01-01", dateFin: "2026-01-01" },
      ],
      indisponibilites: [{ type: "vacances", debut: "2026-10-27", fin: "2026-11-02", joignabilite: null }],
      interactions: [
        { type: "visite", survenueLe: new Date("2026-09-01T10:00:00Z"), resultat: null },
        { type: "appel_sortant", survenueLe: new Date("2026-10-20T10:00:00Z"), resultat: "joint_ras" },
      ],
      rappels: [
        { objet: "Fait", echeance: "2026-10-01", faitLe: new Date() },
        { objet: "En retard", echeance: "2026-10-27", faitLe: null },
        { objet: "Plus tard", echeance: "2026-11-27", faitLe: null },
      ],
      aujourdhui: AUJOURDHUI,
      maintenant: new Date("2026-10-28T12:00:00Z"),
    });
    expect(s.age).toBe(89);
    expect(s.vitSeul).toBe(true);
    expect(s.niveau).toBe("P1");
    expect(s.niveauForce).toBe(true);
    expect(s.prisesActives).toEqual(["Aide à domicile"]);
    expect(s.indisponibilite?.type).toBe("vacances");
    expect(s.dernierContact?.type).toBe("appel_sortant");
    expect(s.prochainRappel).toEqual({ objet: "En retard", echeance: "2026-10-27", enRetard: true });
  });
});

describe("adresse", () => {
  const sugg = (score: number, numero: number | null = 1): SuggestionAdresse => ({
    banId: "x",
    numero,
    rep: null,
    voie: "Rue",
    lon: 0,
    lat: 0,
    libelle: "1 Rue",
    score,
    source: "ban",
  });

  it("n'accepte un géocodage automatique qu'au-dessus du seuil et avec un numéro", () => {
    expect(meilleureCorrespondance([sugg(0.4), sugg(0.8)])?.score).toBe(0.8);
    expect(meilleureCorrespondance([sugg(0.5)])).toBeNull();
    expect(meilleureCorrespondance([sugg(0.9, null)])).toBeNull();
    expect(meilleureCorrespondance([])).toBeNull();
  });

  it("rattache un point à son quartier", () => {
    const carre: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(pointDansPolygone(0.5, 0.5, carre)).toBe(true);
    expect(pointDansPolygone(1.5, 0.5, carre)).toBe(false);
    expect(quartierContenant(0.5, 0.5, [{ nom: "Marais", contour: carre }])).toBe("Marais");
    expect(quartierContenant(2, 2, [{ nom: "Marais", contour: carre }])).toBeNull();
  });
});
