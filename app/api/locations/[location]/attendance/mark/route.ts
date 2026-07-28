import { NextResponse } from "next/server";
import { markExistingPerson } from "@/lib/attendance";
import { getLocationConfig } from "@/lib/locations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ location: string }> }
) {
  const { location } = await params;
  const config = getLocationConfig(location);

  if (!config) {
    return NextResponse.json({ error: "Unknown location" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { personId?: string };
  if (!body.personId) {
    return NextResponse.json({ status: "not_found" }, { status: 400 });
  }

  const result = await markExistingPerson(config.slug, body.personId);
  return NextResponse.json(result);
}
