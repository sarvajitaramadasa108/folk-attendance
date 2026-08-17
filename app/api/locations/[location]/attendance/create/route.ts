import { NextResponse } from "next/server";
import { createPersonAndMark } from "@/lib/attendance";
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
      name?: string;
      age?: number | null;
      gender?: string;
      status?: string;
      college?: string;
      branch?: string;
      year?: string;
      companyName?: string;
      coachingInstitute?: string;
    };

    if (!body.mobile || !body.name) {
      return NextResponse.json({ status: "invalid", message: "Mobile and name are required." }, { status: 400 });
    }

    const result = await createPersonAndMark(config.slug, {
      mobile: body.mobile,
      personId: body.personId,
      name: body.name,
      age: body.age ?? null,
      gender: body.gender,
      status: body.status,
      college: body.college,
      branch: body.branch,
      year: body.year,
      companyName: body.companyName,
      coachingInstitute: body.coachingInstitute
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save attendance.";
    console.error("[attendance/create]", error);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
