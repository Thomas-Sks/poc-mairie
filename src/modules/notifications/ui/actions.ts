"use server";

import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { casDUsage } from "../infrastructure";

export async function marquerNotificationLueAction(id: string) {
  const entree = z.object({ id: z.uuid() }).parse({ id });
  await casDUsage.marquerNotificationLue(await obtenirContexte(), entree);
}

export async function marquerToutesLuesAction() {
  await casDUsage.marquerToutesNotificationsLues(await obtenirContexte());
}
