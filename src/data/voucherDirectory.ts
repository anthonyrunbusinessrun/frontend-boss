/**
 * Reference text printed on the voucher document that is not a column of the Vouchers table. Everything here was read
 * from the sample voucher PDFs (1.pdf … 99.pdf). A voucher can override any of it with its own fields
 * (Vendor Account, Operated By, Consignee, Ship To, Deliver Via Phone, Terms of Trade): the document always prefers
 * what is on the row.
 */

/** Name and address lines for a code that appears in the Issued or Perform column. */
export const VOUCHER_PARTIES: Record<string, string[]> = {
  "FEMA-HQ": ["Federal Emergency Management Agency", "500 C Street SW", "Washington, DC 20472"],
  LLG: ["Land Logistics", "304 SW Suwannee Avenue", "Branford, Florida 32008", "(202) 875-2320"],
  QUOTE: ["Please Provide Quotations", "to Action@RayLand.com", "Thank you in advance, -Action Team"],
  "DC-GRC": ["FEMA DC Greencastle", "12316 Molly Pitcher Hwy", "Greencastle, PA 17225", "(301) 874-4200"],
  "DC-ATL": ["FEMA DC Atlanta", "3780 South Side Industrial Ct", "Atlanta, GA 30354", "(404) 279-6380"],
  "DC-TRC": ["FEMA DC Tracy", "1547 E Grant Line Rd", "Tracy, CA 95304", "(209) 836-7601"],
  "DC-PRC": ["FEMA DC Puerto Rico", "San Juan Industrial Park FEMA", "PR-1, KM 25.1", "Caguas, PR 725", "(787) 413-1926"],
};

/** A carrier, found by the code in the Via column. */
export interface VoucherCarrier {
  name: string;
  phone?: string;
  /** printed only on forms that show it in the samples (FD, FT) */
  phone2?: string;
}

export const VOUCHER_CARRIERS: Record<string, VoucherCarrier> = {
  SAIA: { name: "SAIA LTL Freight", phone: "(609) 807-9228", phone2: "800-456-7296" },
  TQL: { name: "Total Quality Logistics", phone: "(513) 831-2600" },
};

/** Forms whose samples print the carrier's second phone number. */
export const FORMS_WITH_SECOND_PHONE = ["FD", "FT"];

/** Printed when a Freight RFQ has no carrier yet (as in sample 5.pdf). */
export const FQ_NO_VIA_LINES = ["VIA FREE ENTRY", "VIA FREE ENTRY", "VIA FREE ENTRY"];

const TERMS_FREIGHT = [
  "Carrier accepts full responsibility for claim, loss, or",
  "damage occurring during transport. All applicable",
  "DOT regulations must be observed throughout the",
  "duration of haul. Hours of Service limitations must",
  "be communicated to shipper prior to or at time of",
  "dispatch. Failure to deliver the listed quantity,",
  "weight, or configuration may result in rate",
  "adjustment or claim deduction. Signed Proof of",
  "Delivery is required for freight payment.",
];

/** The wording of each form: what it says at the top, how its two parties are called, its marks and its terms. */
export interface VoucherFormStyle {
  /** small line above the dark bar */
  topTitle: string;
  leftLabel: string;
  rightLabel: string;
  /** "L" or "R": the letter in the outlined mark above the form code */
  mark: "L" | "R";
  terms: string[];
}

export const VOUCHER_FORMS: Record<string, VoucherFormStyle> = {
  FD: { topTitle: "Freight Delivery Confirmation", leftLabel: "VENDOR ACCOUNT", rightLabel: "OPERATED BY", mark: "L", terms: TERMS_FREIGHT },
  FT: { topTitle: "Freight Movement In Transit", leftLabel: "CONTRACTED TO", rightLabel: "OPERATED BY", mark: "L", terms: TERMS_FREIGHT },
  BL: {
    topTitle: "Original | Non Negotiable",
    leftLabel: "CONSIGNEE",
    rightLabel: "SHIP TO",
    mark: "R",
    terms: [
      "Shipment is tendered in accordance with applicable",
      "regulations and contract requirements. All goods are",
      "shipped F.O.B. Origin. Title and risk of loss transfer",
      "to consignee upon carrier pickup.",
      "",
      "Carrier is responsible for all claim, loss, or damage",
      "occurring in transit. Claims must be filed within 9",
      "months of delivery date per 49 U.S.C. § 14706.",
      "",
      "Delivery must be made within the scheduled",
      "window. Receiver must be notified a minimum of 24",
      "hours prior to arrival. Failure to notify may result in",
      "refusal of delivery; carrier bears all resulting costs.",
    ],
  },
  FQ: {
    topTitle: "Request for Quote & Availability",
    leftLabel: "QUOTE FROM",
    rightLabel: "OPERATED BY",
    mark: "L",
    terms: [
      "This document is provided for informational and",
      "quoting purposes only. It does not constitute a",
      "binding order or commitment. Prices and availability",
      "are subject to change without notice.",
      "",
      "To confirm, a formal Purchase Order or Sales Order",
      "must be issued by the requesting party.",
    ],
  },
  IN: {
    topTitle: "Request for Payment",
    leftLabel: "BILL TO",
    rightLabel: "SHIPPED TO",
    mark: "R",
    terms: [
      "Payment is due within 30 days of invoice date",
      "unless otherwise agreed in writing. Past due",
      "balances are subject to a finance charge of 1.5% per",
      "month (18% annually).",
      "",
      "Disputes must be submitted in writing within 10",
      "days of invoice receipt. Undisputed balances remain",
      "due and payable regardless of any pending dispute.",
      "",
      "Buyer agrees to pay all costs of collection, including",
      "reasonable attorney's fees, in the event this account",
      "is placed for collection.",
    ],
  },
};

/** A Form with no entry above (one added later in the Form dropdown) is labelled with the table's own column names. */
export const UNKNOWN_FORM: VoucherFormStyle = { topTitle: "", leftLabel: "ISSUED", rightLabel: "PERFORM", mark: "L", terms: [] };

/** Status pill colors, as in the samples. Any other status gets the neutral gray one. */
export const VOUCHER_STATUS_STYLES: Record<string, { fill: string; color: string }> = {
  Issued: { fill: "#616670", color: "#ffffff" },
  Planned: { fill: "#88dbff", color: "#0b3552" },
  BOOKED: { fill: "#c4ecff", color: "#0b3552" },
};
export const NEUTRAL_STATUS_STYLE = { fill: "#616670", color: "#ffffff" };
