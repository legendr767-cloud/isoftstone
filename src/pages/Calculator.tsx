import { Seo } from '@/components/Seo';
import { ProfitCalculator } from '@/components/ProfitCalculator';

export default function CalculatorPage() {
  return (
    <div className="container py-12 sm:py-16">
      <Seo title="Profit split calculator" description="Estimate a hypothetical profit split for an iSoftStone forex challenge account size." path="/calculator" />
      <p className="eyebrow">Calculator</p><h1 className="mt-3 text-4xl font-extrabold">Profit split calculator</h1>
      <p className="mt-3 max-w-2xl text-slate-400">A simple illustration of how a hypothetical return would be divided between trader and firm. All defaults come from the challenge's published terms.</p>
      <div className="mt-8"><ProfitCalculator /></div>
    </div>
  );
}
