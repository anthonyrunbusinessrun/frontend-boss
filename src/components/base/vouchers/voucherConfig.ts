/**
 * Letterhead printed on the voucher (Bill of Lading). Taken from the Voucher reference screenshot.
 * Change these values to change the printed header; nothing else depends on them.
 */
export const VOUCHER_LETTERHEAD = {
  company: "Land Logistics",
  tagline: "Inspired Solutions in a World of Challenges.",
  address: ["Post Office Box 214", "Branford, Florida 32008", "+1 (202) 875-2320"],
  prefix: "LLG-BL-",
  /** Voucher number = prefix + (autonumber I + offset). The screenshot shows I 11578 -> LLG-BL-15578. */
  numberOffset: 4000,
};

export const voucherNumber = (i: unknown) => (typeof i === "number" ? `${VOUCHER_LETTERHEAD.prefix}${i + VOUCHER_LETTERHEAD.numberOffset}` : "");
