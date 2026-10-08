/** Pure helpers safe to import from client components (no fixture imports). */
import type { ModuleContent, StageBlock } from "./types";
import type { StageId } from "@/lib/stages";

export function getBlock<S extends StageId>(mod: ModuleContent, stage: S) {
  return mod.blocks.find((b) => b.stage === stage) as Extract<StageBlock, { stage: S }> | undefined;
}
