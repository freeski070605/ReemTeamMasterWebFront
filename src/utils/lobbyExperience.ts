import { HomeOverview } from "../api/home";
import { AccountStats } from "../api/wallet";
import { getStakeDisplay } from "../branding/modeCopy";
import { Table } from "../types/game";

export interface LobbyRealtimeEvent {
  message: string;
  timestamp: number;
  type?: string;
  tableId?: string;
  username?: string;
}

export type LobbyActivityTone = "amber" | "emerald" | "sky" | "rose" | "slate";

export interface LobbyActivityItem {
  id: string;
  eyebrow: string;
  message: string;
  detail?: string;
  tone: LobbyActivityTone;
  tableId?: string;
  cta?: string;
  priority: number;
}

export interface TableMomentumMeta {
  badge: string;
  detail: string;
  tone: LobbyActivityTone;
  progress: number;
  seatLabel: string;
  recommendedScore: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const getFeedTone = (type?: string): LobbyActivityTone => {
  if (type === "player_left") return "rose";
  if (type === "table_join") return "amber";
  if (type === "lobby_join") return "sky";
  return "slate";
};

const getFeedEyebrow = (type?: string) => {
  if (type === "player_left") return "Seat Opened";
  if (type === "table_join") return "Table Filled";
  if (type === "lobby_join") return "Lobby Active";
  return "Live Update";
};

const getTableSeatsRemaining = (table: Table) =>
  Math.max(0, Number(table.maxPlayers ?? 0) - Number(table.currentPlayerCount ?? 0));

const formatActivityStakeAmount = (amount: string) =>
  amount.replace(/([KMBT])$/, (suffix) => suffix.toLowerCase());

const getActivityTableLabel = (table: Table) => {
  const stakeDisplay = getStakeDisplay(table.stake, table.mode);
  return `${formatActivityStakeAmount(stakeDisplay.amount)} Table`;
};

const formatLobbyFeedMessage = (entry: LobbyRealtimeEvent, table?: Table) => {
  if (!table) {
    return entry.message;
  }

  const tableLabel = getActivityTableLabel(table);
  if (entry.type === "table_join" && entry.username) {
    return `${entry.username} joined ${tableLabel}.`;
  }

  if (entry.type === "player_left" && entry.username) {
    return `${entry.username} left ${tableLabel}.`;
  }

  const tableName = table.name?.trim();
  return tableName ? entry.message.replace(tableName, tableLabel) : entry.message;
};

export const getTableMomentumMeta = (table: Table): TableMomentumMeta => {
  const currentPlayerCount = Number(table.currentPlayerCount ?? 0);
  const maxPlayers = Math.max(1, Number(table.maxPlayers ?? 1));
  const minPlayers = Math.max(2, Number(table.minPlayers ?? 2));
  const seatsRemaining = getTableSeatsRemaining(table);
  const progress = clamp(currentPlayerCount / maxPlayers, 0, 1);
  const waitingAtStartLine = table.status === "waiting" && currentPlayerCount + 1 >= minPlayers && seatsRemaining > 0;
  const almostFull = seatsRemaining === 1;
  const activeOpenTable = table.status === "in-game" && seatsRemaining > 0;

  let badge = "Open seats";
  let detail = currentPlayerCount === 0 ? "Fresh crib. First seat sets the tone." : `${currentPlayerCount}/${maxPlayers} players in.`;
  let tone: LobbyActivityTone = "slate";
  let recommendedScore = table.status === "in-game" ? 30 : 15;

  if (seatsRemaining === 0) {
    badge = "Crib full";
    detail = table.status === "in-game" ? "This hand is packed and moving." : "Full lineup locked in.";
    tone = "slate";
    recommendedScore = -1;
  } else if (waitingAtStartLine && almostFull) {
    badge = "1 seat left";
    detail = "One more player starts the next hand.";
    tone = "amber";
    recommendedScore += 180;
  } else if (waitingAtStartLine) {
    badge = "Ready to start";
    detail = "This crib is one join away from real pressure.";
    tone = "emerald";
    recommendedScore += 150;
  } else if (almostFull && activeOpenTable) {
    badge = "Hot table";
    detail = "Jump into a live hand with one seat left.";
    tone = "amber";
    recommendedScore += 140;
  } else if (activeOpenTable) {
    badge = "Hand live";
    detail = "The board is moving right now.";
    tone = "sky";
    recommendedScore += 100;
  } else if (currentPlayerCount > 0) {
    badge = "Filling";
    detail = "Seats are moving. Pull up before it locks.";
    tone = "emerald";
    recommendedScore += 75;
  }

  recommendedScore += currentPlayerCount * 12;
  recommendedScore += Math.min(Number(table.stake ?? 0), 50);

  return {
    badge,
    detail,
    tone,
    progress,
    seatLabel:
      seatsRemaining === 0
        ? "Full"
        : seatsRemaining === 1
          ? "1 seat left"
          : `${seatsRemaining} seats open`,
    recommendedScore,
  };
};

export const getRecommendedTable = (tables: Table[]) => {
  const openTables = tables.filter((table) => getTableSeatsRemaining(table) > 0 && table.mode !== "USD_CONTEST");
  if (openTables.length === 0) return null;

  return [...openTables].sort(
    (left, right) => getTableMomentumMeta(right).recommendedScore - getTableMomentumMeta(left).recommendedScore
  )[0] ?? null;
};

const pushActivity = (
  items: LobbyActivityItem[],
  seen: Set<string>,
  item: Omit<LobbyActivityItem, "id">
) => {
  const key = `${item.eyebrow}:${item.message}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  items.push({
    id: `${key}:${items.length}`,
    ...item,
  });
};

export const buildLobbyActivityItems = (input: {
  tables: Table[];
  lobbyFeed: LobbyRealtimeEvent[];
  overview?: HomeOverview | null;
  accountStats?: AccountStats | null;
}) => {
  const items: LobbyActivityItem[] = [];
  const seen = new Set<string>();
  const tableById = new Map(input.tables.map((table) => [table._id, table]));

  input.lobbyFeed.slice(0, 4).forEach((entry, index) => {
    const table = entry.tableId ? tableById.get(entry.tableId) : undefined;
    pushActivity(items, seen, {
      eyebrow: getFeedEyebrow(entry.type),
      message: formatLobbyFeedMessage(entry, table),
      detail: formatRelativeTime(entry.timestamp),
      tone: getFeedTone(entry.type),
      tableId: entry.tableId,
      cta: entry.tableId ? "See table" : undefined,
      priority: 120 - index * 6,
    });
  });

  [...input.tables]
    .filter((table) => getTableSeatsRemaining(table) > 0 && table.mode !== "USD_CONTEST")
    .sort((left, right) => getTableMomentumMeta(right).recommendedScore - getTableMomentumMeta(left).recommendedScore)
    .slice(0, 3)
    .forEach((table, index) => {
      const momentum = getTableMomentumMeta(table);
      const tableLabel = getActivityTableLabel(table);
      pushActivity(items, seen, {
        eyebrow: momentum.badge,
        message:
          momentum.badge === "1 seat left"
            ? `${tableLabel} needs one more player`
            : momentum.badge === "Hot table"
              ? `${tableLabel} is moving right now`
              : `${tableLabel} is ${table.status === "in-game" ? "live" : "filling"}`,
        detail: momentum.detail,
        tone: momentum.tone,
        tableId: table._id,
        cta: "Pull up",
        priority: 110 - index * 4,
      });
    });

  const streakLeader = input.overview?.leaderboards.longestStreak?.rankings?.[0];
  if (streakLeader && streakLeader.value > 0) {
    pushActivity(items, seen, {
      eyebrow: "Hot Player",
      message: `${streakLeader.username} is on a ${Math.round(streakLeader.value)}-win run`,
      detail: "The board feels streaks fast.",
      tone: "amber",
      priority: 100,
    });
  }

  const reemLeader = input.overview?.leaderboards.mostReems?.rankings?.[0];
  if (reemLeader && reemLeader.value > 0) {
    pushActivity(items, seen, {
      eyebrow: "Reem Leader",
      message: `${reemLeader.username} leads the week in Reems`,
      detail: `${Math.round(reemLeader.value)} reems in the current window.`,
      tone: "emerald",
      priority: 96,
    });
  }

  if (input.accountStats && input.accountStats.matchesPlayed > 0) {
    pushActivity(items, seen, {
      eyebrow: "Your Line",
      message: `${input.accountStats.totalReems.toLocaleString("en-US")} reems across ${input.accountStats.matchesPlayed.toLocaleString("en-US")} hands`,
      detail: `${input.accountStats.winRate.toFixed(1)}% win rate on your account.`,
      tone: "sky",
      priority: 92,
    });
  }

  if (items.length === 0) {
    const liveTables = input.tables.filter((table) => table.status === "in-game").length;
    pushActivity(items, seen, {
      eyebrow: "Lobby Live",
      message: `${liveTables} live table${liveTables === 1 ? "" : "s"} running right now`,
      detail: "Pick a seat and keep the pressure moving.",
      tone: "amber",
      priority: 80,
    });
  }

  return items.sort((left, right) => right.priority - left.priority).slice(0, 8);
};
