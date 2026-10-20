'use client';

import { useParams } from 'next/navigation';
import { QuoteEditorSection } from '@/components/sections/quote-editor-section';

export default function PreventivoPage() {
  const params = useParams<{ id: string }>();
  return <QuoteEditorSection quoteId={params.id} />;
}
