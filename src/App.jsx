import { useState, useEffect } from "react";

// ─── Cron Parser & Next-Run Calculator ───────────────────────────────────────

function parsePart(part, min, max) {
  if (part === "*") return null;
  if (part.startsWith("*/")) {
    const step = parseInt(part.slice(2));
    const vals = [];
    for (let i = min; i <= max; i += step) vals.push(i);
    return vals;
  }
  if (part.includes(",")) return part.split(",").map(Number);
  if (part.includes("-")) {
    const [a, b] = part.split("-").map(Number);
    const vals = [];
    for (let i = a; i <= b; i++) vals.push(i);
    return vals;
  }
  return [parseInt(part)];
}

function getNextRuns(expr, count = 5) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minP, hourP, domP, monP, dowP] = parts;
  try {
    const minutes = parsePart(minP, 0, 59);
    const hours   = parsePart(hourP, 0, 23);
    const doms    = parsePart(domP, 1, 31);
    const months  = parsePart(monP, 1, 12);
    const dows    = parsePart(dowP, 0, 6);

    const results = [];
    const now = new Date(); now.setSeconds(0, 0);
    let d = new Date(now.getTime() + 60000);
    const limit = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 366);

    while (results.length < count && d < limit) {
      const mo = d.getMonth() + 1, dom = d.getDate(), dow = d.getDay(),
            hr = d.getHours(), mn = d.getMinutes();
      if (months && !months.includes(mo)) { d = new Date(d.getTime() + 864e5); d.setHours(0,0,0,0); continue; }
      if (doms   && !doms.includes(dom))  { d = new Date(d.getTime() + 864e5); d.setHours(0,0,0,0); continue; }
      if (dows   && !dows.includes(dow))  { d = new Date(d.getTime() + 864e5); d.setHours(0,0,0,0); continue; }
      if (hours  && !hours.includes(hr))  { d = new Date(d.getTime() + 36e5);  d.setMinutes(0,0,0); continue; }
      if (minutes && !minutes.includes(mn)) { d = new Date(d.getTime() + 60000); continue; }
      results.push(new Date(d));
      d = new Date(d.getTime() + 60000);
    }
    return results;
  } catch { return []; }
}

function toEnglish(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";
  const [min, hour, dom, mon, dow] = parts;
  const monthNames = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dowNames   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let desc = "Runs ";
  if (min === "*" && hour === "*") desc += "every minute";
  else if (min.startsWith("*/") && hour === "*") desc += `every ${min.slice(2)} minutes`;
  else if (hour.startsWith("*/") && min === "0") desc += `every ${hour.slice(2)} hours`;
  else if (min !== "*" && hour !== "*") {
    const h = parseInt(hour), m = parseInt(min);
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    desc += `at ${hh}:${m.toString().padStart(2,"0")} ${ampm}`;
  } else if (hour !== "*" && min === "*") desc += `every minute during hour ${hour}`;
  else desc += `at minute ${min}`;
  if (dow !== "*") {
    if (dow === "1-5") desc += ", Monday to Friday";
    else if (dow === "6,0" || dow === "0,6") desc += ", on weekends";
    else desc += `, on ${dow.split(",").map(d => dowNames[parseInt(d)]).join(", ")}`;
  }
  if (dom !== "*" && dow === "*") desc += `, on day ${dom} of the month`;
  if (mon !== "*") desc += `, in ${mon.split(",").map(m => monthNames[parseInt(m)]).join(", ")}`;
  if (dom === "*" && dow === "*" && mon === "*" && !(min === "*" || min.startsWith("*/"))) desc += ", every day";
  return desc;
}

// ─── AI Conversion — calls Netlify function (keeps API key secret) ────────────

