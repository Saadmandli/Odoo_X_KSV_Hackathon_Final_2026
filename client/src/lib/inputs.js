/**
 * Input filters, matching the server's validators.
 *
 * These do not replace the server checks — a browser can be bypassed, so the
 * API stays the authority. What they do is stop the mistake happening at all:
 * being told "a phone number can only contain digits" after pressing Save is a
 * worse experience than the letter never appearing in the box.
 *
 * Each filter is deliberately permissive about *formatting* and strict about
 * *characters*, so someone can still type "+91 98250 11002" the way they
 * would write it down.
 */

/** Digits plus the punctuation people write phone numbers with. */
export const filterPhone = (value) => value.replace(/[^\d+\s()-]/g, "").slice(0, 20);

/** Letters and the punctuation that appears inside real names. No digits. */
export const filterName = (value) => value.replace(/[^\p{L}\s.'-]/gu, "").slice(0, 60);

/** A number plate: letters and digits only, upper-cased as it is typed. */
export const filterRegistration = (value) =>
  value.replace(/[^a-zA-Z0-9\s-]/g, "").toUpperCase().slice(0, 15);

/**
 * A money amount as a string, for a text input.
 *
 * Kept as a string rather than coerced to a number on every keystroke, because
 * coercing mid-typing turns "10." into 10 and fights the person entering
 * "10.50". Empty stays empty so the field can be cleared.
 */
export const filterAmount = (value) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  // One decimal point, at most two digits after it.
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole.slice(0, 7);
  return `${whole.slice(0, 7)}.${rest.join("").slice(0, 2)}`;
};

/** Whole numbers only, for seat counts and similar. */
export const filterInteger = (value) => value.replace(/\D/g, "").slice(0, 3);

/**
 * Mirrors the server's email rule closely enough to catch the common mistakes
 * before a round trip. Anything subtler is the server's business.
 */
export const isValidEmail = (value) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value.trim());

/** True when a phone number has a plausible number of digits. */
export const isValidPhone = (value) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};
