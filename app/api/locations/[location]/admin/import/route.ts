import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getLocationConfig } from "@/lib/locations";
import { isValidAdminCode } from "@/lib/admin-auth";
import { importWorkbookToMongo, readWorkbookFromBuffer } from "@/lib/workbook-import";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ location: string }> }
) {
  try {
    const { location } = await params;
    const config = getLocationConfig(location);

    if (!config) {
      return NextResponse.json({ error: "Unknown location" }, { status: 404 });
    }

    const accessKey = request.headers.get("x-admin-key") || "";
    if (!isValidAdminCode(accessKey)) {
      return NextResponse.json({ error: "Invalid admin access code" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const replace = String(formData.get("replace") || "true") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Workbook file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = readWorkbookFromBuffer(buffer);
    const db = await getDb();
    const result = await importWorkbookToMongo({
      db,
      workbook,
      locationSlug: config.slug,
      replaceExisting: replace
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    console.error("Admin import error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
