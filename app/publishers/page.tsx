import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Publisher Relations, Opt-Out & DMCA — Top 10 News Hourly" };

export default function PublishersPage() {
  const optOut = `mailto:${site.publishersEmail}?subject=${encodeURIComponent("Publisher Opt-Out – [Publication Name]")}`;
  return (
    <LegalPage title="Publisher Relations, Opt-Out & DMCA Policy">
      <h2>Our Commitment to Publishers</h2>
      <p>
        Top 10 News Hourly is built to drive high-intent readers directly to original journalism. Every story entry credits multiple reporting outlets,
        provides only brief factual context in our own words, avoids displaying publishers&apos; copyrighted photographs, and links directly to the
        original source articles.
      </p>

      <h2>Immediate Feed Exclusion / Opt-Out</h2>
      <p>
        If you are a publisher, editor, or rights holder and prefer that your publication&apos;s RSS feeds or links not be indexed on Top 10 News Hourly, we
        will honor your request promptly—no formal legal notice required.
      </p>
      <ul>
        <li>
          <strong>How to Opt Out:</strong> Email <a href={optOut}>{site.publishersEmail}</a> with the subject line &quot;Publisher Opt-Out – [Publication
          Name]&quot; and include your domain(s). We will remove your domain from our ingestion whitelist within 24–48 hours.
        </li>
      </ul>

      <h2>DMCA &amp; Copyright Notices</h2>
      <p>
        If you believe any content on Top 10 News Hourly infringes upon your copyright, please send a written notice to our designated agent at{" "}
        <a href={`mailto:${site.dmcaEmail}?subject=DMCA%20notice`}>{site.dmcaEmail}</a> containing:
      </p>
      <ol>
        <li>Identification of the copyrighted work claimed to have been infringed.</li>
        <li>
          The exact URL or hourly snapshot timestamp (<code>?t=YYYY-MM-DD-HH</code>) where the material appears.
        </li>
        <li>Your name, organization, mailing address, telephone number, and email address.</li>
        <li>
          A statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or
          authorized to act on the owner&apos;s behalf, along with your physical or electronic signature.
        </li>
      </ol>

      <p className="pt-4">
        <strong>General &amp; Sponsorship Inquiries:</strong> <a href={`mailto:${site.helloEmail}`}>{site.helloEmail}</a>
      </p>
    </LegalPage>
  );
}
