import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import SetupNotice from "../components/SetupNotice";
import KpiCard from "../components/KpiCard";
import { supabase, isConfigured } from "../lib/supabase";
import { formatPercent, monthLabel } from "../lib/calculations";

export default function Landing() {
  const [latest, setLatest] = useState(null);
  const [memberCount, setMemberCount] = useState(null);

  useEffect(() => {
    if (!isConfigured) return;

    supabase
      .from("strategy_months")
      .select("*")
      .eq("is_published", true)
      .order("month_key", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatest(data || null));

    supabase.rpc("public_member_count").then(({ data }) => {
      if (typeof data === "number") setMemberCount(data);
    });
  }, []);

  return (
    <div className="public-page">
      <PublicHeader />
      <SetupNotice />

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">INDEPENDENT EGX STRATEGY</span>
            <h1>A transparent record of decisions, performance and <em>real Alpha.</em></h1>
            <p>
              ALPHA CORE documents a focused Egyptian equity strategy against
              EGX30 Capped — with every monthly result, portfolio change and
              investment decision preserved in public.
            </p>

            <div className="hero-actions">
              <Link className="button gold large" to="/signup">
                Join ALPHA CORE Free <ArrowRight size={17}/>
              </Link>
              <Link className="button subtle large" to="/methodology">
                Read the Philosophy
              </Link>
            </div>

            <div className="trust-line">
              <span><ShieldCheck size={16}/> No invented track record</span>
              <span><BookOpen size={16}/> Every change documented</span>
              <span><Users size={16}/> {memberCount ?? "Free"} community access</span>
            </div>
          </div>

          <div className="terminal-preview">
            <div className="terminal-top">
              <span>ALPHA CORE / LIVE</span>
              <b>{latest ? monthLabel(latest.month_key) : "LAUNCH MONTH"}</b>
            </div>
            <div className="terminal-grid">
              <KpiCard
                title="Portfolio MTD"
                value={latest ? formatPercent(latest.live_portfolio_return) : "Tracking"}
                note="Official live return"
                tone="blue"
              />
              <KpiCard
                title="EGX30 Capped"
                value={latest ? formatPercent(latest.live_benchmark_return) : "Baseline"}
                note="Declared benchmark"
                tone="gold"
              />
              <KpiCard
                title="Monthly Alpha"
                value={latest ? formatPercent(latest.live_alpha) : "Starts Now"}
                note="Portfolio less benchmark"
                tone={Number(latest?.live_alpha || 0) >= 0 ? "green" : "red"}
              />
              <KpiCard
                title="Status"
                value={latest?.is_closed ? "FINAL" : "LIVE"}
                note="Updated by the administrator"
                tone="neutral"
              />
            </div>

            <div className="fake-chart" aria-label="Decorative performance chart">
              <svg viewBox="0 0 900 310" role="img">
                <defs>
                  <linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00B4D8" stopOpacity=".22"/>
                    <stop offset="100%" stopColor="#00B4D8" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M10 255 C120 245,160 210,245 220 C340 232,385 158,470 170 C560 182,610 112,690 126 C760 138,818 70,890 55 L890 300 L10 300 Z" fill="url(#previewFill)"/>
                <path d="M10 255 C120 245,160 210,245 220 C340 232,385 158,470 170 C560 182,610 112,690 126 C760 138,818 70,890 55" fill="none" stroke="#00B4D8" strokeWidth="5"/>
                <path d="M10 255 C140 250,200 230,285 230 C390 230,455 205,545 210 C660 216,750 175,890 170" fill="none" stroke="#C5A059" strokeWidth="4"/>
              </svg>
            </div>

            <div className="preview-lock">
              <BarChart3 size={18}/>
              Full holdings, history and decision log unlock after free registration.
            </div>
          </div>
        </section>

        <section className="philosophy-section">
          <div className="section-heading">
            <span className="eyebrow">THE ALPHA CORE PHILOSOPHY</span>
            <h2>Not predictions. A measurable investment process.</h2>
            <p>
              The platform starts its track record from launch. No backfilled
              history, no cherry-picked months and no disappearing decisions.
            </p>
          </div>

          <div className="philosophy-grid">
            <Philosophy number="01" title="Focused Portfolio" text="A concentrated five-stock core keeps every position meaningful and every decision visible." />
            <Philosophy number="02" title="Declared Benchmark" text="Every result is measured against EGX30 Capped. Return without context is not Alpha." />
            <Philosophy number="03" title="Monthly Accountability" text="Each month is closed, archived and compounded into the permanent public track record." />
            <Philosophy number="04" title="Decision Transparency" text="Removed stocks, added stocks and the reason behind each change stay visible to members." />
          </div>
        </section>

        <section className="launch-section">
          <div>
            <span className="eyebrow">BUILDING THE RECORD IN PUBLIC</span>
            <h2>The first month is the beginning — not a weakness.</h2>
          </div>
          <p>
            The live launch month shows the active portfolio and its performance.
            When the month closes, it becomes the first permanent historical
            record. From the second month onward, investors can compare every
            new result with the full compounded history.
          </p>
        </section>

        <section className="join-section">
          <div>
            <span className="eyebrow">FREE FOUNDING ACCESS</span>
            <h2>Follow every update from the beginning.</h2>
            <p>
              Create a free account to view holdings, download reports and
              receive the monthly ALPHA CORE newsletter.
            </p>
          </div>
          <Link className="button gold large" to="/signup">
            Create Free Account <ArrowRight size={17}/>
          </Link>
        </section>
      </main>

      <footer className="public-footer">
        <strong className="footer-brand">ALPHA CORE</strong>
        <p>
          Performance information is presented for transparency and educational
          purposes and is not personalised investment advice.
        </p>
      </footer>
    </div>
  );
}

function Philosophy({ number, title, text }) {
  return (
    <article className="philosophy-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}
