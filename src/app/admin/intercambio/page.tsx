import Link from "next/link";
import { ExchangeOverridesPanel } from "@/components/admin/exchange-overrides-panel";
import { RepeatedsSettingsPanel } from "@/components/admin/repeateds-settings-panel";
import { getAlbumGroups } from "@/lib/album-catalog";
import { getExchangeSettings } from "@/lib/exchange-settings-store";
import { getAdminEmail } from "@/lib/supabase/server";

export default async function ExchangeSettingsPage() {
  const email = await getAdminEmail();

  const exchangeSettings = await getExchangeSettings(email);
  const groups = getAlbumGroups();

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            Opciones de intercambio
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configura las opciones globales del álbum y los intercambios especiales por tipo o por
          cromo exacto.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/admin"
            className="inline-flex text-xs font-medium text-primary hover:underline"
          >
            Volver al home admin
          </Link>
          <Link
            href="/admin/cromos/faltantes"
            className="inline-flex text-xs font-medium text-primary hover:underline"
          >
            Ir a gestión de faltantes
          </Link>
        </div>
      </header>

      <RepeatedsSettingsPanel globalSettings={exchangeSettings.global} />
      <ExchangeOverridesPanel
        groups={groups}
        initialGroup={groups[0]?.groupCode ?? "FWC"}
        globalSettings={exchangeSettings.global}
        initialOverrides={exchangeSettings.overrides}
      />
    </main>
  );
}
