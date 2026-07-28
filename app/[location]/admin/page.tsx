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
        <header className="pageHeader">
          <div className="brandMark">
            <span className="brandDot" />
            {config.name} admin
          </div>
          <div className="subtle">Protected dashboard</div>
        </header>

        <section className="hero" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
          <div className="card cardPad">
            <div className="eyebrow" style={{ color: config.accent }}>
              {config.subtitle}
            </div>
            <h1 className="title">Operations view for {config.name}</h1>
            <p className="lead">
              Review master data, session-wise attendance, and the regular-folk list
              without changing the public kiosk flow.
            </p>
          </div>
          <div className="card cardPad">
            <div className="metaGrid">
              <div className="metaCard">
                <div className="metaLabel">Route</div>
                <div className="metaValue">/{config.slug}/admin</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Public route</div>
                <div className="metaValue">/{config.slug}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="section">
          <AdminDashboard
            locationSlug={config.slug}
            locationName={config.name}
            subtitle={config.subtitle}
            accent={config.accent}
          />
        </div>
      </div>
    </main>
  );
}
