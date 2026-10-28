"use client";

/**
 * Autocomplétion d'adresse (motif ARIA « combobox ») : API Adresse de la BAN, avec repli
 * sur les adresses de la commune enregistrées en base si l'API ne répond pas.
 */
import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { AdresseSaisie } from "../../domain/etapes";
import { classeSaisie, idChamp, MessageErreur } from "./champs";

type Suggestion = { libelle: string; banId: string; numero: number | null; rep: string; voie: string; lon: number; lat: number };

type FeatureBan = {
  geometry: { coordinates: [number, number] };
  properties: { id: string; label: string; housenumber?: string; street?: string; name: string; type: string };
};

async function rechercherBan(q: string, codePostal: string, commune: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&postcode=${codePostal}&limit=5`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("BAN indisponible");
  const json = (await r.json()) as { features: FeatureBan[] };
  return json.features.map((f) => {
    const n = f.properties.housenumber?.match(/^(\d+)\s*(.*)$/);
    // Lomme est une commune associée à Lille : la BAN suffixe certaines voies par « (Lomme) ».
    const voie = (f.properties.street ?? f.properties.name).replace(/\s*\([^)]*\)$/, "");
    return {
      libelle: `${f.properties.housenumber ? `${f.properties.housenumber} ` : ""}${voie}, ${codePostal} ${commune}`,
      banId: f.properties.id,
      numero: n ? Number(n[1]) : null,
      rep: n?.[2] ?? "",
      voie,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
}

async function rechercherLocal(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const r = await fetch(`/api/inscription/adresses?q=${encodeURIComponent(q)}`, { signal });
  return r.ok ? ((await r.json()) as Suggestion[]) : [];
}

export function ChampAdresse({
  adresse,
  codePostal,
  commune,
  onChange,
  erreur,
}: {
  adresse: AdresseSaisie;
  codePostal: string;
  commune: string;
  onChange: (a: Partial<AdresseSaisie>) => void;
  erreur?: string;
}) {
  const id = idChamp("adresse.voie");
  const listeId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (recherche.trim().length < 3) return;
    const controle = new AbortController();
    const minuterie = setTimeout(async () => {
      let resultats: Suggestion[] = [];
      try {
        resultats = await rechercherBan(recherche, codePostal, commune, controle.signal);
      } catch {
        if (controle.signal.aborted) return;
      }
      try {
        if (resultats.length === 0) resultats = await rechercherLocal(recherche, controle.signal);
      } catch {
        if (controle.signal.aborted) return;
      }
      setSuggestions(resultats);
      setOuvert(resultats.length > 0);
      setActif(-1);
      setStatut(resultats.length > 0 ? `${resultats.length} adresses proposées. Utilisez les flèches pour choisir.` : "Aucune adresse trouvée.");
    }, 250);
    return () => {
      clearTimeout(minuterie);
      controle.abort();
    };
  }, [recherche, codePostal, commune]);

  const choisir = (s: Suggestion) => {
    onChange({
      libelle: s.libelle,
      banId: s.banId,
      numero: s.numero === null ? "" : String(s.numero),
      rep: s.rep,
      voie: s.voie,
      lon: s.lon,
      lat: s.lat,
    });
    setOuvert(false);
    setStatut(`Adresse choisie : ${s.libelle}`);
  };

  const saisir = (texte: string) => {
    // Saisie libre : l'adresse sera vérifiée par le CCAS si elle n'est pas choisie dans la liste.
    const m = texte.trim().match(/^(\d+)\s*(bis|ter|b|t)?\b[\s,]*(.*)$/i);
    onChange({ libelle: texte, banId: "", lon: null, lat: null, numero: m ? m[1] : "", rep: m?.[2] ?? "", voie: m ? m[3] : texte });
    setRecherche(texte);
    if (texte.trim().length < 3) setOuvert(false);
  };

  const aideId = `${id}-aide`;
  return (
    <div
      ref={conteneur}
      className="relative flex flex-col gap-2"
      onBlur={(e) => {
        if (!conteneur.current?.contains(e.relatedTarget as Node | null)) setOuvert(false);
      }}
    >
      <label htmlFor={id} className="text-lg font-semibold">
        Numéro et rue
      </label>
      <p id={aideId} className="text-base text-muted-foreground">
        Commencez à écrire l&apos;adresse (par exemple « 12 rue Victor Hugo »), puis choisissez-la dans la liste.
      </p>
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      <input
        id={id}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && actif >= 0 ? `${listeId}-${actif}` : undefined}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={[aideId, erreur && `${id}-erreur`].filter(Boolean).join(" ")}
        aria-required
        autoComplete="off"
        value={adresse.libelle}
        onChange={(e) => saisir(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length) {
            e.preventDefault();
            setOuvert(true);
            setActif((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && suggestions.length) {
            e.preventDefault();
            setActif((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === "Enter" && ouvert && actif >= 0) {
            e.preventDefault();
            choisir(suggestions[actif]);
          } else if (e.key === "Escape") {
            setOuvert(false);
          }
        }}
        className={classeSaisie}
      />
      <ul
        id={listeId}
        role="listbox"
        aria-label="Adresses proposées"
        hidden={!ouvert}
        className="absolute inset-x-0 top-full z-20 mt-1 divide-y rounded-lg border bg-card"
      >
        {suggestions.map((s, i) => (
          <li
            key={s.banId + i}
            id={`${listeId}-${i}`}
            role="option"
            aria-selected={i === actif}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choisir(s)}
            className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-lg aria-selected:bg-accent hover:bg-muted"
          >
            <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {s.libelle}
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {statut}
      </p>
      {adresse.banId && (
        <p className="text-base text-ok">Adresse reconnue.</p>
      )}
    </div>
  );
}
