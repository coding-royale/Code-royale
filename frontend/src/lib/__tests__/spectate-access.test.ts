import { describe, expect, test } from "bun:test";
import {
  canSpectate,
  friendParticipants,
  visibleSpectatePlayers,
} from "../spectate-access";

/*
 * Spectating is friend-only.
 *
 * Before this, `getSpectateSnapshot` checked nothing but "is the caller signed
 * in", so anyone holding a match id could watch a duel they had no connection
 * to — including a stranger's ranked match, which is a scouting tool.
 *
 * ME = the spectator, FRIEND = someone in the duel, STRANGER = the other player.
 */
const ME = "me";
const FRIEND = "friend";
const STRANGER = "stranger";

describe("canSpectate", () => {
  test("a friend of a player may spectate", () => {
    expect(canSpectate({ playerIds: [FRIEND, STRANGER], friendIds: [FRIEND] })).toBe(true);
  });

  test("a signed-in stranger may not spectate", () => {
    expect(canSpectate({ playerIds: [FRIEND, STRANGER], friendIds: [ME, "someone-else"] })).toBe(false);
  });

  test("an empty friend list may never spectate", () => {
    expect(canSpectate({ playerIds: [FRIEND, STRANGER], friendIds: [] })).toBe(false);
  });

  test("playing in the match is not enough", () => {
    // A seated player already has the live arena; the snapshot must not become
    // a way to read a result they are not entitled to.
    expect(canSpectate({ playerIds: [ME, STRANGER], friendIds: [ME], viewerId: ME })).toBe(false);
  });

  test("no players means nothing to watch", () => {
    expect(canSpectate({ playerIds: [], friendIds: [FRIEND] })).toBe(false);
  });
});

describe("friendParticipants", () => {
  test("returns only the friend, never the opponent", () => {
    expect(friendParticipants({ playerIds: [FRIEND, STRANGER], friendIds: [FRIEND] })).toEqual([FRIEND]);
  });

  test("works when the friend happens to be the second seat", () => {
    expect(friendParticipants({ playerIds: [STRANGER, FRIEND], friendIds: [FRIEND] })).toEqual([FRIEND]);
  });

  test("returns both when the spectator is friends with both players", () => {
    expect(
      friendParticipants({ playerIds: [FRIEND, "other-friend"], friendIds: [FRIEND, "other-friend"] }),
    ).toEqual([FRIEND, "other-friend"]);
  });

  test("returns nothing for a total stranger", () => {
    expect(friendParticipants({ playerIds: [FRIEND, STRANGER], friendIds: [ME] })).toEqual([]);
  });

  test("preserves seat order so the view does not reshuffle", () => {
    expect(
      friendParticipants({ playerIds: [STRANGER, FRIEND, "other-friend"], friendIds: [FRIEND, "other-friend"] }),
    ).toEqual([FRIEND, "other-friend"]);
  });
});

describe("visibleSpectatePlayers", () => {
  test("discloses only the spectator's friend", () => {
    expect(
      visibleSpectatePlayers({ playerIds: [FRIEND, STRANGER], friendIds: [FRIEND] }),
    ).toEqual([FRIEND]);
  });

  test("discloses nothing when there is no friendship", () => {
    // Empty is the signal the route turns into a 404.
    expect(
      visibleSpectatePlayers({ playerIds: [FRIEND, STRANGER], friendIds: [] }),
    ).toEqual([]);
  });
});