import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TableApp } from "@/components/base/TableApp";
import styles from "@/components/base/base.module.css";
import { isSectionSlug, SECTIONS } from "@/lib/sections";
import { requireDb } from "@/lib/db";
import { isSessionId, SESSION_COOKIE } from "@/server/base/api";
import { getBundle } from "@/server/base/store";

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: SECTIONS.find((s) => s.slug === section)?.label ?? "Not found" };
}

/**
 * Server component: loads the table (fields, records, views, sidebar layout, this user's favorites)
 * from PostgreSQL and hands it to the client workspace. All edits go through /api/base.
 */
export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ view?: string; record?: string }> }) {
  const { section } = await params;
  if (!isSectionSlug(section)) notFound();
  const { view, record } = await searchParams;
  if (!process.env.DATABASE_URL) {
    return (
      <div className={styles.dbMissing} role="alert">
        <strong>The database is not configured.</strong>
        <p>
          BOSS stores every table in PostgreSQL. Set <code>DATABASE_URL</code> (see <code>.env.example</code>) and run <code>npm run db:migrate</code>.
        </p>
      </div>
    );
  }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const bundle = await getBundle(requireDb(), section, isSessionId(cookie) ? cookie : null);
  return <TableApp bundle={bundle} initialViewId={view} initialRecordId={record} />;
}
