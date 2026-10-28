import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function LienRetour({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 w-fit items-center gap-2 font-medium text-primary underline-offset-4 hover:underline print:hidden">
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
