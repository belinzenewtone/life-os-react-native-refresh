export function buildDedupeKeys(input: {
  mpesaCode: string | null;
  sourceHash: string | null;
  semanticHash: string | null;
}) {
  return [input.mpesaCode, input.sourceHash, input.semanticHash].filter(Boolean) as string[];
}

export function isDuplicate(existingKeys: Set<string>, keys: string[]) {
  return keys.some((key) => existingKeys.has(key));
}