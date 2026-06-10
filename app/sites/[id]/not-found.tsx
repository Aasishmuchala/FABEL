import Link from 'next/link';
import { CameraOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function SiteNotFound() {
  return (
    <EmptyState
      icon={CameraOff}
      title="Site not found"
      description="This site is not connected to your Haazri account, or the link is stale."
      action={
        <Link
          href="/"
          className="rounded-full bg-black/[0.05] px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-black/[0.09]"
        >
          Back to portfolio
        </Link>
      }
      className="mt-10"
    />
  );
}
