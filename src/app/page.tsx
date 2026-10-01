import { redirect } from "next/navigation";

/** The app opens on the sign-in screen (no auth backend exists yet). */
export default function Home() {
  redirect("/sign-in");
}
