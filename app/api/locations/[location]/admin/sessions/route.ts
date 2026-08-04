import { NextResponse } from "next/server";
import { getLocationConfig } from "@/lib/locations";
import { isValidAdminCode } from "@/lib/admin-auth";
import { createSession, deleteSession, updateSessionDetails } from "@/lib/attendance";

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
      sessions?: Array<{ sessionKey?: string; sessionName?: string; sessionDate?: string }>;
    };

    const result = await updateSessionDetails(
      config.slug,
      Array.isArray(body.sessions)
        ? body.sessions.map((session) => ({
            sessionKey: String(session.sessionKey || ""),
            sessionName: String(session.sessionName || ""),
            sessionDate: String(session.sessionDate || "")
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
    if (!isValidAdminCode(accessKey, config.slug)) {
      return NextResponse.json({ error: "Invalid admin access code" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      sessionDate?: string;
      sessionName?: string;
    };

    const result = await createSession(config.slug, {
      sessionDate: String(body.sessionDate || ""),
      sessionName: String(body.sessionName || "")
    });

    if (result.status === "invalid") {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown session creation error";
    console.error("Admin session create error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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

    const body = (await request.json().catch(() => ({}))) as { sessionKey?: string };
    const result = await deleteSession(config.slug, String(body.sessionKey || ""));

    if (result.status === "invalid") {
      return NextResponse.json(result, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown session delete error";
    console.error("Admin session delete error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
