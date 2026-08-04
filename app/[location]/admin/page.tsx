import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getLocationConfig } from "@/lib/locations";

export default async function AdminPage({
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
        <AdminDashboard locationSlug={config.slug} locationName={config.name} subtitle={config.subtitle} accent={config.accent} />
      </div>
    </main>
  );
}
