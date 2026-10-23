import type { Metadata } from "next";
import { getDashboardUser } from "@/lib/authz";
import { PageHeader } from "@/components/layout/PageHeader";
import { VideoList } from "@/components/features/dashboard/VideoList";

export const metadata: Metadata = { title: "Videos" };

export default async function VideosPage() {
  // The auth guard only — the list itself loads from /api/videos.
  await getDashboardUser("/dashboard/videos");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Videos"
        description="Videos you added. A video someone else added first stays in their list, even if you submitted it too."
      />
      <VideoList />
    </div>
  );
}
