import type { ItemRow, RecordSet } from "@/types";

type I = [string, string, string, number, ItemRow["kit"], string];

// Transcribed from Screens/10-boss-items.png.
const raw: I[] = [
  ["Baby Food - Sweet Potato", "Stage 2 Organic Puree, 4oz jar", "Aisle 4-B", 240, "Kit Alpha", "Sarah Jenkins"],
  ["Baby Cereal - Oatmeal", "Organic single grain oatmeal", "Aisle 2-A", 180, "Kit Beta", "Mike Ramirez"],
  ["Infant Formula Premium", "Milk-based powder with Iron, 35oz", "Aisle 5-C", 120, "Kit Alpha", "Alex Torres"],
  ["Comfort Diapers Size 3", "Ultra protection pack of 120 count", "Aisle 1-F", 450, "Kit Gamma", "Lisa Miller"],
  ["Silicone Sip Cup", "Spill-proof training cup with handles", "Aisle 6-D", 110, "Kit Beta", "John Doe"],
  ["Sensitive Baby Wipes", "Fragrance-free pack of 80 wipes", "Aisle 1-G", 600, "Kit Gamma", "Sarah Jenkins"],
  ["Orthodontic Pacifier Duo", "BPA-free silicone pacifiers 2-pack", "Aisle 3-A", 320, "Kit Alpha", "Alex Torres"],
  ["Plush Fleece Baby Blanket", "Super soft hypoallergenic fleece", "Aisle 8-B", 95, "Kit Delta", "Lisa Miller"],
  ["Toddler Training Pants 4T", "Easy pull-ups pack of 60", "Aisle 1-E", 210, "Kit Delta", "John Doe"],
  ["Gentle Baby Lotion", "Moisturizing daily lotion, 12oz", "Aisle 4-F", 140, "Kit Beta", "Mike Ramirez"],
];

// NEEDS CLARIFICATION: the footer text is cut off at the bottom of the frame; only pagination is visible.
export const items: RecordSet<ItemRow> = {
  range: { from: 1, to: 10, total: 10 },
  groups: [
    {
      id: "all",
      rows: raw.map(([title, overview, location, qty, kit, assigned], i) => ({
        id: `i${i + 1}`,
        n: i + 1,
        pic: `/assets/items/item-${String(i + 1).padStart(2, "0")}.png`,
        title,
        overview,
        purstat: "Purchased",
        location,
        qty,
        kit,
        assigned,
      })),
    },
  ],
};
