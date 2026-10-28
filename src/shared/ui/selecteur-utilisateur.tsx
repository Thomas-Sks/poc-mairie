"use client";

import { useRef } from "react";
import { ROLE_LIBELLES, type Role } from "@/shared/domain/vocabulaire";
import { changerUtilisateur } from "./actions-session";

type Option = { id: string; prenom: string; nom: string; role: Role };

/** Sélecteur « Je suis… » du POC. Un simple <select> natif : lisible, accessible, sans surprise. */
export function SelecteurUtilisateur({ utilisateurs, courantId }: { utilisateurs: Option[]; courantId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={changerUtilisateur} className="flex items-center gap-2">
      <label htmlFor="selecteur-utilisateur" className="text-sm text-muted-foreground max-sm:sr-only">
        Connecté en tant que
      </label>
      <select
        id="selecteur-utilisateur"
        name="utilisateurId"
        defaultValue={courantId}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-11 max-w-[min(18rem,60vw)] rounded-lg border border-input bg-card px-3 text-sm font-medium"
      >
        {utilisateurs.map((u) => (
          <option key={u.id} value={u.id}>
            {u.prenom} {u.nom} · {ROLE_LIBELLES[u.role]}
          </option>
        ))}
      </select>
    </form>
  );
}
