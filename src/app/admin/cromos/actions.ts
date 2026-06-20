"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGroupStickers, isValidGroupCode } from "@/lib/album-catalog";
import {
  type ExchangeSettings,
  ExchangeSettingsSchema,
  type StickerOverride,
  StickerOverrideSchema,
} from "@/lib/exchange-settings";
import {
  resetStickerOverride,
  saveGlobalExchangeSettings,
  saveStickerOverride,
} from "@/lib/exchange-settings-store";
import {
  clearMissingInventoryForAdmin,
  isStickerMissingForAdmin,
  markStickersAsCompletedForAdmin,
  toMissingRecord,
} from "@/lib/missing";
import { MissingStickerCodeSchema } from "@/lib/missing-schema";
import { getMissingInventory, replaceMissingInventory } from "@/lib/missing-store";
import type { RepeatedInventory } from "@/lib/repeateds";
import { saveGroupRepeateds } from "@/lib/repeateds-store";
import { getAdminEmail } from "@/lib/supabase/server";

const QuantityMapSchema = z.record(z.string(), z.number().int().min(0));
const StickerCodesSchema = z.array(MissingStickerCodeSchema);

export async function saveGroupRepeatedsAction(
  groupCode: string,
  quantities: Record<string, number>,
): Promise<RepeatedInventory> {
  const email = await getAdminEmail();

  if (!isValidGroupCode(groupCode)) {
    throw new Error("Grupo inválido");
  }

  const parsed = QuantityMapSchema.parse(quantities);
  const allowedCodes = new Set(getGroupStickers(groupCode).map((sticker) => sticker.code));
  const missingInventory = await getMissingInventory(email);
  for (const code of Object.keys(parsed)) {
    if (!allowedCodes.has(code)) {
      throw new Error("Código fuera del grupo seleccionado");
    }
  }

  const sanitized = Object.fromEntries(
    Object.entries(parsed).filter(([code]) => !missingInventory.items[code]),
  );

  const saved = await saveGroupRepeateds(email, groupCode, sanitized, allowedCodes);
  revalidatePath("/admin/cromos");
  return saved;
}

export async function saveGlobalExchangeSettingsAction(
  globalSettings: ExchangeSettings,
): Promise<void> {
  const email = await getAdminEmail();

  const parsed = ExchangeSettingsSchema.parse(globalSettings);
  await saveGlobalExchangeSettings(email, parsed);
  revalidatePath("/admin/cromos");
  revalidatePath("/admin/intercambio");
}
export async function saveStickerRuleAction(
  stickerCode: string,
  override: StickerOverride | null,
): Promise<void> {
  const email = await getAdminEmail();

  if (!stickerCode?.includes("-")) {
    throw new Error("Código de cromo inválido");
  }

  const parsedOverride = StickerOverrideSchema.nullable().parse(override);
  const exactStickerCode = parsedOverride?.exact?.stickerCode;

  if (exactStickerCode && !(await isStickerMissingForAdmin(email, exactStickerCode))) {
    throw new Error("El cromo exacto debe estar marcado como faltante antes de guardarlo.");
  }

  await saveStickerOverride(email, stickerCode, parsedOverride);
  revalidatePath("/admin/intercambio");
  revalidatePath("/admin/cromos");
}

export async function resetStickerOverrideAction(stickerCode: string): Promise<void> {
  const email = await getAdminEmail();

  if (!stickerCode?.includes("-")) {
    throw new Error("Código de cromo inválido");
  }

  await resetStickerOverride(email, stickerCode);
  revalidatePath("/admin/intercambio");
  revalidatePath("/admin/cromos");
}

export async function toggleMissingStickerAction(
  stickerCode: string,
  nextMissing: boolean,
): Promise<void> {
  const email = await getAdminEmail();

  const parsedStickerCode = MissingStickerCodeSchema.parse(stickerCode);
  const inventory = await getMissingInventory(email);
  const nextItems = { ...inventory.items };

  if (nextMissing) {
    nextItems[parsedStickerCode] = true;
  } else {
    delete nextItems[parsedStickerCode];
  }

  await replaceMissingInventory(email, nextItems);
  revalidatePath("/admin/cromos/faltantes");
  revalidatePath("/admin/faltantes");
}

export async function applyBulkMissingAction(
  stickerCodes: string[],
  nextMissing: boolean,
): Promise<void> {
  const email = await getAdminEmail();

  const parsedStickerCodes = StickerCodesSchema.parse(stickerCodes);
  const inventory = await getMissingInventory(email);
  const nextCodes = new Set(Object.keys(inventory.items));

  for (const code of parsedStickerCodes) {
    if (nextMissing) {
      nextCodes.add(code);
    } else {
      nextCodes.delete(code);
    }
  }

  await replaceMissingInventory(email, toMissingRecord([...nextCodes]));
  revalidatePath("/admin/cromos/faltantes");
  revalidatePath("/admin/faltantes");
}

export async function clearMissingInventoryAction(): Promise<void> {
  const email = await getAdminEmail();

  await clearMissingInventoryForAdmin(email);
  revalidatePath("/admin/cromos/faltantes");
  revalidatePath("/admin/faltantes");
}

export async function markMissingStickerCompletedAction(stickerCode: string): Promise<void> {
  const email = await getAdminEmail();

  await markStickersAsCompletedForAdmin(email, [MissingStickerCodeSchema.parse(stickerCode)]);
  revalidatePath("/admin/cromos/faltantes");
  revalidatePath("/admin/faltantes");
}
