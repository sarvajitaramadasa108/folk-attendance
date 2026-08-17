import { NextResponse } from "next/server";
import { lookupMobile } from "@/lib/attendance";
import { getLocationConfig } from "@/lib/locations";

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

    const body = (await request.json().catch(() => ({}))) as { mobile?: string };
    const result = await lookupMobile(config.slug, body.mobile || "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to lookup mobile number.";
    console.error("[attendance/lookup]", error);
    return NextResponse.json({ status: "invalid", message }, { status: 500 });
  }
}
