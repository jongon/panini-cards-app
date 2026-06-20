import { FaltantesQuickPanel } from "@/components/admin/faltantes-quick-panel";
import { getAlbumGroups, getGroupStickers } from "@/lib/album-catalog";
import { getMissingInventory } from "@/lib/missing-store";
import { getAdminEmail } from "@/lib/supabase/server";

export default async function FaltantesPage() {
  const email = await getAdminEmail();
  const missingInventory = await getMissingInventory(email);

  const items = getAlbumGroups().flatMap((group) =>
    getGroupStickers(group.groupCode)
      .filter((sticker) => missingInventory.items[sticker.code] === true)
      .map((sticker) => ({
        code: sticker.code,
        label: sticker.label,
        type: sticker.type,
        teamName: group.displayName,
      })),
  );

  return <FaltantesQuickPanel items={items} />;
}
