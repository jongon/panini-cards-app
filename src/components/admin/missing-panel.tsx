"use client";

import { CircleAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  applyBulkMissingAction,
  clearMissingInventoryAction,
  markMissingStickerCompletedAction,
  toggleMissingStickerAction,
} from "@/app/admin/cromos/actions";
import { AdminNavLink } from "@/components/admin/nav-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type AlbumGroup, getGroupStickers, STICKER_TYPE_LABEL } from "@/lib/album-catalog";
import { cn } from "@/lib/utils";

type MissingPanelProps = {
  groups: AlbumGroup[];
  totalStickers: number;
  initialItems: Record<string, boolean>;
  repeatedItems: Record<string, number>;
};

type BulkMode = "mark" | "unmark";

export function MissingPanel({
  groups,
  totalStickers,
  initialItems,
  repeatedItems,
}: MissingPanelProps) {
  const [items, setItems] = useState<Record<string, boolean>>(initialItems);
  const [selectedCodes, setSelectedCodes] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ tone: "idle" | "saved" | "error"; message: string }>({
    tone: "idle",
    message: "",
  });
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [completeCode, setCompleteCode] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const selectedList = useMemo(
    () =>
      Object.entries(selectedCodes)
        .filter(([, selected]) => selected)
        .map(([code]) => code)
        .sort(),
    [selectedCodes],
  );

  const missingCount = useMemo(() => Object.values(items).filter((value) => value).length, [items]);

  const groupedStickers = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();

    return groups
      .map((group) => {
        const stickers = getGroupStickers(group.groupCode)
          .filter((sticker) => {
            if (!term) {
              return true;
            }

            return `${group.displayName} ${group.groupCode} ${sticker.code} ${sticker.label}`
              .toLowerCase()
              .includes(term);
          })
          .sort((left, right) => {
            const leftMissing = items[left.code] === true ? 1 : 0;
            const rightMissing = items[right.code] === true ? 1 : 0;

            if (leftMissing !== rightMissing) {
              return rightMissing - leftMissing;
            }

            return left.position - right.position;
          });

        return { group, stickers };
      })
      .filter(({ stickers }) => stickers.length > 0);
  }, [deferredSearch, groups, items]);

  const updateStatus = (tone: "saved" | "error", message: string) => {
    setStatus({ tone, message });
  };

  const toggleSelection = (stickerCode: string, nextSelected: boolean) => {
    setSelectedCodes((prev) => {
      const next = { ...prev };

      if (nextSelected) {
        next[stickerCode] = true;
      } else {
        delete next[stickerCode];
      }

      return next;
    });
  };

  const handleToggleMissing = (stickerCode: string, nextMissing: boolean) => {
    startTransition(async () => {
      try {
        await toggleMissingStickerAction(stickerCode, nextMissing);
        setItems((prev) => {
          const next = { ...prev };
          if (nextMissing) {
            next[stickerCode] = true;
          } else {
            delete next[stickerCode];
          }
          return next;
        });
        updateStatus(
          "saved",
          `${stickerCode} ${nextMissing ? "marcado" : "desmarcado"} como faltante.`,
        );
      } catch {
        updateStatus("error", `No se pudo actualizar ${stickerCode}.`);
      }
    });
  };

  const confirmBulkAction = () => {
    if (!bulkMode || selectedList.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        await applyBulkMissingAction(selectedList, bulkMode === "mark");
        setItems((prev) => {
          const next = { ...prev };
          for (const code of selectedList) {
            if (bulkMode === "mark") {
              next[code] = true;
            } else {
              delete next[code];
            }
          }
          return next;
        });
        setSelectedCodes({});
        updateStatus(
          "saved",
          `${selectedList.length} cromos ${bulkMode === "mark" ? "marcados" : "desmarcados"}.`,
        );
        setBulkMode(null);
      } catch {
        updateStatus("error", "No se pudo aplicar la acción masiva.");
      }
    });
  };

  const confirmClear = () => {
    startTransition(async () => {
      try {
        await clearMissingInventoryAction();
        setItems({});
        setSelectedCodes({});
        updateStatus("saved", "Inventario de faltantes vaciado.");
        setClearOpen(false);
      } catch {
        updateStatus("error", "No se pudo vaciar el inventario.");
      }
    });
  };

  const confirmComplete = () => {
    if (!completeCode) {
      return;
    }

    startTransition(async () => {
      try {
        await markMissingStickerCompletedAction(completeCode);
        setItems((prev) => {
          const next = { ...prev };
          delete next[completeCode];
          return next;
        });
        setSelectedCodes((prev) => {
          const next = { ...prev };
          delete next[completeCode];
          return next;
        });
        updateStatus("saved", `${completeCode} marcado como completado.`);
        setCompleteCode(null);
      } catch {
        updateStatus("error", `No se pudo completar ${completeCode}.`);
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl tracking-tight text-foreground">
                Gestión de cromos faltantes
              </h1>
              <span className="inline-flex h-5 items-center rounded-full bg-brand px-2 text-xs font-medium text-brand-foreground">
                {missingCount}/{totalStickers}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Marca lo que aún te falta del álbum completo. Un cromo faltante no debe quedar también
              como repetido.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AdminNavLink href="/admin/cromos">Ver repetidos</AdminNavLink>
            <Link
              href="/admin"
              className="inline-flex text-xs font-medium text-primary hover:underline"
            >
              Volver al home admin
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Selección múltiple</p>
            <p className="text-xs text-muted-foreground">
              {selectedList.length === 0
                ? "Selecciona varios cromos para marcarlos o desmarcarlos juntos."
                : `${selectedList.length} cromos seleccionados.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || selectedList.length === 0}
              onClick={() => setBulkMode("mark")}
            >
              Marcar como faltante
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || selectedList.length === 0}
              onClick={() => setBulkMode("unmark")}
            >
              Desmarcar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending || missingCount === 0}
              onClick={() => setClearOpen(true)}
            >
              <Trash2 />
              Vaciar inventario
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="missing-search" className="text-sm font-medium text-foreground">
            Buscar cromo o selección
          </label>
          <Input
            id="missing-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ARG-14, Jugador 1, Argentina..."
          />
        </div>

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

      <section className="space-y-6">
        {groupedStickers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
            No encontramos cromos para <span className="font-medium text-foreground">{search}</span>
            .
          </div>
        ) : null}
        {groupedStickers.map(({ group, stickers }) => {
          const groupMissingCount = stickers.filter((sticker) => items[sticker.code]).length;

          return (
            <section key={group.groupCode} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-xl tracking-tight text-foreground">
                  {group.displayName}
                </h2>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  {group.groupCode}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {groupMissingCount}/{stickers.length} faltantes
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stickers.map((sticker) => {
                  const isMissing = items[sticker.code] === true;
                  const isRepeated = (repeatedItems[sticker.code] ?? 0) > 0;
                  const isSelected = selectedCodes[sticker.code] === true;

                  return (
                    <article
                      key={sticker.code}
                      className={cn(
                        "rounded-xl border bg-background p-4 shadow-sm transition",
                        isMissing ? "border-primary/35 bg-primary/5" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-muted/50 px-2 text-xs font-semibold text-foreground">
                              {sticker.position}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {sticker.code}
                              </p>
                              <p className="text-xs text-muted-foreground">{sticker.label}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              {STICKER_TYPE_LABEL[sticker.type]}
                            </Badge>
                            {isMissing ? (
                              <Badge variant="secondary" className="bg-primary/10 text-primary">
                                Faltante
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) =>
                              toggleSelection(sticker.code, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-border"
                          />
                          Seleccionar
                        </label>
                      </div>

                      {isMissing && isRepeated ? (
                        <div
                          role="alert"
                          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
                        >
                          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            También figura como repetido. Quita ese repetido desde `/admin/cromos`
                            para dejar el inventario consistente.
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isMissing}
                            disabled={pending}
                            onCheckedChange={(checked) => {
                              handleToggleMissing(sticker.code, Boolean(checked));
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Faltante</span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || !isMissing}
                          onClick={() => setCompleteCode(sticker.code)}
                        >
                          Marcar como completado
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <Dialog open={bulkMode !== null} onOpenChange={(open) => (!open ? setBulkMode(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkMode === "mark" ? "Marcar selección como faltante" : "Desmarcar selección"}
            </DialogTitle>
            <DialogDescription>
              {bulkMode === "mark"
                ? `Se marcarán ${selectedList.length} cromos como faltantes.`
                : `Se quitarán ${selectedList.length} cromos del inventario de faltantes.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkMode(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmBulkAction} disabled={pending}>
              {pending ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vaciar inventario de faltantes</DialogTitle>
            <DialogDescription>
              Esta acción elimina todos los cromos marcados como faltantes para esta cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmClear} disabled={pending}>
              {pending ? "Vaciando..." : "Sí, vaciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completeCode !== null}
        onOpenChange={(open) => (!open ? setCompleteCode(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como completado</DialogTitle>
            <DialogDescription>
              {completeCode
                ? `Se quitará ${completeCode} del inventario de faltantes.`
                : "Se quitará el cromo del inventario de faltantes."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompleteCode(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmComplete} disabled={pending}>
              {pending ? "Actualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
