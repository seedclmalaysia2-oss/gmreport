import { generateClassicPptx } from "./classic";
import { generateModernPptx } from "./modern";
import type { PptxInput, Template } from "./shared";

export async function generatePptx(input: PptxInput): Promise<Uint8Array> {
  if (input.template === "modern") return generateModernPptx(input);
  return generateClassicPptx(input);
}

export type { PptxInput, Template };
