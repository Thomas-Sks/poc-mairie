"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation, type DisconnectionDetails } from "@elevenlabs/react";
import { AudioLines, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bandeau, Pastille, Section, Surface } from "@/shared/ui/elements";
import { demarrerTestVocalAction } from "./actions";

type Props = { dureeMaxSecondes: number; desactive: boolean };
type Replique = { id: number; role: "agent" | "user"; texte: string };
type EtatBulle = "repos" | "connexion" | "parle" | "ecoute" | "fin";

export function ConversationTest(props: Props) {
  return (
    <ConversationProvider>
      <Appel {...props} />
    </ConversationProvider>
  );
}

function motifFin(details: DisconnectionDetails): string {
  if (details.reason === "user") return "Vous avez raccroché.";
  if (details.reason === "agent") return "L'assistant a terminé l'appel.";
  return "La communication a été coupée.";
}

function minutes(secondes: number) {
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
}

function Appel({ dureeMaxSecondes, desactive }: Props) {
  const [repliques, setRepliques] = useState<Replique[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fin, setFin] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [debut, setDebut] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const prochainId = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      const t = Date.now();
      setDebut(t);
      setMaintenant(t);
    },
    onMessage: ({ message, role }) => setRepliques((r) => [...r, { id: prochainId.current++, role, texte: message }]),
    onDisconnect: (details) => {
      setDebut(null);
      setFin(motifFin(details));
    },
    onError: () => setErreur("La communication avec l'assistant a échoué. Réessayez."),
  });

  useEffect(() => {
    if (debut === null) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [debut]);

  const enLigne = conversation.status === "connected";
  const enConnexion = preparation || conversation.status === "connecting";
  const restant = debut === null ? dureeMaxSecondes : Math.max(0, dureeMaxSecondes - Math.floor((maintenant - debut) / 1000));

  async function demarrer() {
    setErreur(null);
    setFin(null);
    setRepliques([]);
    setPreparation(true);
    try {
      try {
        const micro = await navigator.mediaDevices.getUserMedia({ audio: true });
        micro.getTracks().forEach((piste) => piste.stop());
      } catch {
        setErreur("Autorisez le micro dans votre navigateur pour parler avec l'assistant.");
        return;
      }
      const r = await demarrerTestVocalAction();
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      conversation.startSession({ conversationToken: r.jeton, connectionType: "webrtc", dynamicVariables: r.variables });
    } finally {
      setPreparation(false);
    }
  }

  const derniereReplique = repliques.findLast((r) => r.role === "agent")?.texte;
  const etat: EtatBulle = enConnexion ? "connexion" : enLigne ? (conversation.isSpeaking ? "parle" : "ecoute") : fin ? "fin" : "repos";
  const texteBulle =
    etat === "connexion"
      ? "Je compose le numéro…"
      : etat === "fin"
        ? fin
        : enLigne
          ? (derniereReplique ?? "Allô ?")
          : "Décrochez comme si vous étiez un senior.";

  return (
    <>
      <Bulle etat={etat} texte={texteBulle ?? ""} volumes={conversation.getOutputByteFrequencyData} />

      <div className="flex flex-wrap items-center gap-4">
        {enLigne ? (
          <Button variant="destructive" size="lg" onClick={() => conversation.endSession()}>
            <PhoneOff aria-hidden />
            Raccrocher
          </Button>
        ) : (
          <Button size="lg" onClick={demarrer} disabled={desactive || enConnexion}>
            <Phone aria-hidden />
            {fin ? "Refaire un appel" : "Démarrer l'appel"}
          </Button>
        )}
        {enLigne && (
          <p className="tabular text-muted-foreground" aria-live="off">
            Temps restant : <span className="font-semibold text-foreground">{minutes(restant)}</span>
          </p>
        )}
      </div>

      {erreur && <Bandeau ton="err">{erreur}</Bandeau>}

      {repliques.length > 0 && (
        <Surface className="px-5 py-5 sm:px-6">
          <Section titre="Ce qui a été dit">
            <ul className="divide-y">
              {repliques.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                  <span className={r.role === "agent" ? "w-24 shrink-0 font-semibold text-primary" : "w-24 shrink-0 font-semibold"}>
                    {r.role === "agent" ? "Assistant" : "Vous"}
                  </span>
                  <span>{r.texte}</span>
                </li>
              ))}
            </ul>
          </Section>
        </Surface>
      )}
    </>
  );
}

const NB_BARRES = 5;
const HAUTEUR_MIN = 6;
const HAUTEUR_MAX = 40;

/** Bulle de l'assistant : ses barres suivent le volume de sa voix quand il parle. */
function Bulle({ etat, texte, volumes }: { etat: EtatBulle; texte: string; volumes: () => Uint8Array }) {
  const barres = useRef<(HTMLSpanElement | null)[]>([]);
  const lireVolumes = useRef(volumes);
  useEffect(() => {
    lireVolumes.current = volumes;
  }, [volumes]);

  useEffect(() => {
    const poser = (hauteurs: number[]) =>
      barres.current.forEach((b, i) => {
        if (b) b.style.height = `${hauteurs[i] ?? HAUTEUR_MIN}px`;
      });
    const calme = Array<number>(NB_BARRES).fill(HAUTEUR_MIN);
    if (etat !== "parle" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      poser(etat === "parle" ? [16, 28, 40, 28, 16] : calme);
      return;
    }
    let image = 0;
    const suivre = () => {
      const donnees = lireVolumes.current();
      const bande = Math.max(1, Math.floor(donnees.length / 2 / NB_BARRES));
      poser(
        Array.from({ length: NB_BARRES }, (_, i) => {
          let somme = 0;
          for (let j = i * bande; j < (i + 1) * bande; j++) somme += donnees[j] ?? 0;
          return HAUTEUR_MIN + ((somme / bande) / 255) * (HAUTEUR_MAX - HAUTEUR_MIN);
        }),
      );
      image = requestAnimationFrame(suivre);
    };
    image = requestAnimationFrame(suivre);
    return () => {
      cancelAnimationFrame(image);
      poser(calme);
    };
  }, [etat]);

  return (
    <div className="relative mb-3">
      <section aria-label="Assistant vocal" className="flex flex-col gap-4 rounded-lg border bg-card px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold">
            <AudioLines className="size-5 text-primary" aria-hidden />
            Assistant vocal du CCAS
          </p>
          {etat === "connexion" && <Pastille ton="neutre">Connexion…</Pastille>}
          {etat === "parle" && <Pastille ton="accent">Parle</Pastille>}
          {etat === "ecoute" && <Pastille ton="ok">Vous écoute</Pastille>}
        </div>
        <div className="flex items-center gap-5">
          <div className="flex h-10 shrink-0 items-center gap-1" aria-hidden>
            {Array.from({ length: NB_BARRES }, (_, i) => (
              <span
                key={i}
                ref={(b) => {
                  barres.current[i] = b;
                }}
                className={etat === "parle" ? "w-1.5 rounded-sm bg-primary" : "w-1.5 rounded-sm bg-border"}
                style={{ height: HAUTEUR_MIN }}
              />
            ))}
          </div>
          <p className="text-xl leading-snug" aria-live="polite">
            {texte}
          </p>
        </div>
      </section>
      {/* Pointe de la bulle */}
      <span aria-hidden className="absolute -bottom-2 left-10 size-4 rotate-45 border-r border-b bg-card" />
    </div>
  );
}
