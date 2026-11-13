import type { Metadata } from "next";
import { HomePage, type SearchParams } from "@/components/HomePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/", languages: { en: "/", es: "/es", "zh-Hans": "/zh" } },
};

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return <HomePage locale="en" searchParams={searchParams} />;
}
