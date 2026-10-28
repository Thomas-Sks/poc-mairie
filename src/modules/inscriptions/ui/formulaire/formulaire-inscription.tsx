"use client";

/**
 * E7-US1 / E7-US5 — Formulaire public d'inscription : une étape par écran, progression textuelle,
 * validation Zod étape par étape, brouillon sauvegardé sur l'appareil, envoi par Server Action.
 */
import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bandeau } from "@/shared/ui/elements";
import {
  ETAPES,
  inscriptionBloquee,
  NOMBRE_ETAPES,
  premiereEtapeEnErreur,
  saisieVersReponses,
  saisieVide,
  validerEtape,
  type Erreurs,
  type Saisie,
} from "../../domain/etapes";
import type { AccuseReception } from "../../domain/transformation";
import { soumettreInscriptionAction } from "../actions-public";
import { idChamp } from "./champs";
import { Confirmation } from "./confirmation";
import {
  EtapeAbsences,
  EtapeAdresse,
  EtapeComplements,
  EtapeConsentement,
  EtapeContacts,
  EtapeIntervenants,
  EtapePersonnes,
  EtapeQui,
  EtapeSituation,
  type CommuneFormulaire,
  type ProprietesEtape,
} from "./etapes-formulaire";

const CLE_BROUILLON = "registre-inscription-brouillon-v1";

const COMPOSANTS: ComponentType<ProprietesEtape>[] = [
  EtapeQui,
  EtapePersonnes,
  EtapeAdresse,
  EtapeSituation,
  EtapeIntervenants,
  EtapeContacts,
  EtapeAbsences,
  EtapeComplements,
  EtapeConsentement,
];

type Brouillon = { saisie: Saisie; etape: number };

function lireBrouillon(): Brouillon | null {
  try {
    const brut = window.localStorage.getItem(CLE_BROUILLON);
    if (!brut) return null;
    const b = JSON.parse(brut) as Brouillon;
    // Brouillon d'une version antérieure : on complète avec les champs manquants.
    return { saisie: { ...saisieVide(), ...b.saisie }, etape: Math.min(Math.max(0, b.etape), NOMBRE_ETAPES - 1) };
  } catch {
    return null;
  }
}

function ecrireBrouillon(b: Brouillon | null) {
  try {
    if (b) window.localStorage.setItem(CLE_BROUILLON, JSON.stringify(b));
    else window.localStorage.removeItem(CLE_BROUILLON);
  } catch {
    // Stockage indisponible (navigation privée) : le formulaire fonctionne sans brouillon.
  }
}

