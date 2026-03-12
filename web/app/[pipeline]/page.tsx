import { Sidebar } from '@/components/Sidebar';
import { ChatPanel } from '@/components/ChatPanel';

interface PageProps {
  params: Promise<{ pipeline: string }>;
}

const PIPELINE_NAMES: Record<string, string> = {
  sales: 'Sales Pipeline',
  hiring: 'Hiring Pipeline',
  'customer-success': 'Customer Success',
  investor: 'Investor Tracking',
  partnership: 'Partnership Pipeline',
};

export default async function PipelinePage({ params }: PageProps) {
  const { pipeline } = await params;
  const pipelineName = PIPELINE_NAMES[pipeline] ?? pipeline;

  return (
    <div className="flex h-full">
      <Sidebar activeConfig={pipeline} />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <ChatPanel pipelineId={pipeline} pipelineName={pipelineName} />
      </main>
    </div>
  );
}

export async function generateStaticParams() {
  return [
    { pipeline: 'sales' },
    { pipeline: 'hiring' },
    { pipeline: 'customer-success' },
    { pipeline: 'investor' },
    { pipeline: 'partnership' },
  ];
}
