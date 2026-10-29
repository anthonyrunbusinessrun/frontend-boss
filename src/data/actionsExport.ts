/**
 * The Actions table, from the CSV export "Actions-OPEN ACTIONS - HOT QA NEXT.csv" (158 actions, in the export's order).
 * Columns: Code, Wk, Accrue, Status, Task Title, Type, Folio, Asn, QA, Sort. Regenerate with scripts/actions-csv-to-seed.py.
 * QA is empty in the export, so it is not listed.
 */
export type ActionSeed = {
  id: string;
  code: string;
  /** week such as "26.28", or "Action" for undated actions */
  wk: string;
  /** ISO date, "" when undated */
  accrue: string;
  status: string;
  title: string;
  type: string;
  folio: string;
  /** team contact codes (Profiles → Contact) */
  asn: string[];
  sort: number | null;
};

export const ACTION_EXPORT: ActionSeed[] = [
 {
  "id": "A-4695",
  "code": "A-4695",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Untitled Action",
  "type": "",
  "folio": "",
  "asn": [],
  "sort": null
 },
 {
  "id": "A-4744",
  "code": "A-4744",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Untitled Action",
  "type": "",
  "folio": "",
  "asn": [],
  "sort": null
 },
 {
  "id": "A-4768",
  "code": "A-4768",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "NEw NEw",
  "type": "",
  "folio": "Eva June Hicks",
  "asn": [],
  "sort": 1
 },
 {
  "id": "A-4769",
  "code": "A-4769",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "NEw",
  "type": "",
  "folio": "Eva June Hicks",
  "asn": [],
  "sort": 2
 },
 {
  "id": "A-4770",
  "code": "A-4770",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [],
  "sort": null
 },
 {
  "id": "A-4647",
  "code": "A-4647",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "Check Weekly - Action Hotline Quality",
  "type": "Tasking",
  "folio": "",
  "asn": [
   "AES"
  ],
  "sort": 2
 },
 {
  "id": "A-4666",
  "code": "A-4666",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "⛔ Rebook Baby Bottles as Supplies — Clear IATA Restriction · Try Airshot",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4667",
  "code": "A-4667",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "👶 Follow Up Unicare — Baby Wipes Pricing Negotiation · Escalate if No Response EOD",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4696",
  "code": "A-4696",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Set a Virtual Webinar Meeting with FEMA",
  "type": "Notice",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4738",
  "code": "A-4738",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Create Narrative Report for MREs (Bacolod)",
  "type": "Movement",
  "folio": "phPantry.com",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4754",
  "code": "A-4754",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Review Top Notch Freight Forwarder Quotation",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4759",
  "code": "A-4759",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "Comply documents to Top Notch (in coordination with Ej)",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4767",
  "code": "A-4767",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "Create Importer, Manufacturer and Product Information to be submitted to Top Notch for HI/POD customs review",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4542",
  "code": "A-4542",
  "wk": "26.28",
  "accrue": "2026-07-06",
  "status": "Queue",
  "title": "Monday Management Meeting",
  "type": "Notice",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "AES"
  ],
  "sort": 4
 },
 {
  "id": "A-4544",
  "code": "A-4544",
  "wk": "26.28",
  "accrue": "2026-07-06",
  "status": "Queue",
  "title": "Monday Management Meeting",
  "type": "Notice",
  "folio": "",
  "asn": [
   "AES"
  ],
  "sort": 5
 },
 {
  "id": "A-4546",
  "code": "A-4546",
  "wk": "26.29",
  "accrue": "2026-07-13",
  "status": "Queue",
  "title": "Monday Management Meeting",
  "type": "Notice",
  "folio": "/// Action Assistance Team",
  "asn": [
   "AES"
  ],
  "sort": 6
 },
 {
  "id": "A-4555",
  "code": "A-4555",
  "wk": "26.30",
  "accrue": "2026-07-20",
  "status": "Queue",
  "title": "Monday Management Meeting",
  "type": "Notice",
  "folio": "/// Action Assistance Team",
  "asn": [
   "AES"
  ],
  "sort": 7
 },
 {
  "id": "A-4611",
  "code": "A-4611",
  "wk": "26.31",
  "accrue": "2026-07-27",
  "status": "Ongoing",
  "title": "Create a Directory",
  "type": "Tasking",
  "folio": "/// Action Assistance Team",
  "asn": [
   "AES"
  ],
  "sort": 9
 },
 {
  "id": "A-4556",
  "code": "A-4556",
  "wk": "26.31",
  "accrue": "2026-07-27",
  "status": "Queue",
  "title": "Monday Management Meeting",
  "type": "Notice",
  "folio": "/// Action Assistance Team",
  "asn": [
   "AES"
  ],
  "sort": 8
 },
 {
  "id": "A-4672",
  "code": "A-4672",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🎥 Camera Rental Manila — Sony FX3 for Bacolod Shoot · AES Transport Iloilo · Return After",
  "type": "Tasking",
  "folio": "BOSS System",
  "asn": [
   "JAD",
   "AES"
  ],
  "sort": null
 },
 {
  "id": "A-4670",
  "code": "A-4670",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "✈️ Bacolod Trip — Go/No-Go Pending Pastor Confirmation · Target Jul 15–16",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "AES",
   "SML"
  ],
  "sort": null
 },
 {
  "id": "A-3888",
  "code": "A-3888",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "Sell Peterbuilt 379 Tow Truck in Louisiana",
  "type": "Outcome",
  "folio": "Asset Liquidation",
  "asn": [
   "BEM"
  ],
  "sort": 1
 },
 {
  "id": "A-3913",
  "code": "A-3913",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "Equipment - Buses and Sales of Equipment",
  "type": "Outcome",
  "folio": "Asset Liquidation",
  "asn": [
   "BEM"
  ],
  "sort": 2
 },
 {
  "id": "A-4574",
  "code": "A-4574",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Tiny House Manufacturing",
  "type": "Research",
  "folio": "Ideas & Opportunities",
  "asn": [
   "BEM"
  ],
  "sort": 3
 },
 {
  "id": "A-4610",
  "code": "A-4610",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Call Janet Berry (Louisiana Time)",
  "type": "Phone",
  "folio": "Asset Liquidation",
  "asn": [
   "BEM"
  ],
  "sort": 4
 },
 {
  "id": "A-4572",
  "code": "A-4572",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "🐶 Coco and Puff",
  "type": "Research",
  "folio": "Raymon J. Land III",
  "asn": [
   "BEM"
  ],
  "sort": 5
 },
 {
  "id": "A-4553",
  "code": "A-4553",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Source File Box / Storage Box",
  "type": "Sourcing",
  "folio": "ILOL: International Corporate Plaza",
  "asn": [
   "BEM"
  ],
  "sort": 6
 },
 {
  "id": "A-4742",
  "code": "A-4742",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Review",
  "title": "Call Eastern Logistics for Pickup and Delivery",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4743",
  "code": "A-4743",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Review",
  "title": "Schedule Eastern Logistics Pickup and Delivery",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4745",
  "code": "A-4745",
  "wk": "26.28",
  "accrue": "2026-07-10",
  "status": "Review",
  "title": "Call SAIA LTL for Pickup and Delivery",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4746",
  "code": "A-4746",
  "wk": "26.28",
  "accrue": "2026-07-10",
  "status": "Review",
  "title": "Schedule SAIA LTL for Pickup and Delivery",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4747",
  "code": "A-4747",
  "wk": "26.30",
  "accrue": "2026-07-24",
  "status": "NOW",
  "title": "Source FTL Freight thru Calls/Emails",
  "type": "Sourcing",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4749",
  "code": "A-4749",
  "wk": "26.31",
  "accrue": "2026-07-27",
  "status": "NOW",
  "title": "Schedule TQL for Pickup and Delivery",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4756",
  "code": "A-4756",
  "wk": "26.31",
  "accrue": "2026-07-27",
  "status": "NOW",
  "title": "Created Bill of Lading for the Shipment",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "BEM"
  ],
  "sort": null
 },
 {
  "id": "A-4512",
  "code": "A-4512",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🏢 Megaworld Add All Payments to Allocations",
  "type": "Tasking",
  "folio": "ILOL: International Corporate Plaza",
  "asn": [
   "EJE"
  ],
  "sort": 1
 },
 {
  "id": "A-4509",
  "code": "A-4509",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🔗 Wise Payments",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 2
 },
 {
  "id": "A-4589",
  "code": "A-4589",
  "wk": "Action",
  "accrue": "",
  "status": "Problem",
  "title": "Set Up for Megaworld",
  "type": "Decision",
  "folio": "ILOL: International Corporate Plaza",
  "asn": [
   "EJE"
  ],
  "sort": 5
 },
 {
  "id": "A-4455",
  "code": "A-4455",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "📅 EJE — Monthly Reminder · Driver's License Status Check",
  "type": "Tasking",
  "folio": "/// Action Assistance Team",
  "asn": [
   "EJE"
  ],
  "sort": 20
 },
 {
  "id": "A-4456",
  "code": "A-4456",
  "wk": "Action",
  "accrue": "",
  "status": "Ongoing",
  "title": "📅 EJE — Monthly Reminder · Insurance Status Check",
  "type": "Tasking",
  "folio": "/// Action Assistance Team",
  "asn": [
   "EJE"
  ],
  "sort": 21
 },
 {
  "id": "A-4252",
  "code": "A-4252",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Better Employee Agreements",
  "type": "Legal",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 22
 },
 {
  "id": "A-4490",
  "code": "A-4490",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Renew Corporation 2026",
  "type": "Tasking",
  "folio": "Sol Caribeño Corporation",
  "asn": [
   "EJE"
  ],
  "sort": 23
 },
 {
  "id": "A-4491",
  "code": "A-4491",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Confirmed with LMF (Touchbase)",
  "type": "",
  "folio": "Transportation Dynamics Corp",
  "asn": [
   "EJE"
  ],
  "sort": 25
 },
 {
  "id": "A-4583",
  "code": "A-4583",
  "wk": "26.27",
  "accrue": "2026-06-29",
  "status": "Archive",
  "title": "Run the Proforma for BOSS",
  "type": "Movement",
  "folio": "BOSS System",
  "asn": [
   "EJE"
  ],
  "sort": 24
 },
 {
  "id": "A-4507",
  "code": "A-4507",
  "wk": "26.27",
  "accrue": "2026-07-01",
  "status": "Priority",
  "title": "📊 AIS — Add Allocations Table to Airtable Base",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 3
 },
 {
  "id": "A-4508",
  "code": "A-4508",
  "wk": "26.27",
  "accrue": "2026-07-01",
  "status": "Priority",
  "title": "💰 AIS — Catch Up Disbursements Table",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 4
 },
 {
  "id": "A-4562",
  "code": "A-4562",
  "wk": "26.28",
  "accrue": "2026-07-08",
  "status": "Review",
  "title": "Upload Pay Sheet on Wise (For Approval)",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 6
 },
 {
  "id": "A-4567",
  "code": "A-4567",
  "wk": "26.28",
  "accrue": "2026-07-08",
  "status": "Review",
  "title": "Accounting Day / Financial Day",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 7
 },
 {
  "id": "A-4665",
  "code": "A-4665",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Review",
  "title": "ASN's Delivery Timeframe to FEMA Updated / EJ Daily",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4563",
  "code": "A-4563",
  "wk": "26.29",
  "accrue": "2026-07-15",
  "status": "Review",
  "title": "Upload Pay Sheet on Wise (For Approval)",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 9
 },
 {
  "id": "A-4569",
  "code": "A-4569",
  "wk": "26.29",
  "accrue": "2026-07-15",
  "status": "Review",
  "title": "Accounting Day / Financial Day",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 10
 },
 {
  "id": "A-4669",
  "code": "A-4669",
  "wk": "26.29",
  "accrue": "2026-07-16",
  "status": "Review",
  "title": "📦 EJE Track Saya Freight Shipments — All OCONUS DCs · Report ASAP",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4751",
  "code": "A-4751",
  "wk": "26.30",
  "accrue": "2026-07-20",
  "status": "Review",
  "title": "Discuss MRE timeline in Bacolod, operational plans, budget adjustments, and reporting.",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4752",
  "code": "A-4752",
  "wk": "26.30",
  "accrue": "2026-07-20",
  "status": "Review",
  "title": "Schedule 3 Pallets Pick-Up at Somerset, NJ (Re: Emerald Warehouse)",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4668",
  "code": "A-4668",
  "wk": "26.30",
  "accrue": "2026-07-21",
  "status": "Review",
  "title": "📧 EJE Reply-All FEMA/Saya Thread — Introduce Self · Provide Status Update",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4753",
  "code": "A-4753",
  "wk": "26.30",
  "accrue": "2026-07-21",
  "status": "Review",
  "title": "Creat ASNs via LSMCS FEMA and submitted the partial delivery for 4 states. (Ref: Update // D1080660 – ASN A1242017) (with Josh)",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4564",
  "code": "A-4564",
  "wk": "26.30",
  "accrue": "2026-07-25",
  "status": "Scheduled",
  "title": "Upload Pay Sheet on Wise (For Approval)",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 12
 },
 {
  "id": "A-4570",
  "code": "A-4570",
  "wk": "26.30",
  "accrue": "2026-07-25",
  "status": "Scheduled",
  "title": "Accounting Day / Financial Day",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 13
 },
 {
  "id": "A-4571",
  "code": "A-4571",
  "wk": "26.31",
  "accrue": "2026-07-29",
  "status": "Scheduled",
  "title": "Accounting Day / Financial Day",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 16
 },
 {
  "id": "A-4565",
  "code": "A-4565",
  "wk": "26.31",
  "accrue": "2026-07-29",
  "status": "Scheduled",
  "title": "Upload Pay Sheet on Wise (For Approval)",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "EJE"
  ],
  "sort": 15
 },
 {
  "id": "A-4750",
  "code": "A-4750",
  "wk": "26.31",
  "accrue": "2026-07-29",
  "status": "NOW",
  "title": "TQL Shipment + Payment",
  "type": "Tasking",
  "folio": "/// Action Assistance Team",
  "asn": [
   "EJE"
  ],
  "sort": null
 },
 {
  "id": "A-4642",
  "code": "A-4642",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Josh to Train Ray on Jira Style and How To",
  "type": "Training",
  "folio": "",
  "asn": [
   "JAD"
  ],
  "sort": 1
 },
 {
  "id": "A-4721",
  "code": "A-4721",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Develop Frontend and backend development of Emergency Response App",
  "type": "Tasking",
  "folio": "BOSS System",
  "asn": [
   "JAD"
  ],
  "sort": null
 },
 {
  "id": "A-4724",
  "code": "A-4724",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Update PhPantry website with current materials (photos/clips)",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "JAD"
  ],
  "sort": null
 },
 {
  "id": "A-4760",
  "code": "A-4760",
  "wk": "26.32",
  "accrue": "2026-08-07",
  "status": "Queue",
  "title": "Week 32 - August 7, 2026 Update Presentation Deck",
  "type": "Updates",
  "folio": "BOSS System",
  "asn": [
   "JAD"
  ],
  "sort": null
 },
 {
  "id": "A-4762",
  "code": "A-4762",
  "wk": "26.32",
  "accrue": "2026-08-07",
  "status": "",
  "title": "Untitled Action",
  "type": "",
  "folio": "",
  "asn": [
   "JAD"
  ],
  "sort": null
 },
 {
  "id": "A-4240",
  "code": "A-4240",
  "wk": "26.35",
  "accrue": "2026-08-29",
  "status": "Queue",
  "title": "🎨 Land Brokerage Style Guide — JAD",
  "type": "Tasking",
  "folio": "LandBrokerageRealtor.com",
  "asn": [
   "JAD"
  ],
  "sort": 3
 },
 {
  "id": "A-4693",
  "code": "A-4693",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "PH Pantry Branding Guidelines",
  "type": "Tasking",
  "folio": "",
  "asn": [
   "JWO"
  ],
  "sort": null
 },
 {
  "id": "A-4694",
  "code": "A-4694",
  "wk": "26.35",
  "accrue": "2026-08-29",
  "status": "Queue",
  "title": "🎨 Land Brokerage Style Guide — JAD",
  "type": "Tasking",
  "folio": "LandBrokerageRealtor.com",
  "asn": [
   "JWO"
  ],
  "sort": 3
 },
 {
  "id": "A-4314",
  "code": "A-4314",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Confirmed Cancel Transportation Dynamics",
  "type": "Cancel",
  "folio": "Asset Liquidation",
  "asn": [
   "LMF"
  ],
  "sort": 1
 },
 {
  "id": "A-4434",
  "code": "A-4434",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "📞 Call Jae Moore — Schedule HR Zoom · jaemoore7689@gmail.com",
  "type": "Phone",
  "folio": "Recruiting & Onboarding",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4645",
  "code": "A-4645",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "BOSS Team Build an AirTable on the Top of Supabase / Postgres",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4644",
  "code": "A-4644",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4640",
  "code": "A-4640",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4525",
  "code": "A-4525",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "🏢 Garage Lease — Transfer to Kabir at Gables Park Tower",
  "type": "Tasking",
  "folio": "ASTX: 111 Sandra Muraida #100",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4519",
  "code": "A-4519",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "🔄 Action Assistance Program — Rebuild & Get Back Online · Integrate with TeamBase",
  "type": "Tasking",
  "folio": "/// Action Assistance Team",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4623",
  "code": "A-4623",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "BOSS Dev team WEEKLY pay rate offer",
  "type": "Tasking",
  "folio": "BOSS System",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4313",
  "code": "A-4313",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Call Hilary Reahl",
  "type": "Phone",
  "folio": "Communications",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4323",
  "code": "A-4323",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Call Janet Berry",
  "type": "Phone",
  "folio": "Asset Liquidation",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4639",
  "code": "A-4639",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Advanced Airtable Training",
  "type": "Training",
  "folio": "/// Action Assistance Team",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4248",
  "code": "A-4248",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "Visas for PH Staff to Visit USA",
  "type": "Research",
  "folio": "Immigration Plans",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4638",
  "code": "A-4638",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Train Andrea on eMail Communications",
  "type": "Training",
  "folio": "/// Action Assistance Team",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4201",
  "code": "A-4201",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Change All Passwords - 2026 Season",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4319",
  "code": "A-4319",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Sign Up for Land Logistics DBA Name",
  "type": "Legal",
  "folio": "/// Ray Land, Inc.",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4433",
  "code": "A-4433",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "🔥 Summer Kickoff Cookout — Pig Roast — Iloilo",
  "type": "Planning",
  "folio": "BOSS System",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4116",
  "code": "A-4116",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Return Train Room to Original",
  "type": "Maintenance",
  "folio": "BRFD: 304 Suwannee Ave",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4641",
  "code": "A-4641",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Staff Roles & Responsibilities in XMind",
  "type": "Tasking",
  "folio": "Recruiting & Onboarding",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4114",
  "code": "A-4114",
  "wk": "Action",
  "accrue": "",
  "status": "Snoozed",
  "title": "💤 Reminder of Snoozed",
  "type": "Planning",
  "folio": "Freshbright.com",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-3961",
  "code": "A-3961",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "💰 Extra $1299 — AMEX/Ultra Dispute",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4368",
  "code": "A-4368",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Group Zoom — Iloilo Developer Candidates",
  "type": "Conf Call",
  "folio": "Recruiting & Onboarding",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4172",
  "code": "A-4172",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Repair Truck Horn at GMC",
  "type": "Mech",
  "folio": "2022 GMC Sierra Duramax",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4198",
  "code": "A-4198",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "🚗 Priority Car General Direct — Auto Insurance Review",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4196",
  "code": "A-4196",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Organization at Branford Packing House",
  "type": "Tasking",
  "folio": "BRFD: 304 Suwannee Ave",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4149",
  "code": "A-4149",
  "wk": "Action",
  "accrue": "",
  "status": "Snoozed",
  "title": "💤 Reminder of Snoozed",
  "type": "Planning",
  "folio": "Latex Graphic Printing",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4141",
  "code": "A-4141",
  "wk": "Action",
  "accrue": "",
  "status": "Snoozed",
  "title": "💤 Reminder of Snoozed",
  "type": "Planning",
  "folio": "Little Fish Products",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4151",
  "code": "A-4151",
  "wk": "Action",
  "accrue": "",
  "status": "Snoozed",
  "title": "💤 Reminder of Snoozed",
  "type": "Planning",
  "folio": "El Cat Splash Rental",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4651",
  "code": "A-4651",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "----",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4662",
  "code": "A-4662",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Land Logistics - Web(U) XMind for for Training Manual",
  "type": "",
  "folio": "/// Action Assistance Team",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4663",
  "code": "A-4663",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Land Logistics - \"Making the Magic\" Series",
  "type": "",
  "folio": "/// Action Assistance Team",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4664",
  "code": "A-4664",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Bring BOSS Documents with Me to Phillipines",
  "type": "",
  "folio": "BOSS System",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4685",
  "code": "A-4685",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "------------",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4687",
  "code": "A-4687",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Pack 20’ Container in Branford",
  "type": "",
  "folio": "BRFD: 304 Suwannee Ave",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4688",
  "code": "A-4688",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Move the Camper Trailer / Sell / List?",
  "type": "",
  "folio": "BRFD: 304 Suwannee Ave",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4699",
  "code": "A-4699",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "=========",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4700",
  "code": "A-4700",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "Qonto Bank Account - Complete Setup",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4701",
  "code": "A-4701",
  "wk": "Action",
  "accrue": "",
  "status": "",
  "title": "=========",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4736",
  "code": "A-4736",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "July 31, 2026 Final Interview with the junior frontend developer - Alyana Geonanga",
  "type": "Tasking",
  "folio": "BOSS System",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4739",
  "code": "A-4739",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🚤 Pick Up Boat — Austin TX · Schedule Retrieval from Lady Bird Lake",
  "type": "Tasking",
  "folio": "El Cat Splash Rental",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4740",
  "code": "A-4740",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🚗 Remove Vehicle from Chip’s Property — Schedule Pickup ASAP",
  "type": "Tasking",
  "folio": "Asset Liquidation",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4741",
  "code": "A-4741",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "🏢 Gables Park Tower — Negotiate Long-Term Garage & Parking Agreement",
  "type": "Tasking",
  "folio": "ASTX: 111 Sandra Muraida #100",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4447",
  "code": "A-4447",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "📁 Send Full Documents Folder to Laurel Niles",
  "type": "Tasking",
  "folio": "Raymon J. Land III",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4451",
  "code": "A-4451",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "🧾 Confirm Business Tax Extension Filed — Call CPA",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4520",
  "code": "A-4520",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Queue",
  "title": "🐟 Little Fish Logo — Send to Joseph",
  "type": "Tasking",
  "folio": "Little Fish Products",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4499",
  "code": "A-4499",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "NOW",
  "title": "🔗 Fintable — Reconnect AIS Link · Bank Feed Setup",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4514",
  "code": "A-4514",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "NOW",
  "title": "📦 FEMA I&T Kits — Fulfillment & Delv · July 14 Deadline",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4443",
  "code": "A-4443",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "🧾 Send Tax Package to CPA — Deliver Docs by Saturday Apr 11",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4440",
  "code": "A-4440",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "🧾 File Business Tax Returns — Extension Filed",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4442",
  "code": "A-4442",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "🧾 Tax Mapping in AIS — Reconcile All Accounts Before CPA",
  "type": "Tasking",
  "folio": "Financial & Tax Returns",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4527",
  "code": "A-4527",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "📞  Call Tureana Dash at FEMA",
  "type": "Tasking",
  "folio": "Raymon J. Land III",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4436",
  "code": "A-4436",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Priority",
  "title": "🏦 Wells Fargo — Mortgage on 360 Nueces #2703 · Follow Up Saloni",
  "type": "Tasking",
  "folio": "Raymon J. Land III",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4504",
  "code": "A-4504",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Queue",
  "title": "💬 Clean Up iMessage",
  "type": "Tasking",
  "folio": "Communications",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4503",
  "code": "A-4503",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Queue",
  "title": "📧 Clean Up Email Inbox",
  "type": "Tasking",
  "folio": "Communications",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4505",
  "code": "A-4505",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Queue",
  "title": "📱 Clean Up WhatsApp",
  "type": "Tasking",
  "folio": "Communications",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4506",
  "code": "A-4506",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Queue",
  "title": "👥 Clean Up Facebook Messaging",
  "type": "Tasking",
  "folio": "Communications",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4648",
  "code": "A-4648",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "----",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4649",
  "code": "A-4649",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "---",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4653",
  "code": "A-4653",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "---",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4654",
  "code": "A-4654",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "---",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4659",
  "code": "A-4659",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "---",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4660",
  "code": "A-4660",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "----",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4661",
  "code": "A-4661",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "Waiting For",
  "title": "French Bank Account Setup (How To)",
  "type": "Banking",
  "folio": "VSFR: 39 Rue Des Chantiers",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4719",
  "code": "A-4719",
  "wk": "26.28",
  "accrue": "2026-07-09",
  "status": "",
  "title": "CALL BABY KING ORDER",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4702",
  "code": "A-4702",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "> Getting Organizaed in Airtable",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4703",
  "code": "A-4703",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4705",
  "code": "A-4705",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "==== WK 30 - WEDNESDAY - JULY 22 ====",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4707",
  "code": "A-4707",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4709",
  "code": "A-4709",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "> Clearing on Emails",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4710",
  "code": "A-4710",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "Untitled Action",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4711",
  "code": "A-4711",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4714",
  "code": "A-4714",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4718",
  "code": "A-4718",
  "wk": "26.30",
  "accrue": "2026-07-22",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4706",
  "code": "A-4706",
  "wk": "26.30",
  "accrue": "2026-07-23",
  "status": "",
  "title": "WK 30 - THURSDAY",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4716",
  "code": "A-4716",
  "wk": "26.30",
  "accrue": "2026-07-23",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4686",
  "code": "A-4686",
  "wk": "26.30",
  "accrue": "2026-07-24",
  "status": "Scheduled",
  "title": "9AM CST Miami Passport Office Appt",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4708",
  "code": "A-4708",
  "wk": "26.30",
  "accrue": "2026-07-24",
  "status": "",
  "title": "WK 30 - FRIDAY",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4715",
  "code": "A-4715",
  "wk": "26.30",
  "accrue": "2026-07-24",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4646",
  "code": "A-4646",
  "wk": "26.31",
  "accrue": "2026-07-31",
  "status": "Scheduled",
  "title": "France for Closing on Apartment",
  "type": "Meeting",
  "folio": "VSFR: 39 Rue Des Chantiers",
  "asn": [
   "RL3"
  ],
  "sort": 9
 },
 {
  "id": "A-4717",
  "code": "A-4717",
  "wk": "26.31",
  "accrue": "2026-07-31",
  "status": "",
  "title": "",
  "type": "",
  "folio": "",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4761",
  "code": "A-4761",
  "wk": "26.32",
  "accrue": "2026-08-07",
  "status": "Queue",
  "title": "Week 32 - August 7, 2026 Update Presentation Deck",
  "type": "Updates",
  "folio": "BOSS System",
  "asn": [
   "RL3"
  ],
  "sort": null
 },
 {
  "id": "A-4585",
  "code": "A-4585",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Create a complete plan for PhPantry.com",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": 1
 },
 {
  "id": "A-4596",
  "code": "A-4596",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Create a spreadsheet of Inventory of Churches (Panay, Bacolod..)",
  "type": "Research",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": 3
 },
 {
  "id": "A-4523",
  "code": "A-4523",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "👟 Athleisure Research — Continue Development",
  "type": "Research",
  "folio": "Ideas & Opportunities",
  "asn": [
   "SML"
  ],
  "sort": 4
 },
 {
  "id": "A-4517",
  "code": "A-4517",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "Promote PhPantry.com  (Email Blasts, Text Blasts, Newsletter, etc.)",
  "type": "Research",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": 5
 },
 {
  "id": "A-4526",
  "code": "A-4526",
  "wk": "Action",
  "accrue": "",
  "status": "Queue",
  "title": "US Visa Applications — Ereika Espiritu + Philippines Staff",
  "type": "Tasking",
  "folio": "Immigration Plans",
  "asn": [
   "SML"
  ],
  "sort": 6
 },
 {
  "id": "A-4604",
  "code": "A-4604",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Make a spreadsheet of churches in Bacolod City, Panay, etc.",
  "type": "Research",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": 7
 },
 {
  "id": "A-4612",
  "code": "A-4612",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Make a Brochure for PH Pantry",
  "type": "Research",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": 8
 },
 {
  "id": "A-4737",
  "code": "A-4737",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Prepared a report (photo journ) for Bacolod trip (distribution of MREs & Shooting)",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": null
 },
 {
  "id": "A-4757",
  "code": "A-4757",
  "wk": "Action",
  "accrue": "",
  "status": "Review",
  "title": "Prepared a proposal for the next MREs distribution plan",
  "type": "Tasking",
  "folio": "phPantry.com",
  "asn": [
   "SML"
  ],
  "sort": null
 },
 {
  "id": "A-4763",
  "code": "A-4763",
  "wk": "Action",
  "accrue": "",
  "status": "Priority",
  "title": "Sourcing Local Suppliers of Baby Wipes in Hawaii",
  "type": "Tasking",
  "folio": "FEMA Infant & Toddler Kits",
  "asn": [
   "SML"
  ],
  "sort": null
 }
];
