/**
 * Real solutions for the seeded practice bank, shared by the duel harnesses.
 *
 * Each returns a `solve` matching the question's LeetCode-style signature, so
 * the server's harness wraps it and the judge runs genuine code rather than a
 * stub. Keys are question ids.
 */

export const SOLUTIONS = {
  // ---- easy ----
  "dede78a9-5c1e-4583-8447-030d0f7bad9c": `function solve(nums) {
  let total = 0;
  for (const n of nums) total += n;
  return total;
}`,
  "e1c396cc-90c7-42de-97a0-e5768ad0516d": `function solve(nums, target) {
  let count = 0;
  for (const n of nums) if (n === target) count++;
  return count;
}`,
  "a3541476-7117-42f8-bdea-7d5b86572653": `function solve(n) {
  return n % 2 === 0 ? "Even" : "Odd";
}`,
  "7d228300-b414-423f-99a0-6781c23bdb40": `function solve(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}`,
  "c7ca0bbd-69a6-4cdd-9c97-1fc28c8f3486": `function solve(a, b) {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) { const t = y; y = x % y; x = t; }
  return x;
}`,
  "d25d79b6-0136-4de7-ba7d-6e1242468b4c": `function solve(nums) {
  for (let i = 1; i < nums.length; i++) if (nums[i] < nums[i - 1]) return false;
  return true;
}`,
  "24238e70-7983-4c14-bf21-f4cc1a93967f": `function solve(a, b, c) {
  return Math.max(a, Math.max(b, c));
}`,
  "9ea8dd84-175f-4d9c-8b0b-37ebc7e4a1f7": `function solve(nums) {
  let best = nums[0];
  for (const n of nums) if (n > best) best = n;
  return best;
}`,
  "fdac5911-e921-4907-a675-66cb26a678a4": `function solve(s) {
  return s.split("").reverse().join("");
}`,
  "18c08da6-a687-4949-a51a-eaf3de7a1b55": `function solve(a, b) {
  return a + b;
}`,
  // ---- medium ----
  "fa941443-c8d8-4f6e-aed1-879723255c2b": `function solve(nums) {
  let best = nums[0], running = nums[0];
  for (let i = 1; i < nums.length; i++) {
    running = Math.max(nums[i], running + nums[i]);
    best = Math.max(best, running);
  }
  return best;
}`,
  "a52e15ed-9070-4b50-9db2-de39e6c65eab": `function solve(nums) {
  const out = new Array(nums.length).fill(1);
  let prefix = 1;
  for (let i = 0; i < nums.length; i++) { out[i] = prefix; prefix *= nums[i]; }
  let suffix = 1;
  for (let i = nums.length - 1; i >= 0; i--) { out[i] *= suffix; suffix *= nums[i]; }
  return out;
}`,
  "629dfb2f-699e-470e-8648-3150316ee8b5": `function solve(colors) {
  let z = 0, o = 0, t = 0;
  for (const c of colors) { if (c === 0) z++; else if (c === 1) o++; else t++; }
  const out = new Array(colors.length);
  let i = 0;
  for (; i < z; i++) out[i] = 0;
  for (let k = 0; k < o; k++) out[i++] = 1;
  for (let k = 0; k < t; k++) out[i++] = 2;
  return out;
}`,
  "e1bce1b7-f480-4110-8c5c-e379e8a76c52": `function solve(prices) {
  let best = 0, min = prices[0];
  for (const p of prices) {
    if (p < min) min = p;
    else if (p - min > best) best = p - min;
  }
  return best;
}`,
  "d563b23f-f2ca-46e6-b232-79dd0270297e": `function solve(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}`,
  "b5401843-2456-4a03-be27-099d57bdac4a": `function solve(s) {
  const seen = new Map();
  for (let i = 0; i < s.length; i++) seen.set(s[i], (seen.get(s[i]) || 0) + 1);
  for (let i = 0; i < s.length; i++) if (seen.get(s[i]) === 1) return i;
  return -1;
}`,
  "d2236e87-19b7-45ec-a529-4fcfb7e30ffb": `function solve(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) nums[write++] = nums[read];
  }
  while (write < nums.length) nums[write++] = 0;
  return nums;
}`,
  "d550d473-ffb7-47df-b968-6d1c68f59e76": `function solve(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (read === 0 || nums[read] !== nums[read - 1]) nums[write++] = nums[read];
  }
  return nums.slice(0, write);
}`,
  "6139b633-a516-438a-9022-4e0949285c46": `function solve(nums, k) {
  const n = nums.length;
  const shift = ((k % n) + n) % n;
  return nums.slice(n - shift).concat(nums.slice(0, n - shift));
}`,
  "2aacf404-2e1f-42a8-9227-a2b1da5404d2": `function solve(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const want = target - nums[i];
    if (seen.has(want)) return [seen.get(want), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
  "af4d00ed-a964-4b74-a3a8-2a523e427c6a": `function solve(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}`,
};

/** Deliberately wrong, so the judge rejects it and no win is recorded. */
export const WRONG_SOLUTION = `function solve() {
  return "definitely-not-the-answer";
}`;
