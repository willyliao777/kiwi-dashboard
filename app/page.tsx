"use client";

import { useState, useEffect, useCallback } from "react";

// ── colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bright:  "#5a8a00",
  flesh:   "#4a7200",
  warm:    "#1a1a08",
  card:    "#eeeade",
  card2:   "#faf8f2",
  border:  "rgba(74,114,0,0.22)",
  border2: "rgba(74,114,0,0.12)",
};

const KIND_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  OUTPUT_HIJACK:       { text: "#e879f9", bg: "rgba(232,121,249,0.10)", border: "rgba(232,121,249,0.30)" },
  INDIRECT_INJECTION:  { text: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.30)" },
  COMMAND_INJECTION:   { text: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)" },
  SCRIPT_TAG:          { text: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.30)" },
  BRACE_OVERRIDE:      { text: "#facc15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.30)" },
  HIDDEN_CHARACTER:    { text: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.30)" },
  HOMOGLYPH_ATTACK:    { text: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.30)" },
  SPECIAL_TOKEN:       { text: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.30)" },
  CODE_FENCE_INJECTION:{ text: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.30)" },
};

const LAYER_LABEL: Record<string, string> = {
  user_input:  "L2 · User Input",
  rag:         "L3 · RAG",
  tool_output: "L3 · Tool",
  llm_output:  "L4 · LLM Output",
};

// ── types ─────────────────────────────────────────────────────────────────────
interface Threat      { kind: string; charPos: number; raw: string; }
interface ThreatEvent {
  id: string;
  agentId: string;
  layer: string;
  threats: Threat[];
  sanitized: string;
  isSuspicious: boolean;
  meta?: { toolName?: string; originalTask?: string };
  timestamp: number;
}
interface Stats {
  total: number;
  today: number;
  thisHour: number;
  activeAgents: number;
  allAgents: { id: string; lastSeen: number }[];
  byKind: Record<string, number>;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 5000)     return "just now";
  if (d < 60000)    return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function topKind(byKind: Record<string, number>): string {
  const entries = Object.entries(byKind).filter(([, v]) => v > 0);
  if (!entries.length) return "—";
  return entries.sort((a, b) => b[1] - a[1])[0][0].replace(/_/g, " ");
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{ background: C.card2, borderColor: accent ? `${C.flesh}50` : C.border }}
      className="rounded-2xl border p-5 flex flex-col gap-1">
      <div style={{ color: `${C.warm}35` }} className="text-xs uppercase tracking-widest">{label}</div>
      <div style={{ color: accent ? C.bright : C.warm }} className="text-3xl font-black tabular-nums">{value}</div>
      {sub && <div style={{ color: `${C.warm}35` }} className="text-xs">{sub}</div>}
    </div>
  );
}

// ── Kind Badge ────────────────────────────────────────────────────────────────
function KindBadge({ kind }: { kind: string }) {
  const c = KIND_COLOR[kind] ?? { text: `${C.warm}60`, bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.15)" };
  return (
    <span style={{ color: c.text, background: c.bg, borderColor: c.border }}
      className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap">
      {kind.replace(/_/g, "_​")}
    </span>
  );
}

// ── Threat Row ────────────────────────────────────────────────────────────────
function ThreatRow({ event, isNew }: { event: ThreatEvent; isNew: boolean }) {
  const mainThreat = event.threats[0];
  const extra = event.threats.length - 1;

  return (
    <div
      style={{
        borderColor: C.border2,
        background: isNew ? "rgba(141,182,0,0.04)" : "transparent",
        transition: "background 1.5s ease",
      }}
      className="grid grid-cols-[90px_1fr_110px_160px] gap-4 items-center px-4 py-3 border-b text-sm">

      <div style={{ color: `${C.warm}35` }} className="text-xs font-mono tabular-nums">
        {timeAgo(event.timestamp)}
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: C.warm }} className="font-semibold truncate">{event.agentId}</span>
          {extra > 0 && (
            <span style={{ color: `${C.warm}35`, background: `${C.flesh}15`, borderColor: `${C.flesh}30` }}
              className="text-xs px-1.5 py-0.5 rounded border">
              +{extra} more
            </span>
          )}
        </div>
        {mainThreat && (
          <div style={{ color: `${C.warm}40` }} className="text-xs font-mono truncate">
            └─ {mainThreat.raw.slice(0, 60)}{mainThreat.raw.length > 60 ? "…" : ""}
          </div>
        )}
      </div>

      <div style={{ color: `${C.warm}40` }} className="text-xs font-mono">
        {LAYER_LABEL[event.layer] ?? event.layer}
      </div>

      <div className="flex flex-wrap gap-1 justify-end">
        {event.threats.slice(0, 2).map((t, i) => <KindBadge key={i} kind={t.kind} />)}
      </div>
    </div>
  );
}