export function FormulaireInscription({ commune }: { commune: CommuneFormulaire }) {
  // Composant rendu uniquement côté navigateur (cf. chargeur) : on peut lire le brouillon à l'initialisation.
  const [initial] = useState(lireBrouillon);
  const [saisie, setSaisie] = useState<Saisie>(initial?.saisie ?? saisieVide());
  const [etape, setEtape] = useState(initial?.etape ?? 0);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [potDeMiel, setPotDeMiel] = useState("");
  const [envoi, demarrerEnvoi] = useTransition();
  const [resultat, setResultat] = useState<{ reference: string; accuse: AccuseReception | null } | null>(null);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const recapitulatif = useRef<HTMLDivElement>(null);
  const premierRendu = useRef(true);

  useEffect(() => {
    if (!resultat) ecrireBrouillon({ saisie, etape });
  }, [saisie, etape, resultat]);

  useEffect(() => {
    document.title = resultat
      ? "Demande envoyée · Inscription au registre"
      : `Étape ${etape + 1} sur ${NOMBRE_ETAPES} : ${ETAPES[etape].titre} · Inscription au registre`;
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    window.scrollTo(0, 0);
    titre.current?.focus();
  }, [etape, resultat]);

  const maj = (modifier: (s: Saisie) => void) => {
    const copie = structuredClone(saisie);
    modifier(copie);
    setSaisie(copie);
    // Une erreur corrigée disparaît aussitôt ; les nouvelles n'apparaissent qu'au clic sur « Continuer ».
    if (Object.keys(erreurs).length > 0) {
      const restantes = validerEtape(etape, copie);
      setErreurs((e) => Object.fromEntries(Object.entries(e).filter(([cle]) => cle in restantes)));
    }
  };

  const montrerErreurs = (e: Erreurs) => {
    setErreurs(e);
    requestAnimationFrame(() => recapitulatif.current?.focus());
  };

  const allerA = (cible: number) => {
    setErreurs({});
    setEtape(cible);
  };

  const continuer = () => {
    const e = validerEtape(etape, saisie);
    if (Object.keys(e).length > 0) return montrerErreurs(e);
    allerA(etape + 1);
  };

  const envoyer = () => {
    const e = validerEtape(etape, saisie);
    if (Object.keys(e).length > 0) return montrerErreurs(e);
    const enErreur = premiereEtapeEnErreur(saisie);
    if (enErreur !== null) {
      setEtape(enErreur);
      return montrerErreurs(validerEtape(enErreur, saisie));
    }
    setErreurEnvoi(null);
    demarrerEnvoi(async () => {
      try {
        const r = await soumettreInscriptionAction({ reponses: saisieVersReponses(saisie), potDeMiel });
        if (r.ok) {
          ecrireBrouillon(null);
          setResultat({ reference: r.reference, accuse: r.accuse });
        } else {
          setErreurEnvoi(Object.values(r.erreurs)[0] ?? "Le formulaire contient une erreur.");
        }
      } catch {
        setErreurEnvoi("L'envoi n'a pas abouti. Vérifiez votre connexion internet puis réessayez : vos réponses sont conservées.");
      }
    });
  };

  const recommencer = () => {
    ecrireBrouillon(null);
    setSaisie(saisieVide());
    setErreurs({});
    setResultat(null);
    setEtape(0);
  };

  if (resultat) return <Confirmation reference={resultat.reference} accuse={resultat.accuse} commune={commune} onRecommencer={recommencer} titreRef={titre} />;

  const Etape = COMPOSANTS[etape];
  const bloquee = etape === 0 && inscriptionBloquee(saisie);
  const listeErreurs = Object.entries(erreurs);
  const derniere = etape === NOMBRE_ETAPES - 1;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (derniere) envoyer();
        else continuer();
      }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <p className="text-lg font-semibold text-primary">
          Étape {etape + 1} sur {NOMBRE_ETAPES}
        </p>
        <div className="h-2 w-full rounded-full bg-muted" aria-hidden>
          <div className="h-2 rounded-full bg-primary" style={{ width: `${((etape + 1) / NOMBRE_ETAPES) * 100}%` }} />
        </div>
        <h1 ref={titre} tabIndex={-1} className="text-[1.75rem] font-bold leading-tight outline-none">
          {ETAPES[etape].titre}
        </h1>
      </div>

      {listeErreurs.length > 0 && (
        <div ref={recapitulatif} tabIndex={-1} role="alert" className="flex flex-col gap-2 rounded-lg bg-err-soft px-4 py-3 text-lg text-err outline-none focus-visible:ring-3 focus-visible:ring-err/30">
          <p className="font-bold">
            {listeErreurs.length === 1 ? "Un point est à corriger :" : `${listeErreurs.length} points sont à corriger :`}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            {listeErreurs.map(([cle, message]) => (
              <li key={cle}>
                <a href={`#${idChamp(cle)}`} className="underline underline-offset-2">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Etape saisie={saisie} maj={maj} erreurs={erreurs} commune={commune} allerA={allerA} />

      {/* E7-US6 : champ « pot de miel », invisible pour les personnes et ignoré des lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Site web (ne pas remplir)
          <input type="text" name="site_web" tabIndex={-1} autoComplete="off" value={potDeMiel} onChange={(e) => setPotDeMiel(e.target.value)} />
        </label>
      </div>

      {erreurEnvoi && <Bandeau ton="err" className="text-lg">{erreurEnvoi}</Bandeau>}

      <div className="flex flex-col-reverse gap-3 border-t border-input pt-6 sm:flex-row sm:justify-between">
        {etape > 0 ? (
          <Button type="button" variant="outline" size="lg" className="h-14 text-lg" onClick={() => allerA(etape - 1)}>
            <ArrowLeft aria-hidden />
            Étape précédente
          </Button>
        ) : (
          <span />
        )}
        {!bloquee && (
          <Button type="submit" size="lg" className="h-14 text-lg" disabled={envoi}>
            {derniere ? (
              <>
                <Send aria-hidden />
                {envoi ? "Envoi en cours…" : "Envoyer mon inscription"}
              </>
            ) : (
              <>
                Continuer
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1 text-base text-muted-foreground">
        <p>Vos réponses sont enregistrées sur cet appareil : vous pouvez fermer la page et reprendre plus tard.</p>
        <p>
          Besoin d&apos;aide ? Appelez la {commune.structureNom} au{" "}
          <a className="font-semibold text-primary underline" href={`tel:${commune.structureTelephone.replace(/\s/g, "")}`}>
            {commune.structureTelephone}
          </a>
          .{" "}
          <button type="button" onClick={recommencer} className="font-semibold text-primary underline">
            Effacer mes réponses et recommencer
          </button>
        </p>
      </div>
    </form>
  );
}
