import { z } from "zod";
import type { AppData, Partner } from "@/types/multiplexer";

export type SharedData = AppData & { partners: Partner[] };
export const emptySharedData = (): SharedData => ({
  partners: [],
  products: [],
  orders: [],
  shipments: [],
  transactions: [],
  messages: [],
  documents: [],
  log: [],
  counters: { transaction: 1, order: 1, shipment: 1, document: 1, message: 1 },
});
const text = z.string().trim().min(1).max(200);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/);
const qty = z.number().int().min(1).max(1000000);
export const CommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("savePartner"),
      partner: z
        .object({
          id,
          name: text,
          site: z.string().max(300),
          email: z.union([z.literal(""), z.email()]),
          mobile: z.string().max(60),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("saveProduct"),
      product: z
        .object({
          sku: id,
          name: text,
          unit: text,
          location: z.string().max(200),
          reorderPoint: z.number().int().min(0).max(1000000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("createOrder"),
      partnerId: id,
      due: z.number().int().positive(),
      reference: text,
      lines: z
        .array(z.object({ sku: id, qty }).strict())
        .min(1)
        .max(100),
    })
    .strict(),
  z.object({ action: z.literal("receiveStock"), sku: id, qty }).strict(),
  z.object({ action: z.literal("runOrder"), id }).strict(),
  z.object({ action: z.literal("recheckOrder"), id }).strict(),
  z.object({ action: z.literal("runShipment"), id }).strict(),
  z
    .object({
      action: z.literal("saveShipment"),
      id,
      carrier: text,
      tracking: text,
      eta: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("sendMessage"),
      channel: z.enum(["email", "fax", "sms"]),
      partnerId: id,
      subject: z.string().trim().max(200),
      body: z.string().trim().min(1).max(20000),
    })
    .strict(),
  z.object({ action: z.literal("markRead"), id }).strict(),
  z.object({ action: z.literal("requestReorder"), sku: id }).strict(),
]);
export type SharedCommand = z.infer<typeof CommandSchema>;
export const EnvelopeSchema = z
  .object({
    commandId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    command: CommandSchema,
  })
  .strict();
export interface Snapshot {
  data: SharedData;
  revision: number;
  outbox: Array<{
    id: string;
    kind: string;
    record_id: string;
    status: string;
    reason: string;
  }>;
}