// ── Agent Health ──────────────────────────────────────────────────────────────
function AgentHealth({ agents }: { agents: { id: string; lastSeen: number }[] }) {
  if (!agents.length) {
    return (
      <div style={{ color: `${C.warm}30` }} className="text-xs text-center py-6">
        No agents yet. Send your first event to see agents here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {agents.map(a => {
        const isActive = Date.now() - a.lastSeen < 5 * 60 * 1000;
        return (
          <div key={a.id}
            style={{ borderColor: C.border2 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg border">
            <div className="flex items-center gap-2">
              <span style={{ color: isActive ? C.bright : `${C.warm}25` }} className="text-xs pulse-dot">●</span>
              <span style={{ color: C.warm }} className="text-sm font-mono truncate max-w-[120px]">{a.id}</span>
            </div>
            <span style={{ color: `${C.warm}30` }} className="text-xs">{timeAgo(a.lastSeen)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Kind Breakdown ────────────────────────────────────────────────────────────
function KindBreakdown({ byKind }: { byKind: Record<string, number> }) {
  const entries = Object.entries(byKind)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const max = entries[0]?.[1] ?? 1;

  if (!entries.length) {
    return (
      <div style={{ color: `${C.warm}30` }} className="text-xs text-center py-6">
        No threats yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([kind, count]) => {
        const c = KIND_COLOR[kind] ?? { text: `${C.warm}50`, bg: "transparent", border: "transparent" };
        const pct = Math.round((count / max) * 100);
        return (
          <div key={kind} className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span style={{ color: c.text }} className="text-xs font-mono">{kind.replace(/_/g, " ")}</span>
              <span style={{ color: `${C.warm}40` }} className="text-xs tabular-nums">{count}</span>
            </div>
            <div style={{ background: `${C.flesh}15` }} className="h-1 rounded-full overflow-hidden">
              <div style={{ width: `${pct}%`, background: c.text, transition: "width 0.5s ease" }}
                className="h-full rounded-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SDK Snippet ───────────────────────────────────────────────────────────────
function SDKSnippet({ apiUrl }: { apiUrl: string }) {
  const [copied, setCopied] = useState(false);
  const code = `import kiwi, requests

DASHBOARD = "${apiUrl}/api/ingest"
API_KEY   = "your-kiwi-api-key"

def report(agent_id, layer, result):
    if not result.is_suspicious:
        return
    requests.post(DASHBOARD,
        headers={"x-api-key": API_KEY},
        json={
            "agentId":     agent_id,
            "layer":       layer,
            "threats":     [{"kind": t.kind, "charPos": t.char_pos, "raw": t.raw}
                            for t in result.threats],
            "sanitized":   result.sanitized,
            "isSuspicious": result.is_suspicious,
        }, timeout=2)

# Usage
result = kiwi.scan_tool_output("web_search", tool_output)
report("my-agent-prod", "tool_output", result)`;

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ background: C.card2, borderColor: C.border }} className="rounded-2xl border overflow-hidden">
      <div style={{ borderColor: C.border }} className="flex items-center justify-between px-4 py-3 border-b">
        <span style={{ color: `${C.warm}50` }} className="text-xs font-semibold uppercase tracking-widest">
          SDK Integration — Python
        </span>
        <button onClick={copy}
          style={{ color: copied ? C.bright : `${C.warm}40`, borderColor: C.border }}
          className="text-xs border px-3 py-1 rounded-lg transition-colors cursor-pointer">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre style={{ color: `${C.warm}75`, overflowX: "auto" }}
        className="text-xs font-mono p-4 leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

// ── Key Management ───────────────────────────────────────────────────────────
interface ApiKey { id: string; name: string; createdAt: number; active: boolean; key: string; }

function KeyManager() {
  const [adminKey, setAdminKey]   = useState("");
  const [unlocked, setUnlocked]   = useState(false);
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [newName, setNewName]     = useState("");
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function unlock() {
    setLoading(true); setError("");
    const res = await fetch("/api/keys", { headers: { "x-admin-key": adminKey } });
    if (res.ok) { setKeys(await res.json()); setUnlocked(true); }
    else setError("Wrong admin key");
    setLoading(false);
  }

  async function create() {
    if (!newName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setNewKey(data.key);
    setKeys(prev => [{ id: data.id, name: newName.trim(), createdAt: Date.now(), active: true, key: data.key }, ...prev]);
    setNewName("");
    setLoading(false);
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE", headers: { "x-admin-key": adminKey } });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, active: false } : k));
    if (newKey) setNewKey(null);
  }

  return (
    <div style={{ background: C.card2, borderColor: C.border }} className="rounded-2xl border overflow-hidden">
      <div style={{ borderColor: C.border }} className="px-4 py-3 border-b flex items-center gap-2">
        <span style={{ color: C.warm }} className="font-semibold">API Key 管理</span>
        {unlocked && <span style={{ color: C.bright, background: `${C.flesh}15`, borderColor: `${C.flesh}40` }}
          className="text-xs px-2 py-0.5 rounded-full border font-semibold">已解鎖</span>}
      </div>

      <div className="p-4">
        {!unlocked ? (
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="輸入 Admin Key 解鎖"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && unlock()}
              style={{ background: C.card, borderColor: C.border, color: C.warm }}
              className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
            />
            <button onClick={unlock} disabled={loading}
              style={{ background: C.flesh, color: C.card2 }}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50">
              {loading ? "…" : "解鎖"}
            </button>
            {error && <span style={{ color: "#f87171" }} className="text-xs self-center">{error}</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* New key just created */}
            {newKey && (
              <div style={{ background: `${C.flesh}12`, borderColor: `${C.flesh}40` }} className="rounded-xl border p-3 flex flex-col gap-1">
                <div style={{ color: C.flesh }} className="text-xs font-semibold">新 Key 已建立 — 請立刻複製，只顯示一次</div>
                <div style={{ color: C.warm, background: C.card, borderColor: C.border }}
                  className="font-mono text-sm px-3 py-2 rounded-lg border break-all">{newKey}</div>
              </div>
            )}

            {/* Create new key */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Key 名稱（例如：prod-agent-1）"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && create()}
                style={{ background: C.card, borderColor: C.border, color: C.warm }}
                className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
              />
              <button onClick={create} disabled={loading || !newName.trim()}
                style={{ background: C.flesh, color: C.card2 }}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50">
                {loading ? "…" : "+ 新增"}
              </button>
            </div>

            {/* Keys list */}
            {keys.length === 0 ? (
              <div style={{ color: `${C.warm}35` }} className="text-xs text-center py-4">還沒有任何 key</div>
            ) : (
              <div className="flex flex-col gap-2">
                {keys.map(k => (
                  <div key={k.id} style={{ borderColor: C.border2 }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span style={{ color: C.warm }} className="text-sm font-semibold truncate">{k.name}</span>
                      <span style={{ color: `${C.warm}40` }} className="text-xs font-mono">
                        {k.key.slice(0, 20)}…
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span style={{ color: k.active ? C.bright : `${C.warm}30` }} className="text-xs font-semibold">
                        {k.active ? "啟用" : "已撤銷"}
                      </span>
                      {k.active && (
                        <button onClick={() => revoke(k.id)}
                          style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.30)" }}
                          className="text-xs border px-2 py-1 rounded-lg cursor-pointer">
                          撤銷
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [events, setEvents]   = useState<ThreatEvent[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [newIds, setNewIds]   = useState<Set<string>>(new Set());
  const [tick, setTick]       = useState(0);
  const [lastPoll, setLastPoll] = useState(0);
  const [apiUrl, setApiUrl]   = useState("");

  useEffect(() => {
    setApiUrl(window.location.origin);
  }, []);

  const poll = useCallback(async () => {
    try {
      const [evRes, stRes] = await Promise.all([
        fetch("/api/events?limit=50"),
        fetch("/api/stats"),
      ]);
      const [newEvents, newStats]: [ThreatEvent[], Stats] = await Promise.all([
        evRes.json(), stRes.json(),
      ]);

      setEvents(prev => {
        const prevIds = new Set(prev.map(e => e.id));
        const fresh = newEvents.filter(e => !prevIds.has(e.id));
        if (fresh.length) {
          setNewIds(ids => {
            const next = new Set(ids);
            fresh.forEach(e => next.add(e.id));
            return next;
          });
          setTimeout(() => {
            setNewIds(ids => {
              const next = new Set(ids);
              fresh.forEach(e => next.delete(e.id));
              return next;
            });
          }, 2000);
        }
        return newEvents;
      });

      setStats(newStats);
      setLastPoll(Date.now());
    } catch { /* network errors are silent */ }
  }, []);

  useEffect(() => { poll(); }, [poll]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) poll();
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [poll]);

  const secondsSince = Math.floor((Date.now() - lastPoll) / 1000);

  return (
    <main style={{ background: C.card, minHeight: "100vh" }}>

      {/* Nav */}
      <nav style={{ borderColor: C.border, background: "#faf8f2ee" }}
        className="border-b sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🥝</span>
            <div>
              <span style={{ color: C.flesh }} className="font-bold text-lg">KIWI</span>
              <span style={{ color: `${C.warm}60` }} className="text-sm ml-2">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ color: `${C.warm}55` }} className="text-xs font-mono hidden sm:block">
              {lastPoll ? `synced ${secondsSince}s ago` : "connecting…"}
            </div>
            <div style={{ color: C.bright, background: `${C.flesh}15`, borderColor: `${C.flesh}40` }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border">
              <span className="pulse-dot">●</span>
              LIVE
            </div>
            <a href="https://github.com/willyliao777/KIWI" target="_blank" rel="noopener noreferrer"
              style={{ color: `${C.warm}45` }}
              className="text-sm hover:text-[#8DB600] transition-colors hidden md:block">
              GitHub →
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Threats" value={(stats?.total ?? 0).toLocaleString()} sub="all time" accent />
          <StatCard label="Today"         value={(stats?.today ?? 0).toLocaleString()}    sub={new Date().toLocaleDateString("en", { month: "short", day: "numeric" })} />
          <StatCard label="This Hour"     value={(stats?.thisHour ?? 0).toLocaleString()} sub="last 60 min" />
          <StatCard label="Active Agents" value={stats?.activeAgents ?? 0}                sub="seen in last 5 min" />
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Threat Feed */}
          <div style={{ background: C.card2, borderColor: C.border }}
            className="flex-1 rounded-2xl border overflow-hidden min-w-0">

            <div style={{ borderColor: C.border }}
              className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <span style={{ color: C.warm }} className="font-semibold">Threat Feed</span>
                {events.length > 0 && (
                  <span style={{ color: `${C.warm}30`, background: `${C.flesh}10`, borderColor: `${C.flesh}25` }}
                    className="text-xs px-2 py-0.5 rounded-full border font-mono">
                    {events.length} events
                  </span>
                )}
              </div>
              <div style={{ color: `${C.warm}25` }} className="text-xs font-mono">
                auto-refresh every 60s
              </div>
            </div>

            {/* Table Header */}
            <div style={{ borderColor: C.border2, color: `${C.warm}25`, background: `${C.flesh}06` }}
              className="grid grid-cols-[90px_1fr_110px_160px] gap-4 px-4 py-2 border-b text-xs uppercase tracking-widest">
              <div>Time</div>
              <div>Agent / Raw</div>
              <div>Layer</div>
              <div className="text-right">Threat Type</div>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-4xl">🥝</div>
                <div style={{ color: `${C.warm}30` }} className="text-sm text-center max-w-xs leading-relaxed">
                  No threats detected yet. Integrate the KIWI SDK and start sending events.
                </div>
              </div>
            ) : (
              <div>
                {events.map(e => (
                  <ThreatRow key={e.id} event={e} isNew={newIds.has(e.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4 w-full lg:w-72 shrink-0">

            {/* Agent Health */}
            <div style={{ background: C.card2, borderColor: C.border }}
              className="rounded-2xl border overflow-hidden">
              <div style={{ borderColor: C.border }}
                className="px-4 py-3 border-b">
                <span style={{ color: C.warm }} className="font-semibold text-sm">Agent Health</span>
              </div>
              <div className="p-3">
                <AgentHealth agents={stats?.allAgents ?? []} />
              </div>
            </div>

            {/* Threat Breakdown */}
            <div style={{ background: C.card2, borderColor: C.border }}
              className="rounded-2xl border overflow-hidden">
              <div style={{ borderColor: C.border }}
                className="px-4 py-3 border-b flex items-center justify-between">
                <span style={{ color: C.warm }} className="font-semibold text-sm">By Threat Type</span>
                {stats && (
                  <span style={{ color: `${C.warm}30` }} className="text-xs">
                    top: {topKind(stats.byKind)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <KindBreakdown byKind={stats?.byKind ?? {}} />
              </div>
            </div>

          </div>
        </div>

        {/* SDK Integration */}
        {apiUrl && <SDKSnippet apiUrl={apiUrl} />}

        {/* Key Management */}
        <KeyManager />

        {/* Footer */}
        <div style={{ color: `${C.warm}45` }} className="text-xs text-center pb-4">
          KIWI Dashboard v0.2 · Built by Willy Liao ·{" "}
          <a href="https://github.com/willyliao777/KIWI"
            style={{ color: `${C.warm}30` }}
            className="hover:text-[#8DB600] transition-colors">
            GitHub
          </a>
        </div>

      </div>
    </main>
  );
}
