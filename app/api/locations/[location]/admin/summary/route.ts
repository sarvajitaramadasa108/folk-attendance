import { NextResponse } from "next/server";
import { getAdminSummary } from "@/lib/attendance";
import { getLocationConfig } from "@/lib/locations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ location: string }> }
) {
  const { location } = await params;
  const config = getLocationConfig(location);

  if (!config) {
    return NextResponse.json({ error: "Unknown location" }, { status: 404 });
  }

  const accessKey = request.headers.get("x-admin-key") || "";
  const secret = process.env.ADMIN_ACCESS_CODE || "";

  if (!secret || accessKey !== secret) {
    return NextResponse.json({ error: "Invalid admin access code" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionKey = url.searchParams.get("sessionKey") || undefined;
  const result = await getAdminSummary(config.slug, sessionKey);
  return NextResponse.json(result);
}
