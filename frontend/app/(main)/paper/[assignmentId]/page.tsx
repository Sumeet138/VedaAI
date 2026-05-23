import PaperPageClient from '@/components/paper/PaperPageClient';

interface Props {
  params: Promise<{ assignmentId: string }>;
}

export default async function PaperPage({ params }: Props) {
  const { assignmentId } = await params;
  return <PaperPageClient assignmentId={assignmentId} />;
}
