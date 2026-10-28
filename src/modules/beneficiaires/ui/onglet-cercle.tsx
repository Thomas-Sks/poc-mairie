/** Onglet « Cercle » : graphe radial (écrans larges) et liste triée par rang d'appel (E2). */
import { Surface } from "@/shared/ui/elements";
import { casDUsage } from "../infrastructure";
import { chargerFiche } from "./cadre-fiche";
import { GrapheCercle } from "./graphe-cercle";
import { ListeCercle } from "./liste-cercle";

export async function OngletCercle({ id }: { id: string }) {
  const { ctx, fiche, droits } = await chargerFiche(id);
  const liens = await casDUsage.listerCercle(ctx, { beneficiaireId: id });

  return (
    <div className="flex flex-col gap-6">
      {liens.length > 0 && (
        <Surface className="hidden p-5 sm:p-6 md:block">
          <h2 className="mb-4 text-xl font-semibold">Cercle de proches</h2>
          <GrapheCercle
            centre={fiche.beneficiaire.prenom}
            noeuds={liens.map((l) => ({ lienId: l.lienId, relation: l.relation, rangAppel: l.rangAppel, possedeCles: l.possedeCles, estUrgence: l.estUrgence, ...l.contact }))}
          />
        </Surface>
      )}
      <Surface className="p-5 sm:p-6">
        <ListeCercle beneficiaireId={id} liens={liens} modifiable={droits.ecrire} />
      </Surface>
    </div>
  );
}
