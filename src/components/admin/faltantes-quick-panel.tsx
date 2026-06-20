"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toggleMissingStickerAction } from "@/app/admin/cromos/actions";
import { AdminNavLink } from "@/components/admin/nav-link";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { STICKER_TYPE_LABEL, type StickerType } from "@/lib/album-catalog";
import { cn } from "@/lib/utils";

type FaltanteItem = {
  code: string;
  label: string;
  type: StickerType;
  teamName: string;
};

type FaltantesQuickPanelProps = {
  items: FaltanteItem[];
};

export function FaltantesQuickPanel({ items }: FaltantesQuickPanelProps) {
  // Seed every listed sticker as missing. Toggling off does NOT remove the row:
  // it stays visible (dimmed) until the page is reloaded.
  const [missing, setMissing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.code, true])),
  );
  const [status, setStatus] = useState<{ tone: "idle" | "saved" | "error"; message: string }>({
    tone: "idle",
    message: "",
  });
  const [pending, startTransition] = useTransition();

  const missingCount = useMemo(
    () => items.filter((item) => missing[item.code]).length,
    [items, missing],
  );

  const handleToggle = (stickerCode: string, nextMissing: boolean) => {
    startTransition(async () => {
      try {
        await toggleMissingStickerAction(stickerCode, nextMissing);
        setMissing((prev) => ({ ...prev, [stickerCode]: nextMissing }));
        setStatus({
          tone: "saved",
          message: `${stickerCode} ${nextMissing ? "sigue como faltante" : "marcado como conseguido"}.`,
        });
      } catch {
        setStatus({ tone: "error", message: `No se pudo actualizar ${stickerCode}.` });
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl tracking-tight text-foreground">Faltantes</h1>
            <span className="inline-flex h-5 items-center rounded-full bg-brand px-2 text-xs font-medium text-brand-foreground">
              {missingCount} {missingCount === 1 ? "faltante" : "faltantes"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AdminNavLink href="/admin/cromos/faltantes">Gestión de faltantes</AdminNavLink>
            <Link
              href="/admin"
              className="inline-flex text-xs font-medium text-primary hover:underline"
            >
              Volver al home admin
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Solo tus cromos faltantes, para revisarlos rápido. Apaga el interruptor cuando consigas
          uno; seguirá visible hasta que recargues.
        </p>
        {status.tone !== "idle" ? (
          <p
            className={cn(
              "text-xs",
              status.tone === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {status.message}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
          No te falta ningún cromo 🎉
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const isMissing = missing[item.code] === true;

            return (
              <li
                key={item.code}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border bg-background p-2.5 shadow-sm transition",
                  isMissing ? "border-primary/35 bg-primary/5" : "border-border opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-semibold leading-tight text-foreground",
                      !isMissing && "line-through",
                    )}
                  >
                    {item.code}
                  </span>
                  <Switch
                    checked={isMissing}
                    disabled={pending}
                    onCheckedChange={(checked) => handleToggle(item.code, Boolean(checked))}
                    aria-label={`Marcar ${item.code} como faltante`}
                  />
                </div>
                <p className="truncate text-xs text-muted-foreground" title={item.teamName}>
                  {item.teamName}
                </p>
                <Badge
                  variant="secondary"
                  className="w-fit bg-muted text-[10px] text-muted-foreground"
                >
                  {STICKER_TYPE_LABEL[item.type]}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
