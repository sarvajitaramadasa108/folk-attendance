import Link from "next/link";
import { getLocationSlugs, locations } from "@/lib/locations";

export default function HomePage() {
  const slugs = getLocationSlugs();

  return (
    <main className="shell">
      <div className="container">
        <header className="pageHeader">
          <div className="brandMark">
            <span className="brandDot" />
            Folk Attendance
          </div>
          <div className="subtle">Location-aware kiosk + admin dashboards</div>
        </header>

        <section className="hero">
          <div className="card cardPad">
            <div className="eyebrow">GitHub repo ready</div>
            <h1 className="title">One codebase, many locations.</h1>
            <p className="lead">
              Each location gets its own public attendance page and admin workspace.
              The MVP route is ready first, and the data model is built so we can add
              ANITS and future locations without duplicating the application.
            </p>
            <div className="heroActions">
              <Link className="button" href="/mvp">
                Open MVP kiosk
              </Link>
              <Link className="buttonSecondary" href="/mvp/admin">
                Open MVP admin
              </Link>
            </div>
          </div>

          <div className="card cardPad">
            <div className="metaGrid">
              <div className="metaCard">
                <div className="metaLabel">Locations</div>
                <div className="metaValue">{slugs.length}</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Current routes</div>
                <div className="metaValue">/mvp, /anits</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Storage</div>
                <div className="metaValue">MongoDB</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="sectionHeader">
            <div>
              <h2 className="sectionTitle">Available locations</h2>
              <p className="sectionNote">Each location can have its own branding, data, and attendance history.</p>
            </div>
          </div>

          <div className="gridCards">
            {Object.values(locations).map((location) => (
              <Link href={`/${location.slug}`} key={location.slug} className="statCard">
                <div className="statLabel">{location.subtitle}</div>
                <div className="statValue">{location.name}</div>
                <div className="statHint">{location.description}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
