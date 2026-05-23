import PrintPaperClient from '@/components/paper/PrintPaperClient';

interface Props {
  params: Promise<{ assignmentId: string }>;
}

// Bare print route — no sidebar, no header, no Tailwind chrome.
// Used by Puppeteer to render PDFs; the route lives outside the (main) group
// so the dashboard layout never wraps it.
export default async function PrintPage({ params }: Props) {
  const { assignmentId } = await params;
  return <PrintPaperClient assignmentId={assignmentId} />;
}
