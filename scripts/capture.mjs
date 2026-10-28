// Capture d'écran d'une page de l'app : node scripts/capture.mjs <chemin> <fichier.png> [largeur] [utilisateur(prenom)]
import { chromium } from "playwright";

const [, , chemin = "/", sortie = "capture.png", largeur = "1280", prenom] = process.argv;
const base = process.env.BASE_URL ?? "http://localhost:3100";
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: Number(largeur), height: 900 } });
if (prenom) {
  await page.goto(`${base}/`);
  const option = page.locator("#selecteur-utilisateur option", { hasText: prenom }).first();
  const valeur = await option.getAttribute("value");
  await page.context().addCookies([{ name: "poc_utilisateur", value: valeur, url: base }]);
}
await page.goto(`${base}${chemin}`, { waitUntil: "networkidle" });
await page.screenshot({ path: sortie, fullPage: true });
await navigateur.close();
console.log(`Capture : ${sortie}`);
