import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card className="text-center text-slate-400">
        <p className="text-lg font-medium text-slate-300">Coming soon</p>
        <p className="mt-1 text-sm">This page will be built in a later phase.</p>
      </Card>
    </div>
  );
}
