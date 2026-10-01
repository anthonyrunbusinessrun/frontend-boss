import type { Profile, RecordSet } from "@/types";

// Transcribed from Screens/03-boss-profile-management.png.
// NEEDS CLARIFICATION: Address is clipped at the frame edge in the design; columns after Address are not shown.
export const profiles: RecordSet<Profile> = {
  range: { from: 1, to: 12, total: 14 },
  groups: [
    {
      id: "all",
      rows: [
        { id: "p1", contact: "ACT", sal: null, name: "Action Assistance Team", position: "Action Assistance", billing: "LLG", type: "Agent", email: "Action@RayLand.com", address: null },
        { id: "p2", contact: "SRC", sal: null, name: "Sourcing Email", position: "Sourcing", billing: "LLG", type: "Agent", email: "raylandincsourcing@gmail.com", address: null },
        { id: "p3", contact: "RL3", sal: "Mr.", name: "Raymon Joseph Land III", position: "President", billing: "LLG", type: "Agent", email: "rayland@ray-land.com", address: "111 Sandra Muraida Way #17A, Au" },
        { id: "p4", contact: "EJH", sal: "Ms.", name: "Eva June Hicks", position: "Branford Rep", billing: "LLG", type: "Agent", email: "junehicks@ray-land.com", address: "San Roque Village, Saipan, MP U" },
        { id: "p5", contact: "SDB", sal: "Ms.", name: "Sarah D Budd", position: "Assistant", billing: "LLG", type: "Agent", email: "sarah@runbusiness.com", address: "Iloilo City, Philippines" },
        { id: "p6", contact: "EJE", sal: "Ms.", name: "Ereika Espiritu", position: "Chief Financial Officer", billing: "LLG", type: "Agent", email: "ereika@runbusiness.com", address: null },
        { id: "p7", contact: "LFG", sal: "Ms.", name: "Laura Fowler Goss", position: "Chief de Auxiliaire", billing: "LLG", type: "Agent", email: "laura@fowlergoss.com", address: null },
        { id: "p8", contact: "JAD", sal: "Mr.", name: "Joseph Anthony Duran", position: "Chief Technology Officer", billing: "BOSS", type: "Agent", email: "anthony@ray-land.com", address: null },
        { id: "p9", contact: "AES", sal: "Ms.", name: "Andrea Erika Sabas", position: "Communications", billing: null, type: "Agent", email: "andrea@runbusiness.com", address: null },
        { id: "p10", contact: "BEM", sal: "Mr.", name: "Benj Edgar Magno", position: "Contractor", billing: null, type: "Rep", email: "benimagno19@gmail.com", address: null },
        { id: "p11", contact: "SML", sal: "Ms.", name: "Sheila Mae Labordo", position: "Contractor", billing: null, type: "Rep", email: "sheilacrusemlabordo@gmail.com", address: null },
        { id: "p12", contact: "JWO", sal: "Mr.", name: "John Willemstad Osuyos", position: "Senior UI/UX, Graphics Designer", billing: "BOSS", type: "Agent", email: "stad@runbusiness.com", address: null },
      ],
    },
  ],
};
