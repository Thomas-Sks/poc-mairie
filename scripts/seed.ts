/** `pnpm db:seed` — recharge le jeu de données de démo. */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/shared/infrastructure/db/schema";
import { reinitialiserDemo } from "@/shared/infrastructure/seed/demo";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema });

const debut = Date.now();
reinitialiserDemo(db)
  .then((r) => console.log(`Démo rechargée : ${r.beneficiaires} bénéficiaires, ${r.foyers} foyers (${Date.now() - debut} ms).`))
  .finally(() => sql.end());
