const CP1252_CODEPOINT_TO_BYTE: Record<number, number> = {
  0x20AC: 0x80,
  0x201A: 0x82,
  0x0192: 0x83,
  0x201E: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02C6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8A,
  0x2039: 0x8B,
  0x0152: 0x8C,
  0x017D: 0x8E,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201C: 0x93,
  0x201D: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02DC: 0x98,
  0x2122: 0x99,
  0x0161: 0x9A,
  0x203A: 0x9B,
  0x0153: 0x9C,
  0x017E: 0x9E,
  0x0178: 0x9F
};

const MOJIBAKE_MARKER_PATTERN =
  /(?:Ã|Ä[\u0080-\u009f\u2018-\u201d]|Æ|á[º»]|à[º»]|Â[\u0080-\u00bf]|â[\u0080-\u009f\u201a-\u201e\u20ac]|\uFFFD)/g;

export function repairEmailText(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!looksLikeUtf8Mojibake(value)) return value;

  const repaired = decodeWindows1252Mojibake(value);
  return shouldUseRepairedText(value, repaired) ? repaired : value;
}

export function repairMailboxAddressName(value: string | null | undefined): string | null {
  return repairEmailText(value);
}

function looksLikeUtf8Mojibake(value: string) {
  return mojibakeScore(value) > 0;
}

function shouldUseRepairedText(original: string, repaired: string) {
  const originalScore = mojibakeScore(original);
  const repairedScore = mojibakeScore(repaired);
  const originalReplacementCount = countReplacementChars(original);
  const repairedReplacementCount = countReplacementChars(repaired);

  return repairedScore < originalScore && repairedReplacementCount <= originalReplacementCount + 1;
}

function mojibakeScore(value: string) {
  return Array.from(value.matchAll(MOJIBAKE_MARKER_PATTERN)).length;
}

function countReplacementChars(value: string) {
  return (value.match(/\uFFFD/g) ?? []).length;
}

function decodeWindows1252Mojibake(value: string) {
  const chunks: Buffer[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    const mappedByte = CP1252_CODEPOINT_TO_BYTE[codePoint];

    if (mappedByte !== undefined) {
      chunks.push(Buffer.from([mappedByte]));
    } else if (codePoint <= 0xff) {
      chunks.push(Buffer.from([codePoint]));
    } else {
      // Preserve already-correct Unicode segments in mixed strings.
      chunks.push(Buffer.from(char, "utf8"));
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}
