/**
 * Domain model for the Multiplexer. These types describe the shape of the data the UI works with.
 * A future backend should return data in these shapes (or map into them in src/services).
 * Timestamps are epoch milliseconds.
 */

export interface Partner {
  id: string;
  name: string;
  site: string;
  email: string;
  mobile: string;
}

export type EdiDocType = "850" | "856" | "810";
export type Direction = "in" | "out";
/** 0 Incoming, 1 Review, 2 Process, 3 Acknowledge, 4 Completed. */
export type Stage = 0 | 1 | 2 | 3 | 4;

export interface Product {
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  location: string;
}

export interface TransactionLine {
  desc: string;
  /** null while the item is not matched to a catalog product. */
  sku: string | null;
  /** The partner's own item code, kept for unmatched items. */
  code?: string;
  qty: number;
}

export interface HistoryEntry {
  ts: number;
  text: string;
  who: string;
}

export type IssueKind = "item" | "ack" | "flag";
export interface TransactionIssue {
  kind: IssueKind;
  message: string;
}

export interface Transaction {
  id: string;
  type: EdiDocType;
  dir: Direction;
  partnerId: string;
  ref: string;
  ts: number;
  stage: Stage;
  lines: TransactionLine[];
  issue: TransactionIssue | null;
  orderId: string | null;
  shipmentId: string | null;
  history: HistoryEntry[];
}

export type OrderStatus = "new" | "short" | "ready" | "shipping" | "delivered";
export interface OrderLine {
  sku: string;
  qty: number;
}
export interface Order {
  reference?: string;
  id: string;
  partnerId: string;
  lines: OrderLine[];
  due: number;
  status: OrderStatus;
  /** How the order arrived: "EDI 850", "Email", "Fax" or "Scan". */
  via: string;
  ts: number;
  shipmentId: string | null;
  txnId: string | null;
  docId?: string | null;
}

export type ShipmentStatus = "preparing" | "transit" | "delivered";
export interface Shipment {
  id: string;
  orderId: string;
  tracking: string;
  carrier: string;
  status: ShipmentStatus;
  eta: number;
}

export type Channel = "email" | "fax" | "sms";
export type MessageStatus = "queued" | "sending" | "delivered" | "failed";
export interface Attachment {
  name: string;
  kb: number;
  docId?: string;
}
export interface Message {
  id: string;
  channel: Channel;
  dir: Direction;
  partnerId: string;
  subject: string;
  ts: number;
  unread: boolean;
  from?: string;
  body?: string;
  attachments?: Attachment[];
  status?: MessageStatus;
  pages?: number;
  faxNumber?: string;
  failReason?: string;
  /** Scanned document this message produced (fax or email attachment). */
  docId?: string;
}

export type DocStatus = "received" | "reading" | "extracted" | "done";
export interface ExtractedField {
  value: string;
  /** 0 to 100. Below 80 is flagged for the person to check. */
  confidence: number;
  edited?: boolean;
}
export interface ExtractedLine {
  desc: string;
  sku: string | null;
  qty: string;
  confidence: number;
  edited?: boolean;
}
export interface DocumentResult {
  kind: "order" | "shipment";
  id: string;
}
export interface ScanDocument {
  id: string;
  name: string;
  /** Key of the prepared sample used by the simulated reader. */
  sampleKey: string;
  source: string;
  ts: number;
  status: DocStatus;
  messageId: string | null;
  fields?: Record<string, ExtractedField>;
  lines?: ExtractedLine[];
  errors?: string[] | null;
  result?: DocumentResult | null;
}

export interface ActivityEntry {
  ts: number;
  text: string;
  sub: string;
  href: string;
  ok: boolean;
}

export interface Counters {
  transaction: number;
  order: number;
  shipment: number;
  document: number;
  message: number;
}

/** Everything the app stores. The repository (src/services) provides the initial value. */
export interface AppData {
  partners?: Partner[];
  counters: Counters;
  products: Product[];
  orders: Order[];
  shipments: Shipment[];
  transactions: Transaction[];
  messages: Message[];
  documents: ScanDocument[];
  log: ActivityEntry[];
}

/** Result of a workflow action: the new data plus an optional message for the person. */
export interface ActionResult<T = undefined> {
  data: AppData;
  message?: string;
  tone?: "ok" | "warn";
  /** Extra information for the caller, such as the id of a record that was created. */
  value?: T;
}
