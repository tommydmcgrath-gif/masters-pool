"use client";

import { useCallback, useEffect, useState } from "react";
import { PoolLeaderboard, Team, PoolPlayer } from "@/lib/types";

const REFRESH_MS = 60_000;

export default function Home() {
  const [data, setData] = useState<PoolLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json: PoolLeaderboard = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const toggle = (name: string) =>
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ fontSize: 18, color: "var(--text-muted)" }}>
          Loading leaderboard…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ color: "var(--cut-text)", marginBottom: 16 }}>{error}</p>
        <button onClick={fetchData} style={btnStyle}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <main>
      <Header
        data={data!}
        error={error}
        onRefresh={fetchData}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data!.teams.map((team) => (
          <TeamRow
            key={team.name}
            team={team}
            isExpanded={!!expanded[team.name]}
            onToggle={() => toggle(team.name)}
          />
        ))}
      </div>
      <Footer />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  data,
  error,
  onRefresh,
}: {
  data: PoolLeaderboard;
  error: string | null;
  onRefresh: () => void;
}) {
  const updated = new Date(data.lastUpdated);
  const timeStr = updated.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--green-dark)" }}>
            {data.tournamentName}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {data.tournamentRound} &middot; Updated {timeStr}
          </p>
        </div>
        <button onClick={onRefresh} style={btnStyle} title="Refresh now">
          ↻ Refresh
        </button>
      </div>
      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--cut-text)",
            marginTop: 8,
          }}
        >
          Update failed: {error}. Showing last successful data.
        </p>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Team row
// ---------------------------------------------------------------------------

function TeamRow({
  team,
  isExpanded,
  onToggle,
}: {
  team: Team;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Summary bar */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "12px 16px",
          background: "white",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 12,
          fontSize: 15,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            minWidth: 28,
            color: "var(--green-dark)",
          }}
        >
          {team.rank}
        </span>
        <span style={{ flex: 1, fontWeight: 600 }}>{team.name}</span>
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: team.teamScore < 0 ? "var(--green-dark)" : team.teamScore > 0 ? "var(--cut-text)" : "var(--text)",
          }}
        >
          {formatScore(team.teamScore)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            transition: "transform 0.15s",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded player details */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={thStyle}>Player</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Pos</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Score</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Today</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Thru</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => (
                <PlayerRow key={p.name} player={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player row
// ---------------------------------------------------------------------------

function PlayerRow({ player }: { player: PoolPlayer }) {
  const isCut = player.status === "cut";
  const isWD = player.status === "withdrawn" || player.status === "disqualified";

  return (
    <tr
      style={{
        background: player.isCounting ? "var(--counting-bg)" : "white",
        borderTop: "1px solid var(--border)",
        opacity: isCut || isWD ? 0.65 : 1,
      }}
    >
      <td style={{ ...tdStyle, fontWeight: player.isCounting ? 600 : 400 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {player.isCounting && (
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green-dark)",
                flexShrink: 0,
              }}
            />
          )}
          {player.name}
          {isCut && <Tag label="MC" color="var(--cut-text)" />}
          {player.status === "withdrawn" && <Tag label="WD" color="var(--text-muted)" />}
          {player.status === "disqualified" && <Tag label="DQ" color="var(--text-muted)" />}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        {isCut ? "-" : player.position}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {isCut
          ? `${formatScore(player.effectiveScore)}*`
          : formatScore(player.effectiveScore)}
      </td>
      <td style={{ ...tdStyle, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {player.todayScore !== null ? formatScore(player.todayScore) : "-"}
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>{player.thru}</td>
    </tr>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: 3,
        padding: "1px 4px",
        marginLeft: 4,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer
      style={{
        marginTop: 32,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--text-muted)",
        lineHeight: 1.6,
      }}
    >
      <p>
        <strong>Scoring:</strong> Best 4 of 5 golfers count (marked with{" "}
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--green-dark)",
            verticalAlign: "middle",
          }}
        />{" "}
        ). Missed-cut players receive the worst R3 + R4 scores from the field as
        a penalty. Scores marked with * include the missed-cut penalty.
      </p>
      <p style={{ marginTop: 4 }}>Auto-refreshes every 60 seconds.</p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatScore(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "white",
  cursor: "pointer",
  color: "var(--green-dark)",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
};
