import { NextRequest } from "next/server";
import { z } from "zod";
import { generateBhagavatamPptx } from "@/lib/bhagavatam-ppt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  deckTitle: z.string().trim().min(1).max(100).default("SB Class PPT"),
  verseReference: z.string().trim().max(120).default(""),
  verse: z.string().trim().min(1, "Verse text is required."),
  synonyms: z.string().trim().default(""),
  translation: z.string().trim().default(""),
  purport: z.string().trim().default("")
});

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the form values and try again.",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const buffer = (await generateBhagavatamPptx(parsed.data)) as Uint8Array;
  const fileName = slugify(parsed.data.deckTitle || "bhagavatam-ppt") + ".pptx";

  const blob = new Blob([Buffer.from(buffer)]);

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "bhagavatam-ppt";
}
