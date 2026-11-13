import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { sponsorMailto } from "@/components/sponsors";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Sponsor an Edition — Top 10 News Hourly" };

export default function SponsorPage() {
  return (
    <LegalPage title="Sponsor an Edition" updated={false}>
      <p>
        Top 10 News Hourly readers check in for a focused, finite briefing. Each category edition carries at most one title sponsor and one native
        Sponsored Briefing, so your message never competes with clutter.
      </p>
      <h2>Placements</h2>
      <ul>
        <li><strong>Title sponsor:</strong> a &quot;Presented by&quot; bar above story #1 of the Tech &amp; AI, Finance &amp; Markets, Politics or World edition.</li>
        <li><strong>Sponsored Briefing:</strong> a clearly labeled, unranked card between stories #3 and #4, in the same clean typography as our editorial cards.</li>
      </ul>
      <h2>Our promise to readers</h2>
      <p>Sponsors never influence which stories appear or how they rank, and every placement is labeled. We run no trackers; add UTM parameters to your link to measure clicks in your own analytics.</p>
      <h2>Get in touch</h2>
      <p>
        Email <a href={sponsorMailto(site.sponsorEmail, "Tech & AI / Finance & Markets / Politics / World")}>{site.sponsorEmail}</a> with your name, company,
        work email and preferred category, and we&apos;ll send availability and rates.
      </p>
    </LegalPage>
  );
}
