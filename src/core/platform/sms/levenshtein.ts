export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const lenA = a.length;
  const lenB = b.length;
  const prev = new Array<number>(lenA + 1);
  const curr = new Array<number>(lenA + 1);

  for (let i = 0; i <= lenA; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= lenB; j++) {
    curr[0] = j;
    for (let i = 1; i <= lenA; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + cost,
      );
    }
    for (let i = 0; i <= lenA; i++) {
      prev[i] = curr[i];
    }
  }

  return prev[lenA];
}