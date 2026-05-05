/**
 * Vietnamese string helpers used across customer code generation, search
 * normalisation, and document rendering.
 */

/**
 * Remove Vietnamese diacritics (and special characters like đ/Đ) from a
 * string, returning the plain-ASCII equivalent. Case is preserved.
 */
export function removeDiacritics(input: string): string {
  if (!input) return "";

  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Produce a slug-like lowercase representation of a Vietnamese string:
 * diacritics stripped, spaces/punctuation replaced with dashes, collapsed
 * consecutive dashes removed.
 */
export function slugifyVN(input: string): string {
  return removeDiacritics(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a 3-letter uppercase code from a customer name, suitable for the
 * prefix portion of a customer code (e.g. "Vinamilk" -> "VNM", "Coca-Cola"
 * -> "COC", "AHSO" -> "AHS"). Falls back to "XXX" when the input has no
 * alphabetic characters.
 */
export function buildCustomerCodePrefix(name: string): string {
  const letters = removeDiacritics(name ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (letters.length === 0) return "XXX";
  if (letters.length < 3) return letters.padEnd(3, "X");

  // Heuristic: prefer first letter of each word (up to 3), else first 3 chars.
  const words = removeDiacritics(name)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((w) => w.length > 0);

  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join("");
  }

  if (words.length === 2) {
    // "Coca Cola" -> "COC" (first word 3, not first letters) still readable.
    // "Th An" -> "THA". "Vina Milk" -> "VMK" looks strange, but "Vinamilk"
    // (single word) already takes the happy path below.
    const [a, b] = words;
    if (a.length >= 2) {
      return (a.slice(0, 2) + b[0]).slice(0, 3);
    }
    return (a + b).slice(0, 3).padEnd(3, "X");
  }

  // Single word: take first 3 consonant-preferring letters. Simple approach
  // — first letter + next two letters (vowels allowed) mirrors "Vinamilk"
  // -> "VIN"; pick "VNM" style by skipping duplicate vowels instead.
  const single = words[0];
  const picked: string[] = [single[0]];
  for (let i = 1; i < single.length && picked.length < 3; i += 1) {
    const ch = single[i];
    // skip a second vowel right after the first (mostly improves acronyms)
    if (picked.length === 1 && "AEIOU".includes(ch) && "AEIOU".includes(picked[0])) continue;
    picked.push(ch);
  }
  return picked.join("").padEnd(3, "X").slice(0, 3);
}
