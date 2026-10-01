import type { PacketRow, RecordSet } from "@/types";

const row = (n: number, title: string, recordId: string, folio: string, url: string | null, isFolder: boolean): PacketRow => ({
  id: `pk${n}`,
  title,
  folder: null,
  recordId,
  folio,
  url,
  isFolder,
  parentFolder: null,
});

// Transcribed from Screens/07-boss-packet-sections.png.
export const packet: RecordSet<PacketRow> = {
  groups: [
    { id: "g1", label: "FEMA Maui ATTHU", count: 1, rows: [row(1, "RFI & SOW Drafts", "recJ7v18Lw8vDp7PM", "FEMA Maui ATTHU", null, false)] },
    { id: "g2", label: "Heavy Tow Co", count: 1, rows: [row(2, "Folder Test", "recyAXT5Zc19W0Uok", "Heavy Tow Co", null, true)] },
    {
      id: "g3",
      label: "LandWatermelon.com Web",
      count: 6,
      rows: [
        row(3, "Webflow Site Editor", "rec8txOERmBlgWS9f", "LandWatermelon.com Web", "https://webflow.com/dashboard?r=1", false),
        row(4, "Google Drive - Files", "recS8XDHU1YXsEHW", "LandWatermelon.com Web", "https://drive.google.com/drive/folders/1", false),
        row(5, "*MASTER* Copywriting", "recd808NgUXTCMm4", "LandWatermelon.com Web", "https://docs.google.com/document/d/1", false),
        row(6, "Lightroom Media - Photos", "recEg9uVFnA54byJt", "LandWatermelon.com Web", "https://adobe.ly/3gQFxKb", false),
        row(7, "Old Website", "rect0G4SvvYkkFLGE", "LandWatermelon.com Web", "http://landwatermelon.com/", false),
        row(8, "New Website", "recbJuW9pkaCDwn3", "LandWatermelon.com Web", "https://landwatermelon.webflow.io/", false),
      ],
    },
    {
      id: "g4",
      label: "States Based New Marketing",
      count: 2,
      rows: [
        row(9, "New Link Here", "recg28HiSQjNOfWNe", "States Based New Marketing", null, false),
        row(10, "Folder", "recvZFZjgBZLoNDEg", "States Based New Marketing", null, true),
      ],
    },
  ],
};
