import { ContactEmailLink, type LegalSection } from "@/components/layout/LegalPage";
import { LEGAL_LAST_UPDATED, LEGAL_OPERATOR_NAME } from "@/lib/legal";

const SERVICE_PROVIDERS = [
  { name: "Auth0", purpose: "account sign-up and login", url: "https://www.okta.com/privacy-policy/" },
  { name: "Neon", purpose: "database hosting", url: "https://neon.com/privacy-policy" },
  { name: "Pinecone", purpose: "storage and search of transcript passages", url: "https://www.pinecone.io/privacy/" },
  { name: "Voyage AI", purpose: "generating text embeddings for search", url: "https://www.voyageai.com/privacy" },
  { name: "Anthropic", purpose: "answering your chat questions", url: "https://www.anthropic.com/legal/privacy" },
  { name: "TranscriptAPI", purpose: "retrieving YouTube transcripts", url: "https://transcriptapi.com/privacy" },
  { name: "LangSmith", purpose: "monitoring AI responses, which may include your questions and our answers", url: "https://www.langchain.com/privacy-policy" },
  { name: "YouTube", purpose: "videos you link to and open", url: "https://policies.google.com/privacy" },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Introduction",
    body: (
      <p>
        {LEGAL_OPERATOR_NAME} (&quot;we&quot;, &quot;us&quot;) takes your privacy seriously. This
        policy explains what personal information we collect when you use our service, how we use
        it, and the choices you have.
      </p>
    ),
  },
  {
    heading: "Information We Collect",
    body: (
      <>
        <p>When you create an account and use the service, we store:</p>
        <ul>
          <li>Your account identifier and email address, provided through our login provider.</li>
          <li>The YouTube links you submit, along with each video&apos;s title, channel, and language.</li>
          <li>The questions you ask in chat, which we use to find and explain phrases.</li>
          <li>The flashcards you save to your Anki list.</li>
          <li>Usage counters we use to apply rate limits.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Collection of Routine Information",
    body: (
      <p>
        Like most websites, we track basic information about users for administration and
        maintenance. This includes IP addresses, browser details, timestamps, and referring pages.
        We use this information to keep the service running and secure. We do not use it to build
        advertising profiles.
      </p>
    ),
  },
  {
    heading: "Cookies",
    body: (
      <p>
        We use only an essential session cookie that keeps you signed in. We do not use advertising
        or third-party analytics cookies.
      </p>
    ),
  },
  {
    heading: "Third-Party Service Providers",
    body: (
      <>
        <p>
          We share information with these providers only as needed to run the service. Each has
          its own privacy policy:
        </p>
        <ul>
          {SERVICE_PROVIDERS.map((provider) => (
            <li key={provider.name}>
              <a href={provider.url} target="_blank" rel="noopener noreferrer">
                {provider.name}
              </a>
              : {provider.purpose}
            </li>
          ))}
        </ul>
        <p>We do not sell your personal information.</p>
      </>
    ),
  },
  {
    heading: "Links to Third-Party Websites",
    body: (
      <p>
        The service links to YouTube and other websites. We are not responsible for the privacy
        practices of those sites, which may differ from ours. Please review their privacy policies.
      </p>
    ),
  },
  {
    heading: "Data Retention and Deletion",
    body: (
      <p>
        We keep your information for as long as your account is active. To have your account and
        its data deleted, email <ContactEmailLink />. Some data may remain in backups for a limited time
        before it is permanently removed.
      </p>
    ),
  },
  {
    heading: "Security",
    body: (
      <p>
        We use commercially acceptable means to protect your personal information. No method of
        transmission over the internet or electronic storage is completely secure, so we cannot
        guarantee its absolute security.
      </p>
    ),
  },
  {
    heading: "Changes to This Privacy Policy",
    body: (
      <p>
        This policy is effective as of {LEGAL_LAST_UPDATED}. We may update it from time to time,
        and you should check this page periodically. If we make material changes, we will notify
        you by email or by placing a prominent notice in the service.
      </p>
    ),
  },
  {
    heading: "Contact Information",
    body: <p>For any questions or concerns about this privacy policy, email <ContactEmailLink />.</p>,
  },
];