async function aiConvert(input, direction) {
  const systemPrompt = direction === "en2cron"
    ? `You are a cron expression expert. Convert natural language schedule descriptions to cron expressions.
       Respond with ONLY a JSON object: {"cron": "X X X X X", "explanation": "brief one-line explanation"}
       The cron field must be exactly 5 space-separated fields (min hour dom month dow).
       No markdown, no backticks, just raw JSON.`
    : `You are a cron expression expert. Convert cron expressions to plain English descriptions.
       Respond with ONLY a JSON object: {"english": "plain English description of the schedule"}
       Make it clear, concise, and human-friendly. No markdown, no backticks, just raw JSON.`;

  const userMsg = direction === "en2cron"
    ? `Convert this to a cron expression: "${input}"`
    : `Explain this cron expression in plain English: "${input}"`;

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Every minute",          expr: "* * * * *" },
  { label: "Every 5 minutes",       expr: "*/5 * * * *" },
  { label: "Every hour",            expr: "0 * * * *" },
  { label: "Every day 9 AM",        expr: "0 9 * * *" },
  { label: "Every Monday 8 AM",     expr: "0 8 * * 1" },
  { label: "Weekdays noon",         expr: "0 12 * * 1-5" },
  { label: "Every Sunday midnight", expr: "0 0 * * 0" },
  { label: "1st of month",          expr: "0 0 1 * *" },
  { label: "Every 6 hours",         expr: "0 */6 * * *" },
  { label: "Twice daily",           expr: "0 9,18 * * *" },
];

