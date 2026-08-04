import { getLocationConfig } from "@/lib/locations";

function getEnvAdminCode(slug: string) {
  const normalized = slug.trim().toUpperCase();
  return process.env[`ADMIN_ACCESS_CODE_${normalized}`]?.trim() || "";
}

export function isValidAdminCode(code: string, locationSlug: string) {
  const config = getLocationConfig(locationSlug);
  if (!config) {
    return false;
  }

  const typed = code.trim();
  const envCode = getEnvAdminCode(config.slug);
  return typed === config.adminCode || (envCode ? typed === envCode : false);
}
