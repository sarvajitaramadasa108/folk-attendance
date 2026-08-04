export type LocationConfig = {
  slug: string;
  name: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  description: string;
  adminCode: string;
};

export const locations: Record<string, LocationConfig> = {
  mvp: {
    slug: "mvp",
    name: "Folk MVP",
    subtitle: "Primary launch location",
    accent: "#8be9a8",
    accentSoft: "rgba(139, 233, 168, 0.15)",
    description:
      "Attendance kiosk and admin dashboard for the MVP location, built to mirror the existing spreadsheet workflow.",
    adminCode: "MVP@2026"
  },
  anits: {
    slug: "anits",
    name: "ANITS",
    subtitle: "Second location",
    accent: "#7ec8ff",
    accentSoft: "rgba(126, 200, 255, 0.15)",
    description:
      "Location-specific attendance space ready for the same flow once data is connected.",
    adminCode: "ANITS@2026"
  }
};

export function getLocationConfig(slug: string) {
  return locations[slug.toLowerCase()] ?? null;
}

export function getLocationSlugs() {
  return Object.keys(locations);
}
