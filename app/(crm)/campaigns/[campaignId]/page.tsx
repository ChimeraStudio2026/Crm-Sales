import { redirect } from 'next/navigation';

interface CampaignDetailRedirectProps {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignDetailRedirectPage({ params }: CampaignDetailRedirectProps) {
  const { campaignId } = await params;
  redirect(`/funnel/${campaignId}`);
}
