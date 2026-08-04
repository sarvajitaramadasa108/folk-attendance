import { NextResponse } from "next/server";
import { getAdminSummary } from "@/lib/attendance";
import { isValidAdminCode } from "@/lib/admin-auth";
import { getLocationConfig } from "@/lib/locations";

export async function GET(
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

    if (!isValidAdminCode(accessKey, config.slug)) {
      return NextResponse.json({ error: "Invalid admin access code" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionKey = url.searchParams.get("sessionKey") || undefined;
    const result = await getAdminSummary(config.slug, sessionKey);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin summary error";
    console.error("Admin summary error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
