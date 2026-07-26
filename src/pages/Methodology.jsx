import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PublicHeader from "../components/PublicHeader";

export default function Methodology() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="methodology-page">
        <header className="methodology-hero">
          <span className="eyebrow">INVESTMENT METHODOLOGY</span>
          <h1>A process that can be measured, challenged and improved.</h1>
          <p>
            ALPHA CORE does not promise that every month will outperform.
            It promises that every result will be measured the same way and every
            portfolio decision will remain visible.
          </p>
        </header>

        <section className="methodology-grid">
          <Method number="01" title="Objective">
            Seek long-term compounded outperformance versus EGX30 Capped while
            maintaining a simple, understandable portfolio.
          </Method>
          <Method number="02" title="Portfolio Construction">
            Five listed Egyptian equities with explicit target weights. The
            default structure is equal-weighted unless a published monthly note
            states otherwise.
          </Method>
          <Method number="03" title="Measurement">
            Individual stock return is measured from the official month-open
            price to the latest or final close. Portfolio return is the sum of
            each stock's weighted contribution.
          </Method>
          <Method number="04" title="Alpha">
            Monthly Alpha equals portfolio return less EGX30 Capped return.
            Cumulative returns are compounded month by month rather than added.
          </Method>
          <Method number="05" title="Rebalancing">
            The portfolio is reviewed on a declared monthly cycle. Any removal,
            addition or weight change is recorded in the Decision Log.
          </Method>
          <Method number="06" title="Transparency Standard">
            The track record begins at launch. Historical figures are not
            reconstructed to create a more attractive past.
          </Method>
        </section>

        <section className="formula-panel">
          <div><small>STOCK RETURN</small><strong>(Close − Open) ÷ Open</strong></div>
          <div><small>WEIGHTED CONTRIBUTION</small><strong>Weight × Stock Return</strong></div>
          <div><small>MONTHLY ALPHA</small><strong>Portfolio − Benchmark</strong></div>
          <div><small>CUMULATIVE PERFORMANCE</small><strong>Compounded Month by Month</strong></div>
        </section>

        <section className="methodology-cta">
          <div>
            <h2>See the process applied to real monthly decisions.</h2>
            <p>Registration is free during the founding phase.</p>
          </div>
          <Link className="button gold large" to="/signup">
            Join Free <ArrowRight size={17}/>
          </Link>
        </section>
      </main>
    </div>
  );
}

function Method({ number, title, children }) {
  return (
    <article className="method-card">
      <span>{number}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
