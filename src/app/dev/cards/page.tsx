import { notFound } from "next/navigation";
import { DevCardsGallery } from "./DevCardsGallery";

/** Development-only route (404 in production) used for visual QA of the card designs. */
export default function DevCards() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevCardsGallery />;
}
