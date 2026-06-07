import { MailCampaignDetailSection } from '@/components/sections/mail-campaign-detail-section';

interface CampaignDetailPageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { campaignId } = await params;
  return <MailCampaignDetailSection campaignId={campaignId} />;
}
