import { NextResponse } from "next/server";
import { getAttendanceHistory } from "@/lib/attendance";
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

    const body = (await request.json().catch(() => ({}))) as {
      mobile?: string;
      personId?: string;
    };

    const result = await getAttendanceHistory(config.slug, body.mobile || "", body.personId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown history error";
    console.error("History error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
