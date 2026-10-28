import { describe, expect, it } from "vitest";
import {
  analyserLignes,
  cleFoyer,
  correspondanceValeursInitiale,
  decouperAdresse,
  decouperNomPrenom,
  rapportRejetsCsv,
  trouverVoie,
  valeursAMapper,
  type ParametresImport,
} from "./analyse";
import { detecterLigneEntete, signatureFormat, suggererCorrespondance, suggererValeur } from "./champs";

describe("suggestion de correspondance des colonnes", () => {
  it("reconnaît les en-têtes « sales » d'un fichier de mairie", () => {
    const entetes = ["N°", "Civ.", "NOM", "Prénom", "DDN", "Adresse", "Tél", "Portable", "Vit seul(e) ?", "Mobilité", "Téléalarme", "Personne à prévenir", "Tél. contact", "Lien", "Observations", "Agent référent"];
    expect(suggererCorrespondance(entetes)).toEqual([
      "ignorer",
      "civilite",
      "nom",
      "prenom",
      "dateNaissance",
      "adresse",
      "telephone",
      "telephoneMobile",
      "modeDeVie",
      "deplacement",
      "teleassistance",
      "contactNom",
      "contactTelephone",
      "contactRelation",
      "note",
      "ignorer",
    ]);
  });

  it("n'attribue un champ qu'une fois et ignore les colonnes inconnues", () => {
    expect(suggererCorrespondance(["Nom", "nom", "Couleur préférée"])).toEqual(["nom", "ignorer", "ignorer"]);
  });

  it("« Date de naissance » et « Nom et prénom »", () => {
    expect(suggererCorrespondance(["Nom et prénom", "Date de naissance", "Téléphone fixe"])).toEqual(["nomPrenom", "dateNaissance", "telephoneFixe"]);
  });

  it("détecte la ligne d'en-tête sous un titre", () => {
    const lignes = [["REGISTRE PLAN CANICULE 2025"], ["Mise à jour le 12/06/2025"], [], ["Civ.", "NOM", "Prénom", "DDN"], ["Mme", "X", "Y", "01/01/1940"]];
    expect(detecterLigneEntete(lignes)).toBe(3);
  });

  it("l'empreinte d'un format ignore casse et accents", () => {
    expect(signatureFormat(["Tél", "NOM"])).toBe(signatureFormat(["tel", "Nom"]));
  });
});

describe("correspondance des valeurs de listes", () => {
  it.each([
    ["deplacement", "FR", "fauteuil"],
    ["deplacement", "fauteuil", "fauteuil"],
    ["deplacement", "Déamb.", "deambulateur"],
    ["deplacement", "grabataire", "immobilise"],
    ["civilite", "Madame", "Mme"],
    ["civilite", "Mr", "M."],
    ["modeDeVie", "OUI", "seul"],
    ["teleassistance", "x", "oui"],
    ["contactRelation", "Fille", "enfant"],
    ["protection", "Curatelle renforcée", "curatelle"],
  ] as const)("%s « %s » → %s", (champ, brut, attendu) => {
    expect(suggererValeur(champ, brut)).toBe(attendu);
  });

  it("une valeur inconnue n'est pas devinée", () => {
    expect(suggererValeur("deplacement", "voir dossier")).toBeNull();
  });

  it("liste les valeurs distinctes et propose une correspondance", () => {
    const aMapper = valeursAMapper([["fauteuil"], ["FR"], ["fauteuil"], [""]], ["deplacement"]);
    expect(aMapper).toEqual([{ champ: "deplacement", valeurs: [{ cle: "fauteuil", exemple: "fauteuil", occurrences: 2 }, { cle: "fr", exemple: "FR", occurrences: 1 }] }]);
    expect(correspondanceValeursInitiale(aMapper, { deplacement: { fr: "canne" } })).toEqual({ deplacement: { fauteuil: "fauteuil", fr: "canne" } });
  });
});

describe("adresses et noms", () => {
  it("découpe une adresse saisie", () => {
    expect(decouperAdresse("12 bis, rue Victor Hugo 59160 Lomme")).toEqual({ numero: 12, rep: "bis", voie: "rue Victor Hugo" });
    expect(decouperAdresse("Résidence les Tilleuls")).toEqual({ numero: null, rep: null, voie: "Résidence les Tilleuls" });
  });

  it("retrouve la voie officielle malgré les abréviations", () => {
    const voies = ["Rue Victor Hugo", "Avenue de Dunkerque", "Rue de l'Égalité"];
    expect(trouverVoie("r. victor hugo", voies)).toBe("Rue Victor Hugo");
    expect(trouverVoie("Av de Dunkerque", voies)).toBe("Avenue de Dunkerque");
    expect(trouverVoie("rue de l egalite", voies)).toBe("Rue de l'Égalité");
    expect(trouverVoie("Rue V. Hugo", voies)).toBe("Rue Victor Hugo");
    expect(trouverVoie("Rue inconnue", voies)).toBeNull();
  });

  it("sépare nom et prénom", () => {
    expect(decouperNomPrenom("DUPONT Jean-Pierre")).toEqual({ nom: "DUPONT", prenom: "Jean-Pierre" });
    expect(decouperNomPrenom("Marie LE GALL")).toEqual({ nom: "LE GALL", prenom: "Marie" });
    expect(decouperNomPrenom("Martin Paul")).toEqual({ nom: "Martin", prenom: "Paul" });
  });
});

