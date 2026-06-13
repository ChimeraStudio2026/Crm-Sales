/** Nomi canonici brand usati in CRM e import Excel. */
export const CANONICAL_CLIENT_BRAND_NAMES = {
  AIA: 'A.I.A. - S.P.A. UNIPERSONALE',
  AD_FA: 'AD.FA SRLS',
  CRAZY_PIZZA: 'Crazy pizza',
  CAPGEMINI: 'CAPGEMINI ITALIA S.P.A.',
  FSB: 'FSB Group',
  LUNGARNO: 'LUNGARNO ALBERGHI SRL',
  MB_PROJECTS: 'MB PROJECTS S.R.L.',
  TECHNOGYM: 'Technogym SPA',
} as const;

export function normalizeClientBrandLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9àèéìòù]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ClientBrandAliasRule {
  readonly canonicalName: string;
  readonly exactKeys: readonly string[];
  readonly prefixKeys?: readonly string[];
}

const CLIENT_BRAND_ALIAS_RULES: readonly ClientBrandAliasRule[] = [
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.AIA,
    exactKeys: [
      'a i a s p a unipersonale',
      'a i a s p a',
      'a i a',
      'aia spa unipersonale',
      'aia spa',
      'aia',
    ],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.AD_FA,
    exactKeys: ['click agency', 'ad fa srls', 'ad fa'],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.CRAZY_PIZZA,
    exactKeys: ['crazy pizza'],
    prefixKeys: ['crazy pizza'],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.CAPGEMINI,
    exactKeys: [
      'customer experience italia spa',
      'capgemini italia s p a',
      'capgemini italia spa',
    ],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.FSB,
    exactKeys: ['fasten seat belt s r l', 'fsb group'],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.LUNGARNO,
    exactKeys: ['lungarno albe', 'lungarno alberghi srl'],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.MB_PROJECTS,
    exactKeys: ['manuel bogliolo s r l', 'mb projects s r l'],
  },
  {
    canonicalName: CANONICAL_CLIENT_BRAND_NAMES.TECHNOGYM,
    exactKeys: ['technogym s p a', 'technogym spa'],
  },
];

const EXACT_CLIENT_BRAND_ALIASES = CLIENT_BRAND_ALIAS_RULES.reduce<Record<string, string>>(
  (acc, rule) => {
    rule.exactKeys.forEach((key) => {
      acc[key] = rule.canonicalName;
    });
    return acc;
  },
  {},
);

const PREFIX_CLIENT_BRAND_RULES = CLIENT_BRAND_ALIAS_RULES.flatMap((rule) => (
  (rule.prefixKeys ?? []).map((prefixKey) => ({
    prefixKey,
    canonicalName: rule.canonicalName,
  }))
));

/**
 * Risolve il nome brand canonico per import OKR / clienti da Excel.
 * Se non c'è alias, restituisce il nome ripulito (trim + spazi multipli).
 */
export function resolveCanonicalClientBrandName(rawName: string): string {
  const cleanedName = rawName.trim().replace(/\s+/g, ' ');
  if (!cleanedName) return cleanedName;
  const lookupKey = normalizeClientBrandLookupKey(cleanedName);
  const exactMatch = EXACT_CLIENT_BRAND_ALIASES[lookupKey];
  if (exactMatch) return exactMatch;
  const prefixMatch = PREFIX_CLIENT_BRAND_RULES.find((rule) => (
    lookupKey.startsWith(rule.prefixKey)
    || lookupKey.includes(` ${rule.prefixKey}`)
  ));
  if (prefixMatch) return prefixMatch.canonicalName;
  return cleanedName;
}

export function isKnownCanonicalClientBrandName(name: string): boolean {
  return Object.values(CANONICAL_CLIENT_BRAND_NAMES).some(
    (canonicalName) => canonicalName.toLowerCase() === name.trim().toLowerCase(),
  );
}
