const FALLBACK_ADMIN_CODE = "MVP@2026";

export function getAllowedAdminCodes() {
  const codes = new Set<string>();
  const envCode = process.env.ADMIN_ACCESS_CODE?.trim();

  if (envCode) {
    codes.add(envCode);
  }

  codes.add(FALLBACK_ADMIN_CODE);
  return codes;
}

export function isValidAdminCode(code: string) {
  return getAllowedAdminCodes().has(code.trim());
}
