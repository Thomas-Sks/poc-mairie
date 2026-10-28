"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Centre de notifications in-app (E14-US1). Implémentation complète : module notifications. */
export function CentreNotifications() {
  return (
    <Button variant="outline" size="icon" aria-label="Notifications">
      <Bell className="size-5" />
    </Button>
  );
}
