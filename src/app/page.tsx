import { redirect } from "next/navigation";

/** The app opens on the verified Supabase sign-in screen. */
export default function Home() {
  redirect("/sign-in");
}
