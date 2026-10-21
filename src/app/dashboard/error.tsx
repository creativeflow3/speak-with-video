"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-10">
      <h1 className="font-display text-3xl italic text-ink">This page didn&apos;t load</h1>
      <p className="text-sm text-muted">We couldn&apos;t reach your data just now. Try again in a moment.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
