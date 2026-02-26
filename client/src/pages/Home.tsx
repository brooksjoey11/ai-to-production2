import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Header from "@/components/Header";
import CodeSubmission from "@/components/CodeSubmission";
import ResultsDisplay from "@/components/ResultsDisplay";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { Shield, Zap, FileSearch, ArrowRight } from "lucide-react";

interface PipelineResult {
  submissionId: number;
  forensicDossier: string;
  rebuiltCode: string;
  qualityReport: string;
  tokensUsed: number;
}

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [result, setResult] = useState<PipelineResult | null>(null);

  const handleResult = useCallback((data: PipelineResult) => {
    setResult(data);
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setResult(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="border-4 border-black p-8 animate-pulse">
            <span className="font-mono text-lg uppercase tracking-widest">Loading...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {!isAuthenticated ? (
        <LandingSection />
      ) : result ? (
        <main className="flex-1 container py-8">
          <ResultsDisplay result={result} onNewAnalysis={handleNewAnalysis} />
        </main>
      ) : (
        <main className="flex-1 container py-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
              CODE ANALYSIS
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-2">
              Submit your code for forensic analysis, automated repair, and quality assessment.
            </p>
          </div>
          <CodeSubmission onResult={handleResult} />
        </main>
      )}

      <footer className="border-t-4 border-black py-6">
        <div className="container">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">
            AI TO PRODUCTION &mdash; FORENSIC CODE REPAIR SYSTEM
          </p>
        </div>
      </footer>
    </div>
  );
}

function LandingSection() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b-4 border-black">
        <div className="container py-16 sm:py-24">
          <div className="max-w-3xl">
            <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tight leading-none">
              FORENSIC
              <br />
              CODE
              <br />
              REPAIR
            </h1>
            <p className="font-mono text-base sm:text-lg mt-6 max-w-xl leading-relaxed">
              Three-step AI pipeline that detects vulnerabilities, rebuilds your code, and verifies the improvements. Production-grade output.
            </p>
            <a
              href={getLoginUrl()}
              className="btn-brutal inline-flex items-center gap-3 mt-8 text-sm no-underline"
            >
              START ANALYZING
              <ArrowRight className="size-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b-4 border-black">
        <div className="container py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="border-2 border-black p-8 md:border-r-0">
              <div className="bg-black text-white p-3 w-fit mb-4">
                <FileSearch className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-3">
                FORENSIC ANALYSIS
              </h3>
              <p className="font-mono text-sm leading-relaxed">
                Deep inspection of your code for bugs, security vulnerabilities, missing error handling, and performance issues.
              </p>
            </div>
            <div className="border-2 border-black p-8 md:border-r-0">
              <div className="bg-black text-white p-3 w-fit mb-4">
                <Zap className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-3">
                CODE REBUILDER
              </h3>
              <p className="font-mono text-sm leading-relaxed">
                Automated rewrite that fixes every identified issue. Adds error handling, validation, and follows best practices.
              </p>
            </div>
            <div className="border-2 border-black p-8">
              <div className="bg-black text-white p-3 w-fit mb-4">
                <Shield className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-3">
                QUALITY CHECK
              </h3>
              <p className="font-mono text-sm leading-relaxed">
                Plain-language summary of all improvements with confidence rating for production readiness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="container py-16">
          <h2 className="text-3xl font-black uppercase tracking-tight mb-8">
            HOW IT WORKS
          </h2>
          <div className="space-y-0">
            {[
              { step: "01", title: "PASTE YOUR CODE", desc: "Drop a file or paste code directly. Select the language and add optional context." },
              { step: "02", title: "AI PIPELINE RUNS", desc: "Three specialized AI models analyze, rebuild, and verify your code in sequence." },
              { step: "03", title: "GET RESULTS", desc: "Review the forensic report, download the fixed code, and read the quality summary." },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 border-2 border-black p-6 -mt-[2px] first:mt-0">
                <span className="text-4xl font-black font-mono shrink-0">{item.step}</span>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{item.title}</h3>
                  <p className="font-mono text-sm mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
