"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/infrastructure/db/client";
import { utilisateurs } from "@/shared/infrastructure/db/schema";
import { COOKIE_UTILISATEUR } from "@/shared/infrastructure/session";
import { accueilPour } from "./navigation";

/** Sélecteur d'utilisateur du POC (§10.2) : change l'utilisateur courant puis ouvre son accueil. */
export async function changerUtilisateur(formData: FormData) {
  const id = z.uuid().parse(formData.get("utilisateurId"));
  const utilisateur = await db.query.utilisateurs.findFirst({ where: eq(utilisateurs.id, id) });
  if (!utilisateur) throw new Error("Utilisateur inconnu");

  const jar = await cookies();
  jar.set(COOKIE_UTILISATEUR, utilisateur.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(accueilPour(utilisateur.role));
}
