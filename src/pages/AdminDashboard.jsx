import { useEffect, useMemo, useState } from "react";
import { BarChart3, LogOut, Mail, Plus, Save, Send, Users, X } from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { calculateMonth, formatPercent, monthLabel } from "../lib/calculations";

const makeHolding = (index) => ({
  local_id: crypto.randomUUID(),
  ticker: "",
  weight: 20,
  open_price: 0,
  close_price: 0,
  sort_order: index,
});

const makeMonth = () => ({
  id: null,
  month_key: new Date().toISOString().slice(0, 7),
  strategy_name: "ALPHA CORE Five-Stock Strategy",
  benchmark_open: 0,
  benchmark_close: 0,
  live_portfolio_return: 0,
  live_benchmark_return: 0,
  live_alpha: 0,
  public_commentary: "",
  update_title: "",
  monthly_objective: "Outperform EGX30 Capped through disciplined stock selection.",
  investor_guidance_title: "Published Target Allocation",
  investor_guidance: "Existing investors should rebalance to the published target weights. New investors should allocate according to the current portfolio.",
  is_published: false,
  is_closed: false,
  final_portfolio_return: null,
  final_benchmark_return: null,
  holdings: Array.from({ length: 5 }, (_, index) => makeHolding(index)),
  swaps: [],
  snapshots: [],
});

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [months, setMonths] = useState([]);
  const [form, setForm] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");

  const metrics = useMemo(() => calculateMonth(form), [form]);

  const loadData = async (preferredId) => {
    const [{ data: monthData, error }, { data: memberData }] = await Promise.all([
      supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*)").order("month_key", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, newsletter_opt_in, created_at, is_admin").order("created_at", { ascending: false }),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMonths(monthData || []);
    setMembers(memberData || []);

    const chosen =
      monthData?.find((month) => month.id === preferredId) ||
      monthData?.find((month) => month.id === selectedId) ||
      monthData?.[0];

    if (chosen) {
      setSelectedId(chosen.id);
      setForm(normalise(chosen));
    } else {
      setSelectedId("");
      setForm(makeMonth());
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectMonth = (id) => {
    const chosen = months.find((month) => month.id === id);
    setSelectedId(id);
    setForm(normalise(chosen));
  };

  const updateHolding = (index, field, value) => {
    setForm((current) => ({
      ...current,
      holdings: current.holdings.map((holding, currentIndex) =>
        currentIndex === index
          ? {
              ...holding,
              [field]:
                field === "ticker"
                  ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
                  : Number(value),
            }
          : holding
      ),
    }));
  };

  const equalise = () => {
    const weight = 100 / form.holdings.length;
    setForm((current) => ({
      ...current,
      holdings: current.holdings.map((holding) => ({
        ...holding,
        weight: Number(weight.toFixed(2)),
      })),
    }));
  };

  const persistMonth = async ({ publish = form.is_published, close = false } = {}) => {
    setMessage(close ? "Closing month…" : "Saving update…");

    const payload = {
      month_key: form.month_key,
      strategy_name: form.strategy_name,
      benchmark_open: Number(form.benchmark_open),
      benchmark_close: Number(form.benchmark_close),
      live_portfolio_return: Number(metrics.portfolioReturn.toFixed(8)),
      live_benchmark_return: Number(metrics.benchmarkReturn.toFixed(8)),
      live_alpha: Number(metrics.alpha.toFixed(8)),
      public_commentary: form.public_commentary,
      update_title: form.update_title,
      monthly_objective: form.monthly_objective,
      investor_guidance_title: form.investor_guidance_title,
      investor_guidance: form.investor_guidance,
      is_published: Boolean(publish || close),
      is_closed: Boolean(close || form.is_closed),
      final_portfolio_return: close ? Number(metrics.portfolioReturn.toFixed(8)) : form.final_portfolio_return,
      final_benchmark_return: close ? Number(metrics.benchmarkReturn.toFixed(8)) : form.final_benchmark_return,
      updated_at: new Date().toISOString(),
    };

    let monthId = form.id;

    if (monthId) {
      const { error } = await supabase.from("strategy_months").update(payload).eq("id", monthId);
      if (error) return setMessage(error.message);

      const deletes = await Promise.all([
        supabase.from("holdings").delete().eq("month_id", monthId),
        supabase.from("swaps").delete().eq("month_id", monthId),
      ]);
      const deleteError = deletes.find((result) => result.error)?.error;
      if (deleteError) return setMessage(deleteError.message);
    } else {
      const { data, error } = await supabase
        .from("strategy_months")
        .insert({ ...payload, created_by: profile.id })
        .select("id")
        .single();
      if (error) return setMessage(error.message);
      monthId = data.id;
    }

    const { error: holdingsError } = await supabase.from("holdings").insert(
      form.holdings.map((holding, index) => ({
        month_id: monthId,
        ticker: holding.ticker.trim(),
        weight: Number(holding.weight),
        open_price: Number(holding.open_price),
        close_price: Number(holding.close_price),
        sort_order: index,
      }))
    );
    if (holdingsError) return setMessage(holdingsError.message);

    const validSwaps = form.swaps.filter((swap) => swap.removed_ticker && swap.added_ticker);
    if (validSwaps.length) {
      const { error } = await supabase.from("swaps").insert(
        validSwaps.map((swap) => ({
          month_id: monthId,
          removed_ticker: swap.removed_ticker.toUpperCase(),
          added_ticker: swap.added_ticker.toUpperCase(),
          reason: swap.reason,
        }))
      );
      if (error) return setMessage(error.message);
    }

    if (publish || close) {
      const { error } = await supabase.from("snapshots").upsert(
        {
          month_id: monthId,
          snapshot_date: new Date().toISOString().slice(0, 10),
          portfolio_return: Number(metrics.portfolioReturn.toFixed(8)),
          benchmark_return: Number(metrics.benchmarkReturn.toFixed(8)),
        },
        { onConflict: "month_id,snapshot_date" }
      );
      if (error) return setMessage(error.message);
    }

    setMessage(
      close
        ? "Month closed. The final result is now part of the permanent track record."
        : publish
        ? "Update published. Registered members will see it immediately."
        : "Draft saved privately."
    );
    await loadData(monthId);
  };

  const newsletterMembers = members.filter((member) => member.newsletter_opt_in && !member.is_admin);

  if (!form) return <div className="screen-loader">Loading admin control centre…</div>;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand to="/admin"/>
        <div className="admin-profile">
          <small>ADMINISTRATOR</small>
          <b>{profile?.full_name || profile?.email}</b>
        </div>

        <button className="button gold full" onClick={() => { setSelectedId(""); setForm(makeMonth()); setMessage("New month created as an unsaved draft."); }}>
          <Plus size={16}/> New Month
        </button>

        <nav className="month-nav">
          {months.map((month) => (
            <button className={selectedId === month.id ? "active" : ""} key={month.id} onClick={() => selectMonth(month.id)}>
              <span>{monthLabel(month.month_key)}</span>
              <small>{month.is_closed ? "FINAL" : month.is_published ? "LIVE" : "DRAFT"}</small>
            </button>
          ))}
        </nav>

        <button className="button subtle full" onClick={signOut}><LogOut size={16}/> Sign Out</button>
      </aside>

      <main className="admin-content">
        <header className="admin-top">
          <div>
            <span className="eyebrow">ADMIN CONTROL CENTRE</span>
            <h1>{monthLabel(form.month_key)}</h1>
            <p>Enter the figures once, then publish them to every registered member.</p>
          </div>
          <div className="admin-actions">
            <button className="button subtle" onClick={() => persistMonth({publish:false})}><Save size={16}/> Save Draft</button>
            <button className="button gold" onClick={() => persistMonth({publish:true})}><Send size={16}/> Publish Update</button>
            <button className="button green" onClick={() => persistMonth({publish:true,close:true})}>Close Month</button>
          </div>
        </header>

        {message && <div className="notice-bar">{message}</div>}

        <section className="admin-summary-grid">
          <Summary icon={<BarChart3/>} label="Portfolio MTD" value={formatPercent(metrics.portfolioReturn)} tone="blue"/>
          <Summary icon={<BarChart3/>} label="Benchmark MTD" value={formatPercent(metrics.benchmarkReturn)} tone="gold"/>
          <Summary icon={<BarChart3/>} label="Monthly Alpha" value={formatPercent(metrics.alpha)} tone={metrics.alpha >= 0 ? "green" : "red"}/>
          <Summary icon={<Users/>} label="Registered Users" value={String(members.filter((m) => !m.is_admin).length)} tone="neutral"/>
          <Summary icon={<Mail/>} label="Newsletter Opt-ins" value={String(newsletterMembers.length)} tone="neutral"/>
        </section>

        <section className="admin-workspace">
          <div className="panel padded">
            <div className="panel-heading no-border"><div><h2>Month & Public Update</h2><p>This text appears in the member dashboard.</p></div></div>
            <div className="admin-form-grid">
              <label>Month<input type="month" value={form.month_key} onChange={(e) => setForm({...form,month_key:e.target.value})}/></label>
              <label>Strategy Name<input value={form.strategy_name} onChange={(e) => setForm({...form,strategy_name:e.target.value})}/></label>
              <label>EGX30 Capped Open<input type="number" step=".01" value={form.benchmark_open} onChange={(e) => setForm({...form,benchmark_open:Number(e.target.value)})}/></label>
              <label>EGX30 Capped Latest<input type="number" step=".01" value={form.benchmark_close} onChange={(e) => setForm({...form,benchmark_close:Number(e.target.value)})}/></label>
              <label className="wide">Update Title<input value={form.update_title || ""} onChange={(e) => setForm({...form,update_title:e.target.value})} placeholder="July Strategy Update"/></label>
              <label className="wide">Public Commentary<textarea value={form.public_commentary || ""} onChange={(e) => setForm({...form,public_commentary:e.target.value})} placeholder="Explain what happened this month."/></label>
              <label className="wide">Monthly Objective<textarea value={form.monthly_objective || ""} onChange={(e) => setForm({...form,monthly_objective:e.target.value})}/></label>
              <label>Guidance Title<input value={form.investor_guidance_title || ""} onChange={(e) => setForm({...form,investor_guidance_title:e.target.value})}/></label>
              <label className="wide">Investor Guidance<textarea value={form.investor_guidance || ""} onChange={(e) => setForm({...form,investor_guidance:e.target.value})}/></label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div><h2>Five-Stock Portfolio</h2><p>Enter official month-open and latest close prices.</p></div>
              <button className="button subtle compact" onClick={equalise}>Equalise Weights</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Ticker</th><th>Weight</th><th>Month Open</th><th>Latest Close</th><th>Return</th><th>Contribution</th></tr></thead>
                <tbody>
                  {form.holdings.map((holding,index) => {
                    const calculated = metrics.rows[index] || {};
                    return (
                      <tr key={holding.id || holding.local_id}>
                        <td><input className="admin-table-input ticker" value={holding.ticker} onChange={(e) => updateHolding(index,"ticker",e.target.value)}/></td>
                        <td><input className="admin-table-input" type="number" step=".01" value={holding.weight} onChange={(e) => updateHolding(index,"weight",e.target.value)}/></td>
                        <td><input className="admin-table-input" type="number" step=".01" value={holding.open_price} onChange={(e) => updateHolding(index,"open_price",e.target.value)}/></td>
                        <td><input className="admin-table-input" type="number" step=".01" value={holding.close_price} onChange={(e) => updateHolding(index,"close_price",e.target.value)}/></td>
                        <td className={calculated.mtd >= 0 ? "blue-text" : "red-text"}>{formatPercent(calculated.mtd)}</td>
                        <td className={calculated.contribution >= 0 ? "green-text" : "red-text"}>{formatPercent(calculated.contribution)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel padded">
            <div className="panel-heading no-border">
              <div><h2>Decision Log</h2><p>Record every removed and added stock with the real reason.</p></div>
              <button className="button subtle compact" onClick={() => setForm({...form, swaps:[...form.swaps,{local_id:crypto.randomUUID(),removed_ticker:"",added_ticker:"",reason:""}]})}>
                <Plus size={14}/> Add Change
              </button>
            </div>
            <div className="swap-editor">
              {form.swaps.map((swap,index) => (
                <div className="swap-editor-row" key={swap.id || swap.local_id}>
                  <input placeholder="Removed" value={swap.removed_ticker} onChange={(e) => changeSwap(setForm,form,index,"removed_ticker",e.target.value.toUpperCase())}/>
                  <span>→</span>
                  <input placeholder="Added" value={swap.added_ticker} onChange={(e) => changeSwap(setForm,form,index,"added_ticker",e.target.value.toUpperCase())}/>
                  <input className="reason" placeholder="Why did the portfolio change?" value={swap.reason || ""} onChange={(e) => changeSwap(setForm,form,index,"reason",e.target.value)}/>
                  <button className="icon-button" onClick={() => setForm({...form,swaps:form.swaps.filter((_,i) => i !== index)})}><X size={15}/></button>
                </div>
              ))}
              {!form.swaps.length && <p className="muted-copy">No changes logged for this month.</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div><h2>Free Member Audience</h2><p>Users who registered to follow ALPHA CORE.</p></div>
              <span className="status-badge live">{newsletterMembers.length} NEWSLETTER</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Newsletter</th><th>Joined</th></tr></thead>
                <tbody>
                  {members.filter((member) => !member.is_admin).slice(0,20).map((member) => (
                    <tr key={member.id}>
                      <td>{member.full_name || "—"}</td>
                      <td>{member.email}</td>
                      <td className={member.newsletter_opt_in ? "green-text" : "muted-copy"}>{member.newsletter_opt_in ? "Yes" : "No"}</td>
                      <td>{new Date(member.created_at).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function normalise(month) {
  return {
    ...month,
    holdings: [...(month.holdings || [])].sort((a,b) => Number(a.sort_order) - Number(b.sort_order)),
    swaps: month.swaps || [],
    snapshots: month.snapshots || [],
  };
}

function changeSwap(setForm, form, index, field, value) {
  setForm({
    ...form,
    swaps: form.swaps.map((swap,i) => i === index ? {...swap,[field]:value} : swap),
  });
}

function Summary({ icon, label, value, tone }) {
  return (
    <article className={`admin-summary ${tone}`}>
      <span>{icon}</span>
      <div><small>{label}</small><b>{value}</b></div>
    </article>
  );
}
