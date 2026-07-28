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
        <header className="pageHeader">
          <div className="brandMark">
            <span className="brandDot" />
            {config.name}
          </div>
          <div className="subtle">Public attendance page</div>
        </header>

        <section className="hero" style={{ gridTemplateColumns: "1.25fr 0.9fr" }}>
          <div className="card cardPad">
            <div className="eyebrow" style={{ color: config.accent }}>
              {config.subtitle}
            </div>
            <h1 className="title">{config.name}</h1>
            <p className="lead">{config.description}</p>
            <div className="heroActions">
              <a className="buttonSecondary" href={`/${config.slug}/admin`}>
                Open admin dashboard
              </a>
            </div>
          </div>

          <div className="card cardPad">
            <div className="metaGrid">
              <div className="metaCard">
                <div className="metaLabel">Route</div>
                <div className="metaValue">/{config.slug}</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Storage</div>
                <div className="metaValue">MongoDB</div>
              </div>
            </div>
          </div>
        </section>

        <div className="section">
          <AttendanceKiosk
            locationSlug={config.slug}
            locationName={config.name}
            subtitle={config.subtitle}
            accent={config.accent}
            accentSoft={config.accentSoft}
          />
        </div>
      </div>
    </main>
  );
}
