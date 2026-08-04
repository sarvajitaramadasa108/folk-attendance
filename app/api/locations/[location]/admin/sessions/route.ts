import { NextResponse } from "next/server";
import { getLocationConfig } from "@/lib/locations";
import { isValidAdminCode } from "@/lib/admin-auth";
import { updateSessionNames } from "@/lib/attendance";

export async function PATCH(
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

    const body = (await request.json().catch(() => ({}))) as {
      sessions?: Array<{ sessionKey?: string; sessionName?: string }>;
    };

    const result = await updateSessionNames(
      config.slug,
      Array.isArray(body.sessions)
        ? body.sessions.map((session) => ({
            sessionKey: String(session.sessionKey || ""),
            sessionName: String(session.sessionName || "")
          }))
        : []
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown session update error";
    console.error("Admin session update error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
