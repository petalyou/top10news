import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of Use — Top 10 News Hourly" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <h2>1. Using Top 10 News Hourly</h2>
      <p>
        By accessing Top 10 News Hourly (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to these Terms of Use. Top 10 News Hourly provides automated
        hourly rankings, brief factual summaries, and links to top stories across Tech &amp; AI, Finance, Politics, and World news.
      </p>

      <h2>2. Third-Party News &amp; Content</h2>
      <p>
        All linked articles, headlines, and trademarks belong to their respective publishers. We do not host full articles or claim ownership over
        third-party journalism.
      </p>

      <h2>3. AI Summaries &amp; No Professional Advice</h2>
      <p>
        Our rankings, 2-sentence summaries, and &quot;Why it matters&quot; takeaways are generated automatically and may occasionally contain errors or
        omissions. Always click through to the original publisher to verify details. Content in our Finance, Politics, or Tech sections is for general
        information only and is not financial, investment, or legal advice.
      </p>

      <h2>4. Ads &amp; External Links</h2>
      <p>
        Top 10 News Hourly displays clearly labeled ads and sponsors alongside links to external websites. We are not responsible for the content, accuracy,
        or practices of external sites or advertisers.
      </p>

      <h2>5. Fair Use of Our Site</h2>
      <p>You agree not to scrape, overload, or disrupt Top 10 News Hourly&apos;s servers or hourly JSON feeds with automated bots.</p>

      <h2>6. Limitation of Liability</h2>
      <p>
        Top 10 News Hourly is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the site
        or reliance on summarized news.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions or publisher opt-out requests: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
    </LegalPage>
  );
}
