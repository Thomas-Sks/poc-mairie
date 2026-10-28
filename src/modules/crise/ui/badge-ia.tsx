import { Bot } from "lucide-react";

/** Badge « IA » (maquette E11, démonstration). */
export function BadgeIa() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.8125rem] font-semibold text-primary" title="Appel par l'IA (démonstration)">
      <Bot className="size-3.5" aria-hidden />
      IA
    </span>
  );
}
