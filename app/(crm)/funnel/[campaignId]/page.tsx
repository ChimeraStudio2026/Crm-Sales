import { FunnelCampaignDetailSection } from '@/components/sections/funnel-campaign-detail-section';

interface FunnelCampaignPageProps {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ entry?: string | string[] }>;
}

export default async function FunnelCampaignPage({ params, searchParams }: FunnelCampaignPageProps) {
  const { campaignId } = await params;
  const { entry } = await searchParams;
  const focusEntryId = Array.isArray(entry) ? entry[0] : entry;
  return <FunnelCampaignDetailSection campaignId={campaignId} focusEntryId={focusEntryId} />;
}
