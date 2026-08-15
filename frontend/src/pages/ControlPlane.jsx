import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import {
  ShieldCheck, Activity, Clock3, CheckCircle2,
  XCircle, LockKeyhole, Database, AlertTriangle
} from "lucide-react";

const RISK_META = {
  R0: "Routine",
  R1: "Sensitive",
  R2: "High Risk",
  R3: "Critical",
};

export default function ControlPlane() {
  const [overview, setOverview] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [requests, setRequests] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [tab, setTab] = useState("overview");

  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api.get("/control/overview"),
        api.get("/control/policy"),
        api.get("/control/requests"),
        api.get("/control/evidence?limit=100"),
      ]);
      setOverview(a.data);
      setPolicy(b.data);
      setRequests(c.data.items || []);
      setEvidence(d.data.items || []);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  useEffect(() => { load(); }, []);

  if (!overview || !policy) {
    return <div className="text-sm text-zinc-500">Memuat OKKAX Control Plane...</div>;
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6" data-testid="control-plane">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <ShieldCheck size={15} />
          Platform Governance
        </div>
        <h1 className="editorial mt-2 text-2xl sm:text-4xl">OKKAX Control Plane</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Otoritas platform, risiko, approval, keamanan, dan bukti governance dalam satu control room.
        </p>
      </div>

      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Pending approvals", overview.requests.pending, Clock3],
          ["Approved", overview.requests.approved, CheckCircle2],
          ["Rejected", overview.requests.rejected, XCircle],
          ["Active sessions", overview.security.active_sessions, Activity],
          ["Evidence", overview.evidence_count, Database],
        ].map(([label, value, Icon]) => (
          <div key={label} className="bg-[var(--okx-surface)] p-4">
            <Icon size={16} className="text-zinc-500" />
            <div className="mt-3 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
            <div className="num mt-1 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(policy.risk_levels).map(([risk, meta]) => (
          <div key={risk} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
            <div className="flex items-center justify-between">
              <span className="num text-lg font-bold">{risk}</span>
              {risk === "R3" && <AlertTriangle size={16} className="accent-text" />}
            </div>
            <div className="mt-1 text-sm font-medium">{meta.label}</div>
            <div className="mt-2 text-xs text-zinc-500">
              Approval {meta.approval_required ? "wajib" : "tidak wajib"}
              {" · "}
              Fresh auth {meta.fresh_auth_required ? "wajib" : "tidak wajib"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--okx-border)]">
        {["overview", "approvals", "domains", "evidence"].map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`px-3 py-2 text-sm ${
              tab === name
                ? "border-b-2 border-[var(--okx-accent)] accent-text"
                : "text-zinc-400"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border border-[var(--okx-border)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Risk Distribution
            </h2>
            <div className="mt-4 space-y-3">
              {Object.entries(overview.requests.by_risk).map(([risk, count]) => (
                <div key={risk} className="flex items-center justify-between border-b border-[var(--okx-border)] pb-2">
                  <div>
                    <span className="num font-semibold">{risk}</span>
                    <span className="ml-2 text-xs text-zinc-500">{RISK_META[risk]}</span>
                  </div>
                  <span className="num">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[var(--okx-border)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Governance State
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Control domains</span><span className="num">{policy.domains.length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Registered actions</span><span className="num">{Object.keys(policy.actions).length}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Suspended accounts</span><span className="num">{overview.security.suspended_accounts}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Fresh auth window</span><span className="num">{policy.fresh_auth_minutes} menit</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === "approvals" && (
        <div className="border border-[var(--okx-border)]">
          <div className="hairline p-3 text-sm font-semibold">
            Pending approvals ({pending.length})
          </div>
          {pending.map((r) => (
            <div key={r.id} className="border-b border-[var(--okx-border)] p-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{r.action}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {r.requester_email} · {r.target_type}:{r.target_id}
                  </div>
                </div>
                <span className="num border border-[var(--okx-border)] px-2 py-1 text-xs">
                  {r.risk}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{r.reason}</p>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Tidak ada approval tertunda.
            </div>
          )}
        </div>
      )}

      {tab === "domains" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {policy.domains.map((domain) => (
            <div key={domain} className="border border-[var(--okx-border)] p-4">
              <LockKeyhole size={15} className="text-zinc-500" />
              <div className="mt-3 text-sm font-medium">
                {domain.replace(/_/g, " ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "evidence" && (
        <div className="border border-[var(--okx-border)]">
          {evidence.map((e) => (
            <div key={e.id} className="border-b border-[var(--okx-border)] p-3 text-xs last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.action}</span>
                <span className="num">{e.risk}</span>
              </div>
              <div className="mt-1 text-zinc-500">
                {e.actor_email || "system"} · {e.outcome} · {String(e.created_at).slice(0, 19).replace("T", " ")}
              </div>
            </div>
          ))}
          {evidence.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Belum ada governance evidence.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
