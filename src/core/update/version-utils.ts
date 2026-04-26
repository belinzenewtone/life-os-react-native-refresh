function parseVersion(version: string) {
  return version.split('.').map((part) => Number(part.replace(/[^\d].*$/, '')) || 0);
}

export function compareVersions(current: string, target: string) {
  const left = parseVersion(current);
  const right = parseVersion(target);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}
