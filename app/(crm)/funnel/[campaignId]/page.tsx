import { FunnelCampaignDetailSection } from '@/components/sections/funnel-campaign-detail-section';

interface FunnelCampaignPageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function FunnelCampaignPage({ params }: FunnelCampaignPageProps) {
  const { campaignId } = await params;
  return <FunnelCampaignDetailSection campaignId={campaignId} />;
}
