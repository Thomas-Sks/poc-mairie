"use client";
/**
 * Autocomplétion d'adresse (API Adresse BAN, repli sur le référentiel local).
 * Sans suggestion choisie, le texte saisi est conservé et le serveur tente un géocodage ;
 * en cas d'échec, la fiche est marquée « adresse à vérifier ».
 */
import { useEffect, useId, useRef, useState } from "react";
import { MapPin, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuggestionAdresse } from "../domain/adresse";
import { rechercherAdressesAction } from "./actions";

export type AdresseInitiale = {
  banId: string | null;
  numero: number | null;
  rep: string | null;
  voie: string;
  lon: number | null;
  lat: number | null;
  libelle: string;
};

export function ChampAdresse({ initiale, erreur, codePostal }: { initiale: AdresseInitiale | null; erreur?: string; codePostal: string }) {
  const id = useId();
  const [texte, setTexte] = useState(initiale?.libelle ?? "");
  const [choisie, setChoisie] = useState<Omit<AdresseInitiale, "libelle"> | null>(initiale?.banId ? initiale : null);
  const [suggestions, setSuggestions] = useState<SuggestionAdresse[]>([]);
  const [ouverte, setOuverte] = useState(false);
  const [active, setActive] = useState(-1);
  const [recherche, setRecherche] = useState<string | null>(null);
  const requete = useRef(0);

  useEffect(() => {
    if (recherche === null || recherche.trim().length < 3) return;
    const numero = ++requete.current;
    const minuterie = setTimeout(async () => {
      const resultats = await rechercherAdressesAction(recherche).catch(() => []);
      if (numero !== requete.current) return;
      setSuggestions(resultats);
      setOuverte(true);
      setActive(-1);
    }, 250);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  const choisir = (s: SuggestionAdresse) => {
    setChoisie({ banId: s.banId, numero: s.numero, rep: s.rep, voie: s.voie, lon: s.lon, lat: s.lat });
    setTexte(s.libelle);
    setOuverte(false);
  };

  const idListe = `${id}-suggestions`;
  const nonReconnue = texte.trim().length > 0 && !choisie;

  return (
    <div className="relative flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={id} className="text-[0.9375rem] font-medium">
        Adresse (numéro et rue)<span className="text-err"> *</span>
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={ouverte}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${idListe}-${active}` : undefined}
        aria-invalid={erreur ? true : undefined}
        autoComplete="off"
        placeholder="Ex. 12 rue du Marais"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setChoisie(null);
          setRecherche(e.target.value);
          if (e.target.value.trim().length < 3) {
            setSuggestions([]);
            setOuverte(false);
          }
        }}
        onBlur={() => setTimeout(() => setOuverte(false), 150)}
        onKeyDown={(e) => {
          if (!ouverte || !suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choisir(suggestions[active]);
          } else if (e.key === "Escape") {
            setOuverte(false);
          }
        }}
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
      {ouverte && (
        <ul id={idListe} role="listbox" className="absolute top-[4.75rem] z-30 w-full overflow-hidden rounded-lg border bg-popover">
          {suggestions.length === 0 && <li className="px-3 py-3 text-muted-foreground">Aucune adresse trouvée à {codePostal}.</li>}
          {suggestions.map((s, i) => (
            <li
              key={s.banId}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(s);
              }}
              className={cn("flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2", i === active && "bg-accent text-primary")}
            >
              <MapPin className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
              <span>{s.libelle}</span>
            </li>
          ))}
          {suggestions.length > 0 && (
            <li className="border-t px-3 py-1.5 text-xs text-subtle-foreground">
              Source : {suggestions[0].source === "ban" ? "Base Adresse Nationale" : "référentiel local des adresses (API indisponible)"}
            </li>
          )}
        </ul>
      )}
      {erreur && <p className="text-sm font-medium text-err">{erreur}</p>}
      {nonReconnue && !erreur && (
        <p className="flex items-center gap-1.5 text-sm text-warn">
          <TriangleAlert className="size-4" aria-hidden />
          Choisissez une suggestion. Sinon, la fiche sera marquée « adresse à vérifier ».
        </p>
      )}

      <input type="hidden" name="banId" value={choisie?.banId ?? ""} />
      <input type="hidden" name="numero" value={choisie?.numero ?? ""} />
      <input type="hidden" name="rep" value={choisie?.rep ?? ""} />
      <input type="hidden" name="voie" value={choisie ? choisie.voie : texte} />
      <input type="hidden" name="lon" value={choisie?.lon ?? ""} />
      <input type="hidden" name="lat" value={choisie?.lat ?? ""} />
    </div>
  );
}
