import type { RecordSet, RegistryRow } from "@/types";

// Transcribed from Screens/16-boss-registries.png.
export const registries: RecordSet<RegistryRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "all",
      rows: [
        { id: "r1", name: "Progressive Auto Insurance", attachment: "/assets/registries/registry-1.png", status: "Coming Due", expiry: "2022-12-21", notes: "Policy #: PX-8849-012" },
        { id: "r2", name: "SBH2S Ford Service Registration", attachment: "/assets/registries/registry-2.png", status: "Current", expiry: "2023-12-31", notes: null },
        { id: "r3", name: "EFFM11 Registration #208", attachment: "/assets/registries/registry-3.png", status: "Current", expiry: "2024-06-30", notes: null },
      ],
    },
  ],
};