const FIELDS = [
  { key: 0, label: "Minute",      hint: "0–59" },
  { key: 1, label: "Hour",        hint: "0–23" },
  { key: 2, label: "Day (Month)", hint: "1–31" },
  { key: 3, label: "Month",       hint: "1–12" },
  { key: 4, label: "Day (Week)",  hint: "0=Sun" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CronBuilder() {
  const [parts, setParts]               = useState(["0", "9", "*", "*", "*"]);
  const [rawInput, setRawInput]         = useState("0 9 * * *");
  const [copied, setCopied]             = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [aiMode, setAiMode]             = useState("en2cron");
  const [aiInput, setAiInput]           = useState("");
  const [aiResult, setAiResult]         = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState("");

  const expr     = parts.join(" ");
  const english  = toEnglish(expr);
  const nextRuns = getNextRuns(expr);
  const isValid  = nextRuns.length > 0;

  useEffect(() => { setRawInput(expr); }, [expr]);
  useEffect(() => { setAiResult(null); setAiError(""); setAiInput(""); }, [aiMode]);

  function handleRawChange(val) {
    setRawInput(val);
    const p = val.trim().split(/\s+/);
    if (p.length === 5) { setParts(p); setActivePreset(null); }
  }

  function handlePartChange(i, val) {
    const next = [...parts]; next[i] = val || "*";
    setParts(next); setActivePreset(null);
  }

  function applyPreset(p, idx) {
    setParts(p.expr.split(" ")); setActivePreset(idx);
  }

  function copyExpr() {
    navigator.clipboard.writeText(expr).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleAiConvert() {
    if (!aiInput.trim()) return;
    setAiLoading(true); setAiError(""); setAiResult(null);
    try {
      const result = await aiConvert(aiInput.trim(), aiMode);
      if (!result) throw new Error("parse failed");
      setAiResult(result);
      if (result.cron) {
        const p = result.cron.trim().split(/\s+/);
        if (p.length === 5) { setParts(p); setActivePreset(null); }
      }
    } catch {
      setAiError("Something went wrong. Try rephrasing your input.");
    }
    setAiLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiConvert(); }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#f5f0e8",
      fontFamily: "'IBM Plex Mono', monospace",
      padding: "2rem 1rem", display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        input, textarea { font-family: 'IBM Plex Mono', monospace; }
        .field-input {
          width: 100%; background: #fff; border: 2px solid #d4c9b0;
          border-radius: 6px; padding: 10px 12px; font-size: 0.9rem; color: #2c2416;
          transition: border-color 0.15s;
        }
        .field-input:focus { outline: none; border-color: #c8541a; }
        .preset-btn {
          border: 1.5px solid #d4c9b0; background: #fff; border-radius: 6px;
          padding: 7px 12px; font-family: 'IBM Plex Mono', monospace;
          font-size: 0.72rem; cursor: pointer; transition: all 0.15s;
          color: #6b5c44; white-space: nowrap;
        }
        .preset-btn:hover { border-color: #c8541a; color: #c8541a; background: #fff8f3; }
        .preset-btn.active { background: #c8541a; border-color: #c8541a; color: #fff; }
        .card { background: #fff; border: 1.5px solid #e0d8c8; border-radius: 12px; padding: 1.5rem; }
        .run-row {
          display: flex; align-items: center; gap: 1rem;
          padding: 10px 0; border-bottom: 1px dashed #e8e0d0; font-size: 0.8rem;
        }
        .run-row:last-child { border-bottom: none; }
        .ai-box { background: #0d0f14; border: 1.5px solid #2a2f3e; border-radius: 12px; padding: 1.5rem; }
        .ai-textarea {
          width: 100%; background: #0d0f14; border: 2px solid #2a2f3e;
          border-radius: 8px; padding: 12px 14px; color: #e2e8f0;
          font-size: 0.88rem; resize: none; line-height: 1.6; transition: border-color 0.15s;
        }
        .ai-textarea:focus { outline: none; border-color: #c8541a; }
        .ai-textarea::placeholder { color: #2e3447; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .dot1 { animation: blink 1.1s ease infinite; }
        .dot2 { animation: blink 1.1s ease infinite 0.2s; }
        .dot3 { animation: blink 1.1s ease infinite 0.4s; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: "#c8541a", marginBottom: "0.5rem", textTransform: "uppercase" }}>
          Developer Utility
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900,
          color: "#1a1208", margin: 0, lineHeight: 1.1,
        }}>
          Cron Expression<br /><span style={{ color: "#c8541a" }}>Builder</span>
        </h1>
        <p style={{ color: "#8c7a60", fontSize: "0.8rem", marginTop: "0.6rem" }}>
          Build, understand & preview your cron schedule
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: "680px", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* ── AI Converter ── */}
        <div className="ai-box">
          <div style={{ marginBottom: "1.1rem" }}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.22em", color: "#c8541a", marginBottom: "0.75rem" }}>✦ AI ASSISTANT</div>
            {/* Toggle */}
            <div style={{
              display: "inline-flex", background: "#161920",
              border: "1px solid #2a2f3e", borderRadius: "8px", padding: "3px", gap: "3px",
            }}>
              {[
                { value: "en2cron", label: "English → Cron" },
                { value: "cron2en", label: "Cron → English" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAiMode(opt.value)}
                  style={{
                    background: aiMode === opt.value ? "#c8541a" : "transparent",
                    color: aiMode === opt.value ? "#fff" : "#6b7280",
                    border: "none", borderRadius: "6px",
                    padding: "7px 16px", cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "0.75rem", fontWeight: 600,
                    transition: "all 0.18s", whiteSpace: "nowrap",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="ai-textarea"
            rows={2}
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiMode === "en2cron"
              ? "e.g. \"every weekday at 8:30 AM\"\nor \"every 15 mins during business hours\""
              : "e.g. \"*/15 9-17 * * 1-5\"\nor \"0 0 1 * *\""
            }
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.62rem", color: "#2e3447" }}>↵ Enter to convert</div>
            <button
              onClick={handleAiConvert}
              disabled={aiLoading || !aiInput.trim()}
              style={{
                background: (aiLoading || !aiInput.trim()) ? "#161920" : "#c8541a",
                color: (aiLoading || !aiInput.trim()) ? "#3a4055" : "#fff",
                border: "none", borderRadius: "6px", padding: "9px 22px",
                cursor: (aiLoading || !aiInput.trim()) ? "not-allowed" : "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "0.78rem", fontWeight: 600, transition: "all 0.15s",
                minWidth: "110px", textAlign: "center",
              }}>
              {aiLoading
                ? <><span className="dot1">●</span><span className="dot2">●</span><span className="dot3">●</span></>
                : "Convert →"}
            </button>
          </div>

          {aiError && (
            <div style={{ marginTop: "1rem", color: "#f87171", fontSize: "0.78rem", background: "#1a0f0f", borderRadius: "6px", padding: "10px 14px", border: "1px solid #7f1d1d" }}>
              ⚠ {aiError}
            </div>
          )}

          {aiResult && !aiError && (
            <div style={{ marginTop: "1rem", background: "#161920", border: "1px solid #2a2f3e", borderRadius: "8px", padding: "1rem 1.25rem" }}>
              {aiResult.cron && (
                <>
                  <div style={{ fontSize: "0.62rem", color: "#3a4055", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>GENERATED CRON EXPRESSION</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#4ade80", letterSpacing: "0.12em" }}>{aiResult.cron}</div>
                  {aiResult.explanation && (
                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.4rem", lineHeight: 1.5 }}>{aiResult.explanation}</div>
                  )}
                  <button
                    onClick={() => { const p = aiResult.cron.trim().split(/\s+/); if (p.length === 5) { setParts(p); setActivePreset(null); }}}
                    style={{
                      marginTop: "0.85rem", background: "#c8541a", color: "#fff",
                      border: "none", borderRadius: "6px", padding: "8px 18px",
                      cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "0.75rem", fontWeight: 600,
                    }}>
                    ↑ Apply to Builder
                  </button>
                </>
              )}
              {aiResult.english && (
                <>
                  <div style={{ fontSize: "0.62rem", color: "#3a4055", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>PLAIN ENGLISH</div>
                  <div style={{ fontSize: "0.95rem", color: "#e2e8f0", lineHeight: 1.65 }}>{aiResult.english}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Cron Expression Input ── */}
        <div className="card">
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#8c7a60", marginBottom: "0.75rem" }}>CRON EXPRESSION</div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input
              value={rawInput}
              onChange={e => handleRawChange(e.target.value)}
              className="field-input"
              style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.1em", flex: 1 }}
              spellCheck={false}
            />
            <button onClick={copyExpr} style={{
              background: copied ? "#2d6a2d" : "#c8541a", color: "#fff",
              border: "none", borderRadius: "6px", padding: "10px 16px", cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem",
              fontWeight: 600, whiteSpace: "nowrap", transition: "background 0.2s",
            }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#b0a090", marginTop: "0.5rem" }}>MIN · HOUR · DOM · MON · DOW</div>
        </div>

        {/* ── Plain English ── */}
        <div style={{
          background: isValid ? "#1a1208" : "#3d1a1a", borderRadius: "10px",
          padding: "1.25rem 1.5rem", border: `1.5px solid ${isValid ? "#3d2e14" : "#7f2020"}`,
        }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: isValid ? "#c8541a" : "#f87171", marginBottom: "0.4rem" }}>
            {isValid ? "▶ PLAIN ENGLISH" : "⚠ INVALID EXPRESSION"}
          </div>
          <div style={{ color: isValid ? "#f5f0e8" : "#fca5a5", fontSize: "1rem", fontWeight: 500, lineHeight: 1.5 }}>
            {english}
          </div>
        </div>

        {/* ── Visual Editor ── */}
        <div className="card">
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#8c7a60", marginBottom: "1rem" }}>VISUAL EDITOR</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem" }}>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: "0.65rem", color: "#8c7a60", marginBottom: "0.35rem", letterSpacing: "0.1em" }}>{f.label}</div>
                <input
                  value={parts[f.key]}
                  onChange={e => handlePartChange(f.key, e.target.value)}
                  className="field-input"
                  style={{ textAlign: "center", fontWeight: 600 }}
                  placeholder={f.hint}
                />
                <div style={{ fontSize: "0.6rem", color: "#b0a090", marginTop: "0.25rem", textAlign: "center" }}>{f.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Presets ── */}
        <div className="card">
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#8c7a60", marginBottom: "1rem" }}>COMMON PRESETS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {PRESETS.map((p, i) => (
              <button key={i} className={`preset-btn ${activePreset === i ? "active" : ""}`} onClick={() => applyPreset(p, i)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Next 5 Runs ── */}
        <div className="card">
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#8c7a60", marginBottom: "1rem" }}>NEXT 5 SCHEDULED RUNS</div>
          {nextRuns.length === 0
            ? <div style={{ color: "#c0a882", fontSize: "0.85rem" }}>— no upcoming runs found (check expression)</div>
            : nextRuns.map((d, i) => {
                const diff = d - new Date(), mins = Math.floor(diff / 60000),
                      hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
                const relative = mins < 60 ? `in ${mins}m` : hrs < 24 ? `in ${hrs}h ${mins % 60}m` : `in ${days}d ${hrs % 24}h`;
                return (
                  <div key={i} className="run-row">
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: i === 0 ? "#c8541a" : "#e8e0d0",
                      color: i === 0 ? "#fff" : "#8c7a60",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, color: "#2c2416", fontWeight: i === 0 ? 600 : 400 }}>
                      {d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: i === 0 ? "#c8541a" : "#a09080", fontWeight: i === 0 ? 600 : 400 }}>{relative}</div>
                  </div>
                );
              })}
        </div>

        <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#b0a090", paddingBottom: "1rem" }}>
          Supports{" "}
          {["*", "*/n", "a-b", "a,b,c"].map(s => (
            <code key={s} style={{ background: "#e8e0d0", padding: "1px 5px", borderRadius: "3px", margin: "0 3px" }}>{s}</code>
          ))}
        </div>
      </div>
    </div>
  );
}
