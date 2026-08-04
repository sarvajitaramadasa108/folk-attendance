import { notFound } from "next/navigation";
import { AttendanceKiosk } from "@/components/attendance-kiosk";
import { getLocationConfig } from "@/lib/locations";

export default async function LocationPage({
  params
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  const config = getLocationConfig(location);

  if (!config) {
    notFound();
  }

  return (
    <main className="shell">
      <div className="container">
        <AttendanceKiosk
          locationSlug={config.slug}
          locationName={config.name}
          accent={config.accent}
        />
      </div>
    </main>
  );
}
