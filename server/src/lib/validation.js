import { z } from "zod";

/**
 * Shared field validators.
 *
 * These lived inline in each router, which is how the same field ended up with
 * three different rules: a phone number was `min(8)` in one place, unconstrained
 * in another, and capped at 20 characters in a third — so "abcdefgh" was a
 * valid mobile number depending on which endpoint you asked. Defining each
 * field once means a rule can be tightened in one place and cannot drift.
 *
 * Everything here validates *and* normalises, because storing " Ravi  " and
 * "ravi" as different people is a data problem that starts as a validation
 * problem.
 */

const digitsOnly = (s) => s.replace(/\D/g, "");

/**
 * Makes a field optional and treats an empty string as "not provided" — which
 * is what a cleared form field means.
 *
 * The obvious spelling, `schema.optional().or(z.literal(""))`, builds a union,
 * and when a union fails zod reports its own "Invalid input" instead of the
 * message from the branch that nearly matched. Someone typing letters into a
 * phone box was being told "Invalid input" rather than "A phone number can
 * only contain digits". Normalising before validation keeps one branch, and
 * therefore keeps the real message.
 */
export const blankable = (schema) =>
  z.preprocess(
    // null, not undefined. Undefined means "the client did not mention this
    // field", which a partial update must leave alone; an empty string means
    // "I deleted what was here", which has to reach the database as null.
    // Collapsing both to undefined makes a cleared field silently un-clearable.
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    schema.nullable().optional()
  );

/**
 * An Indian mobile number, tolerant about how it is typed and strict about
 * what it is. "+91 98250 11001", "098250-11001" and "9825011001" are all the
 * same number; "call me" is not a number at all.
 *
 * Stored normalised so two spellings of one number cannot become two contacts.
 */
export const phone = z
  .string()
  .trim()
  .refine((v) => /^\+?[\d\s()-]+$/.test(v), "A phone number can only contain digits")
  .refine((v) => {
    const d = digitsOnly(v);
    return d.length >= 10 && d.length <= 15;
  }, "Enter a valid phone number with 10 to 15 digits")
  .transform((v) => {
    const d = digitsOnly(v);
    // Keep a country code if one was given; otherwise assume India, since the
    // organisation, its fuel prices and its currency are all Indian.
    if (v.trim().startsWith("+")) return `+${d}`;
    if (d.length === 10) return `+91${d}`;
    if (d.length === 11 && d.startsWith("0")) return `+91${d.slice(1)}`;
    return `+${d}`;
  });

/** A person's name. Letters, and the punctuation that appears inside real names. */
export const personName = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60, "Name is too long")
  .refine(
    (v) => /^[\p{L}][\p{L}\s.'-]*$/u.test(v),
    "A name cannot contain numbers or symbols"
  )
  // Collapse runs of whitespace so "Ravi   Kumar" and "Ravi Kumar" are one name.
  .transform((v) => v.replace(/\s+/g, " "));

/**
 * An email address.
 *
 * Lower-cased because addresses are case-insensitive in practice, and the user
 * table has a unique index on this column — without normalising,
 * "Ravi@acme.com" and "ravi@acme.com" are two accounts for one person.
 */
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(120, "Email is too long")
  // zod's own check accepts "a@b"; a work address always has a dotted domain.
  .refine((v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v), "Enter a valid email address");

/** An Indian number plate: letters and digits, no punctuation beyond spacing. */
export const registrationNumber = z
  .string()
  .trim()
  .min(4, "Registration number is too short")
  .max(15, "Registration number is too long")
  .refine(
    (v) => /^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(v),
    "A registration number can only contain letters and numbers"
  )
  // Uppercased and stripped so "gj18ab4471" and "GJ 18 AB 4471" collide on the
  // unique index instead of registering the same car twice.
  .transform((v) => v.replace(/[\s-]/g, "").toUpperCase());

/** Free text that must actually contain something. */
export const text = (max, label = "This field") =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Optional free text, where an empty string means "clear it". */
export const optionalText = (max) =>
  z.string().trim().max(max, "This value is too long").optional();

export const latitude = z
  .number()
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

export const longitude = z
  .number()
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

/**
 * A map point.
 *
 * The bounds matter: latitude and longitude were previously plain numbers, so a
 * ride could be published at 9999,9999. That is not a hypothetical — the
 * routing service is asked for a path between these, and the fare and distance
 * shown to everyone are derived from whatever comes back.
 */
export const point = z.object({
  label: text(200, "Location"),
  lat: latitude,
  lng: longitude,
});

/**
 * An amount of money. Bounded at both ends and limited to paise, so a fare
 * cannot be 1e21 and cannot carry six decimal places into a Decimal(10,2)
 * column that will silently round it.
 */
export const money = (max, label = "Amount") =>
  z
    .number()
    .finite(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} cannot exceed ${max}`)
    .refine((v) => Number.isInteger(Math.round(v * 100)) && v * 100 - Math.trunc(v * 100) < 1e-9,
      `${label} cannot have more than two decimal places`);

/** A date-time that a human actually chose. */
export const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date and time")
  .refine((v) => {
    const year = new Date(v).getFullYear();
    return year >= 2000 && year <= 2100;
  }, "That date is out of range");