describe("analyse des lignes", () => {
  const entetes = ["Civ.", "NOM", "Prénom", "DDN", "Adresse", "Tél", "Mobilité", "Téléalarme", "Personne à prévenir", "Tél. contact", "Observations"];
  const destinations = suggererCorrespondance(entetes);
  const lignes = [
    ["Mme", "martin", "jeanne", "12/03/1938", "4 r. Victor Hugo", "03.20.12.34.56", "FR", "oui", "DURAND Sophie", "0639981111", "Diabétique"],
    ["M.", "Petit", "Louis", "31/02/1940", "8 rue Victor Hugo", "", "", "", "", "", ""],
    ["Mr", "Leroy", "Paul", "1941-05-02", "1 rue inconnue", "06 39 98", "voir dossier", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", ""],
    ["Mme", "Vasseur", "Germaine", "14/03/1938", "12 avenue de Dunkerque", "", "", "", "", "", ""],
    ["Mme", "MARTIN", "Jeanne", "12-3-38", "4 rue Victor Hugo", "", "", "", "", "", ""],
  ];
  const aMapper = valeursAMapper(lignes, destinations);
  const p: ParametresImport = { entetes, destinations, valeurs: correspondanceValeursInitiale(aMapper) };
  const ref = {
    aujourdhui: "2026-10-28",
    voiesConnues: ["Rue Victor Hugo", "Avenue de Dunkerque"],
    existants: [{ id: "a", libelle: "Mme Germaine VASSEUR", nom: "VASSEUR", dateNaissance: "1938-03-14", telephones: [] }],
  };
  const r = analyserLignes(lignes, 5, p, ref);

  it("ignore les lignes vides et numérote comme le tableur", () => {
    expect(r.map((x) => x.numero)).toEqual([5, 6, 7, 9, 10]);
  });

  it("normalise une ligne valide (téléphone, liste, contact, note)", () => {
    expect(r[0].erreurs).toEqual([]);
    expect(r[0].fiche).toMatchObject({
      civilite: "Mme",
      nom: "MARTIN",
      prenom: "Jeanne",
      dateNaissance: "1938-03-12",
      telephoneFixe: "03 20 12 34 56",
      deplacement: "fauteuil",
      teleassistance: true,
      adresse: { numero: 4, voie: "Rue Victor Hugo", voieReconnue: true },
      contact: { nom: "DURAND", prenom: "Sophie", telephone: "06 39 98 11 11", relation: "autre" },
      notes: ["Observations : Diabétique"],
    });
  });

  it("signale la date invalide", () => {
    expect(r[1].erreurs).toEqual(["Date de naissance invalide : « 31/02/1940 »"]);
    expect(r[1].fiche).toBeNull();
  });

  it("signale le téléphone mal formé, la valeur et la rue inconnues", () => {
    expect(r[2].erreurs).toEqual(["Téléphone (fixe ou mobile) mal formé : « 06 39 98 »"]);
    // « voir dossier » a été vu (et laissé vide) à l'étape 3 : seule la rue inconnue est signalée.
    expect(r[2].avertissements).toEqual(["Rue « rue inconnue » introuvable dans la Base Adresse Nationale : adresse à vérifier"]);
    const sansCorrespondance = analyserLignes([lignes[2]], 7, { ...p, valeurs: {} }, ref);
    expect(sansCorrespondance[0].avertissements).toContain("Déplacement dans le domicile « voir dossier » non reconnu(e) : valeur ignorée");
  });

  it("signale les doublons avec le registre et dans le fichier", () => {
    expect(r[3].erreurs[0]).toMatch(/^Doublon : Mme Germaine VASSEUR existe déjà/);
    expect(r[4].erreurs).toEqual(["Doublon de la ligne 5 du fichier"]);
  });

  it("regroupe les personnes d'un même logement", () => {
    const f = r[0].fiche!;
    expect(cleFoyer(f)).toBe(cleFoyer({ ...f, adresse: { ...f.adresse, voie: "rue victor hugo" } }));
  });

  it("produit un rapport CSV des rejets lisible par Excel", () => {
    const csv = rapportRejetsCsv(entetes, r.filter((x) => x.erreurs.length > 0));
    const lignesCsv = csv.replace("﻿", "").trim().split("\r\n");
    expect(lignesCsv[0]).toBe(`Ligne du fichier;Motif du rejet;${entetes.join(";")}`);
    expect(lignesCsv).toHaveLength(5);
    expect(lignesCsv[1].startsWith("6;Date de naissance invalide")).toBe(true);
  });
});
