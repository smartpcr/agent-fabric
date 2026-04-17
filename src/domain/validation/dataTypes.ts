export type DataTypeWhitelist = Readonly<Record<string, readonly string[]>>;

export function isAssignable(
  sourceType: string,
  targetType: string,
  whitelist?: DataTypeWhitelist,
): boolean {
  if (targetType === "any" || sourceType === "any") {
    return true;
  }

  if (sourceType === targetType) {
    return true;
  }

  if (whitelist) {
    const allowed = whitelist[sourceType];
    if (allowed && allowed.includes(targetType)) {
      return true;
    }
  }

  return false;
}
