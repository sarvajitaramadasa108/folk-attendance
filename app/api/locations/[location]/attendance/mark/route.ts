import { NextResponse } from "next/server";
import { markAttendanceForPerson } from "@/lib/attendance";
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

    const body = (await request.json().catch(() => ({}))) as { personId?: string };
    if (!body.personId) {
      return NextResponse.json({ status: "not_found" }, { status: 400 });
    }

    const result = await markAttendanceForPerson(config.slug, body.personId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark attendance.";
    console.error("[attendance/mark]", error);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
