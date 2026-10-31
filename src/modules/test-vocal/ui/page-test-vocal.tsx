import { Bandeau, EnTetePage, Page } from "@/shared/ui/elements";
import { DUREE_MAX_SECONDES } from "../domain/script";
import { casDUsageTestVocal } from "../infrastructure";
import { ConversationTest } from "./conversation-test";

export function PageTestVocal() {
  const voixActive = casDUsageTestVocal.voixActive();
  return (
    <Page className="max-w-3xl">
      <EnTetePage titre="Test Vocal AI" />
      {!voixActive && <Bandeau>La voix n&apos;est pas encore branchée : la clé ElevenLabs manque sur le serveur.</Bandeau>}
      <ConversationTest dureeMaxSecondes={DUREE_MAX_SECONDES} desactive={!voixActive} />
    </Page>
  );
}
