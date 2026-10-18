import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { PRIVACY_SECTIONS } from "./sections";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Speak With Video collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" sections={PRIVACY_SECTIONS} />;
}
