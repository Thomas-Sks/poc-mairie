"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ilYA, type TypeNotification } from "../domain/notification";
import { marquerNotificationLueAction, marquerToutesLuesAction } from "./actions";

type NotificationJson = {
  id: string;
  type: TypeNotification;
  titre: string;
  message: string | null;
  lien: string | null;
  lue: boolean;
  createdAt: string;
};

type Reponse = { nonLues: number; notifications: NotificationJson[] };

const CLE = ["notifications"];

async function charger(): Promise<Reponse> {
  const r = await fetch("/api/notifications", { cache: "no-store" });
  if (!r.ok) throw new Error("Notifications indisponibles");
  return r.json();
}

/** Centre de notifications in-app (E14-US1) : cloche, compteur de non-lues, liste en popover. Polling 10 s. */
export function CentreNotifications() {
  const [ouvert, setOuvert] = useState(false);
  const [, demarrer] = useTransition();
  const router = useRouter();
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: CLE, queryFn: charger, refetchInterval: 10_000 });

  const nonLues = data?.nonLues ?? 0;
  const notifications = data?.notifications ?? [];
  const maintenant = new Date();

  const ouvrir = (n: NotificationJson) =>
    demarrer(async () => {
      setOuvert(false);
      if (n.lien) router.push(n.lien);
      if (!n.lue) {
        await marquerNotificationLueAction(n.id);
        await client.invalidateQueries({ queryKey: CLE });
      }
    });

  const toutLire = () =>
    demarrer(async () => {
      await marquerToutesLuesAction();
      await client.invalidateQueries({ queryKey: CLE });
    });

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label={nonLues > 0 ? `Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
          >
            <Bell className="size-5" aria-hidden />
            {nonLues > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground tabular"
              >
                {nonLues > 9 ? "9+" : nonLues}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <PopoverTitle className="text-base font-semibold">Notifications</PopoverTitle>
          {nonLues > 0 && (
            <Button variant="ghost" onClick={toutLire} className="-mr-2">
              <CheckCheck aria-hidden />
              Tout marquer comme lu
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-base text-muted-foreground">Aucune notification pour le moment.</p>
        ) : (
          <ul className="max-h-[min(28rem,70dvh)] divide-y overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => ouvrir(n)}
                  className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                >
                  <span
                    aria-hidden
                    className={cn("mt-2 size-2 shrink-0 rounded-full", n.lue ? "bg-transparent" : "bg-primary")}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-[0.9375rem]", n.lue ? "text-muted-foreground" : "font-semibold text-foreground")}>
                      {n.titre}
                      {!n.lue && <span className="sr-only"> (non lue)</span>}
                    </span>
                    {n.message && <span className="text-sm text-muted-foreground">{n.message}</span>}
                    <span className="text-[0.8125rem] text-subtle-foreground">{ilYA(new Date(n.createdAt), maintenant)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
