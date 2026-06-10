import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, VideoOff } from 'lucide-react';
import { getCameras, getSite } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LiveView } from '@/components/live/live-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = getSite(id);
  if (!site) {
    return { title: 'Site not found' };
  }
  return {
    title: `Live — ${site.name}`,
    description: `On-demand camera streams from ${site.name}, ${site.city}.`,
  };
}

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();

  const cameras = getCameras(id);
  const online = cameras.filter((c) => c.status === 'online').length;
  const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE ?? null;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          href={`/sites/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition hover:text-text"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          Back to {site.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted">
              {site.city} · on-demand video
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">
              Live view
            </h1>
          </div>
          <Badge variant={online === cameras.length && online > 0 ? 'ok' : 'warn'}>
            {online} of {cameras.length} cameras online
          </Badge>
        </div>
      </header>

      {cameras.length === 0 ? (
        <EmptyState
          icon={VideoOff}
          title="No cameras connected"
          description="Live streams appear here once cameras are wired into the site's edge AI box."
        />
      ) : (
        <LiveView cameras={cameras} streamBase={streamBase} />
      )}

      {!streamBase ? (
        <p className="text-[13px] text-muted">
          Demo feeds shown — connects to the site edge box over WebRTC in
          production.
        </p>
      ) : null}
    </div>
  );
}
