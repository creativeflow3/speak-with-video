import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { TERMS_SECTIONS } from "./sections";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that govern your use of Speak With Video.",
};

export default function TermsPage() {
  return <LegalPage title="Terms of Use" sections={TERMS_SECTIONS} />;
}
