/** Site + legal configuration. Every placeholder in the legal pages comes from here.
 * Set these in your environment (.env locally; wrangler.toml [vars] + Workers Build variables on Cloudflare); defaults are derived from SITE_URL.
 * Sponsors live in data/sponsors.json (see lib/sponsors.ts). */

const url = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const contactEmail = process.env.CONTACT_EMAIL || "yes2mountain@gmail.com";
const domain = process.env.SITE_DOMAIN || new URL(url).hostname.replace(/^www\./, "");

export const site = {
  name: "Top 10 News Hourly",
  /** Sponsor slots ("Presented by" banner, Sponsored card, "Sponsor this edition" link). Off unless SHOW_SPONSORS=true. */
  showSponsors: process.env.SHOW_SPONSORS === "true",
  url,
  /** [yourdomain.com] */
  domain,
  /** Name in the footer copyright line. */
  legalEntity: process.env.LEGAL_ENTITY_NAME || "Top 10 News Hourly",
  /** The one contact address: privacy questions, publisher opt-outs, DMCA, sponsors. */
  contactEmail,
  /** "Effective Date" shown on all three legal pages. */
  legalEffectiveDate: process.env.LEGAL_EFFECTIVE_DATE || "November 2026",
  /** [privacy@yourdomain.com] */
  privacyEmail: process.env.PRIVACY_EMAIL || contactEmail,
  /** [publishers@yourdomain.com] */
  publishersEmail: process.env.PUBLISHERS_EMAIL || contactEmail,
  /** [dmca@yourdomain.com] */
  dmcaEmail: process.env.DMCA_EMAIL || contactEmail,
  /** [hello@yourdomain.com]: general & sponsorship inquiries */
  helloEmail: process.env.HELLO_EMAIL || contactEmail,
  /** Where the "Sponsor this edition" mailto goes (defaults to the contact address). */
  sponsorEmail: process.env.SPONSOR_EMAIL || process.env.HELLO_EMAIL || contactEmail,
};
