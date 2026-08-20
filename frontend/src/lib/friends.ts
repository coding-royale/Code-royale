export type ConnectionRow = {
  user_id: string;
  connection_id: string;
  status: "pending" | "accepted" | "blocked";
};

export type Relationship =
  | "none"
  | "friends"
  | "outgoing_pending"
  | "incoming_pending"
  | "blocked"
  | "blocked_by_other";

export function computeRelationship(
  viewerId: string,
  otherId: string,
  rows: ConnectionRow[],
): Relationship {
  const outgoing = rows.find((row) => row.user_id === viewerId && row.connection_id === otherId);
  const incoming = rows.find((row) => row.user_id === otherId && row.connection_id === viewerId);

  if (outgoing?.status === "blocked") return "blocked";
  if (incoming?.status === "blocked") return "blocked_by_other";
  if (outgoing?.status === "accepted" || incoming?.status === "accepted") return "friends";
  if (outgoing?.status === "pending") return "outgoing_pending";
  if (incoming?.status === "pending") return "incoming_pending";
  return "none";
}

export function partitionConnections(rows: ConnectionRow[], viewerId: string) {
  const incomingIds = rows
    .filter((row) => row.status === "pending" && row.connection_id === viewerId)
    .map((row) => row.user_id);

  const outgoingIds = rows
    .filter((row) => row.status === "pending" && row.user_id === viewerId)
    .map((row) => row.connection_id);

  const friendIds = rows
    .filter((row) => row.status === "accepted")
    .map((row) => (row.user_id === viewerId ? row.connection_id : row.user_id))
    .filter((id) => id !== viewerId);

  return { incomingIds, outgoingIds, friendIds };
}
