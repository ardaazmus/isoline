"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";

export function MarkAllRead({ ids }: { ids: number[] }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Button
      size="sm"
      onClick={async () => {
        await api("POST", "/api/v1/notifications/read", { ids });
        router.refresh();
      }}
    >
      {t("pf.notify.markRead")}
    </Button>
  );
}
