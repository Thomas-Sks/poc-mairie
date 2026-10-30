import { redirect } from "next/navigation";

/** L'accueil CCAS est le registre : on y pose ses questions et on y retrouve les personnes. */
export default function Accueil() {
  redirect("/beneficiaires");
}
