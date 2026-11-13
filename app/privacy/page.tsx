import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy Policy — Top 10 News Hourly" };

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>Overview</h2>
      <p>
        Top 10 News Hourly (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy. We built this site as a fast, account-free news
        reader—we do not require logins, and we do not collect your name, email address, or personal profile.
      </p>

      <h2>Information Stored in Your Browser</h2>
      <ul>
        <li>
          <strong>Saved Reading List:</strong> If you bookmark stories on Top 10 News Hourly, those bookmarks are saved strictly in your own browser
          (<code>localStorage</code>). We never see or store them on our servers.
        </li>
        <li>
          <strong>Basic Hosting Logs:</strong> Like all websites, our hosting provider may temporarily process standard technical connection logs
          (such as IP addresses and browser types) to keep the site secure and fast.
        </li>
      </ul>

      <h2>Advertising &amp; Google AdSense Cookies</h2>
      <p>To keep Top 10 News Hourly free, we display advertisements served by Google and third-party ad networks.</p>
      <ul>
        <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to Top 10 News Hourly or other websites.</li>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to our site and/or other sites
          on the Internet.
        </li>
        <li>
          <strong>How to Opt Out:</strong> You may opt out of personalized advertising at any time by visiting{" "}
          <Ext href="https://adssettings.google.com/">Google Ads Settings</Ext>. You can also opt out of third-party vendors&apos; use of cookies for
          personalized advertising by visiting <Ext href="https://www.aboutads.info">www.aboutads.info</Ext>.
        </li>
      </ul>

      <h2>Third-Party Links</h2>
      <p>
        Our hourly summaries link directly to external news publishers and sponsors. Once you click through to another website, their own privacy
        policies apply.
      </p>

      <h2>Children&apos;s Privacy</h2>
      <p>Top 10 News Hourly is not intended for children under 13, and we do not knowingly collect any personal information from children.</p>

      <h2>Contact Us</h2>
      <p>
        If you have any privacy questions or are a publisher requesting feed removal, contact us at{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
