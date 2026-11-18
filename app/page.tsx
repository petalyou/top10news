import type { Metadata } from "next";
import { HomePage, type SearchParams } from "@/components/HomePage";
import { LOCALE_ALTERNATES } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/", languages: LOCALE_ALTERNATES },
};

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return <HomePage locale="en" searchParams={searchParams} />;
}
