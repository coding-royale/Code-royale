import { describe, expect, test } from "bun:test";
import {
  computeRelationship,
  partitionConnections,
  type ConnectionRow,
} from "../friends";

const row = (
  user_id: string,
  connection_id: string,
  status: ConnectionRow["status"],
): ConnectionRow => ({ user_id, connection_id, status });

describe("computeRelationship", () => {
  test("returns none when there are no rows", () => {
    expect(computeRelationship("viewer", "other", [])).toBe("none");
  });

  test("returns none when no row involves the pair", () => {
    const rows = [row("a", "b", "accepted")];
    expect(computeRelationship("viewer", "other", rows)).toBe("none");
  });

  test("returns outgoing_pending when viewer sent a pending request", () => {
    const rows = [row("viewer", "other", "pending")];
    expect(computeRelationship("viewer", "other", rows)).toBe("outgoing_pending");
  });

  test("returns incoming_pending when other sent a pending request", () => {
    const rows = [row("other", "viewer", "pending")];
    expect(computeRelationship("viewer", "other", rows)).toBe("incoming_pending");
  });

  test("returns friends when viewer accepted other's request", () => {
    const rows = [row("other", "viewer", "accepted")];
    expect(computeRelationship("viewer", "other", rows)).toBe("friends");
  });

  test("returns friends when other accepted viewer's request", () => {
    const rows = [row("viewer", "other", "accepted")];
    expect(computeRelationship("viewer", "other", rows)).toBe("friends");
  });

  test("returns blocked when viewer blocked other", () => {
    const rows = [row("viewer", "other", "blocked")];
    expect(computeRelationship("viewer", "other", rows)).toBe("blocked");
  });

  test("returns blocked_by_other when other blocked viewer", () => {
    const rows = [row("other", "viewer", "blocked")];
    expect(computeRelationship("viewer", "other", rows)).toBe("blocked_by_other");
  });

  test("blocked wins over accepted when both a blocked and an accepted row exist", () => {
    const rows = [row("viewer", "other", "accepted"), row("other", "viewer", "blocked")];
    expect(computeRelationship("viewer", "other", rows)).toBe("blocked_by_other");
  });

  test("blocked_by_other wins over accepted when both a blocked and an accepted row exist", () => {
    const rows = [row("viewer", "other", "blocked"), row("other", "viewer", "accepted")];
    expect(computeRelationship("viewer", "other", rows)).toBe("blocked");
  });
});

describe("partitionConnections", () => {
  test("splits mixed rows into incoming, outgoing and friend ids for one viewer", () => {
    const rows = [
      row("viewer", "alice", "accepted"),
      row("bob", "viewer", "accepted"),
      row("carol", "viewer", "pending"),
      row("viewer", "dave", "pending"),
    ];
    const { incomingIds, outgoingIds, friendIds } = partitionConnections(rows, "viewer");

    expect(incomingIds).toEqual(["carol"]);
    expect(outgoingIds).toEqual(["dave"]);
    expect(friendIds).toEqual(["alice", "bob"]);
  });

  test("dedupes viewerId from friendIds", () => {
    const rows = [row("viewer", "viewer", "accepted")];
    const { friendIds } = partitionConnections(rows, "viewer");
    expect(friendIds).toEqual([]);
  });

  test("returns all empty arrays for empty rows", () => {
    const { incomingIds, outgoingIds, friendIds } = partitionConnections([], "viewer");
    expect(incomingIds).toEqual([]);
    expect(outgoingIds).toEqual([]);
    expect(friendIds).toEqual([]);
  });

  test("ignores pending rows that do not involve the viewer", () => {
    const rows = [
      row("a", "b", "pending"),
      row("c", "d", "pending"),
    ];
    const { incomingIds, outgoingIds, friendIds } = partitionConnections(rows, "viewer");
    expect(incomingIds).toEqual([]);
    expect(outgoingIds).toEqual([]);
    expect(friendIds).toEqual([]);
  });

  test("maps accepted rows not involving the viewer to row.user_id (mirrors page logic)", () => {
    const rows = [row("c", "d", "accepted")];
    const { friendIds } = partitionConnections(rows, "viewer");
    expect(friendIds).toEqual(["c"]);
  });
});
