import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Classes d'un bouton pour un lien (fusionnées, comme dans <Button>). */
export const classeBouton = (...args: Parameters<typeof buttonVariants>) => cn(buttonVariants(...args));
