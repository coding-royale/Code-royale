import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

function parseDotEnv(contents) {
  const lines = contents.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

if (fs.existsSync(envPath)) {
  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 30 additional questions: 10 easy, 10 medium, 10 hard
const extraSeeds = [
  // ── EASY ──
  {
    slug: "pvp-squares-sorted",
    title: "Squares of a Sorted Array",
    description: "Given a sorted array of integers, return a sorted array of the squares of each number.\n\nInput: JSON array of numbers\nOutput: JSON array of numbers (sorted ascending)",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [{ input: "[-4,-1,0,3,10]", output: "[0,1,9,16,100]" }, { input: "[-7,-3,2,3,11]", output: "[4,9,9,49,121]" }],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["arrays", "two-pointers"] },
  },
  {
    slug: "pvp-flood-fill",
    title: "Flood Fill",
    description: "Perform a flood fill on a 2D grid. Start at (sr, sc) and change all connected cells of the same color to newColor.\n\nInput: JSON object {\"image\": number[][], \"sr\": number, \"sc\": number, \"newColor\": number}\nOutput: JSON 2D array of numbers",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"image":[[1,1,1],[1,1,0],[1,0,1]],"sr":1,"sc":1,"newColor":2}', output: "[[2,2,2],[2,2,0],[2,0,1]]" },
      { input: '{"image":[[0,0,0],[0,0,0]],"sr":0,"sc":0,"newColor":2}', output: "[[2,2,2],[2,2,2]]" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["arrays", "graph", "dfs"] },
  },
  {
    slug: "pvp-island-perimeter",
    title: "Island Perimeter",
    description: "Given a 2D grid where 1 represents land and 0 represents water, return the perimeter of the island.\n\nInput: JSON 2D array of numbers\nOutput: number",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[[0,1,0,0],[1,1,1,0],[0,1,0,0],[1,1,0,0]]", output: "16" },
      { input: "[[1]]", output: "4" },
    ],
    meta: { timeComplexity: "O(m*n)", spaceComplexity: "O(1)", topics: ["arrays", "matrix"] },
  },
  {
    slug: "pvp-move-zeroes",
    title: "Move Zeroes",
    description: "Move all zeroes to the end while maintaining relative order of non-zero elements. In-place.\n\nInput: JSON array of numbers\nOutput: JSON array of numbers",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [{ input: "[0,1,0,3,12]", output: "[1,3,12,0,0]" }, { input: "[0,0,1]", output: "[1,0,0]" }],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(1)", topics: ["arrays", "two-pointers"] },
  },
  {
    slug: "pvp-shuffle-array",
    title: "Shuffle the Array",
    description: "Given an array of 2n elements [x1,x2,...,xn,y1,y2,...,yn], return [x1,y1,x2,y2,...,xn,yn].\n\nInput: JSON object {\"nums\": number[], \"n\": number}\nOutput: JSON array of numbers",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"nums":[2,5,1,3,4,7],"n":3}', output: "[2,3,5,4,1,7]" },
      { input: '{"nums":[1,2,3,4,5,6],"n":3}', output: "[1,4,2,5,3,6]" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["arrays"] },
  },
  {
    slug: "pvp-same-tree",
    title: "Same Tree",
    description: "Return true if two binary trees are structurally identical.\n\nInput: JSON object {\"p\": object|null, \"q\": object|null}\nOutput: boolean",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"p":{"val":1,"left":{"val":2},"right":{"val":3}},"q":{"val":1,"left":{"val":2},"right":{"val":3}}}', output: "true" },
      { input: '{"p":{"val":1,"left":{"val":2}},"q":{"val":1,"right":{"val":2}}}', output: "false" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["tree", "dfs"] },
  },
  {
    slug: "pvp-subtree-of-another",
    title: "Subtree of Another Tree",
    description: "Return true if subRoot is a subtree of root.\n\nInput: JSON object {\"root\": object|null, \"subRoot\": object|null}\nOutput: boolean",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"root":{"val":3,"left":{"val":4,"left":{"val":1},"right":{"val":2}},"right":{"val":5}},"subRoot":{"val":4,"left":{"val":1},"right":{"val":2}}}', output: "true" },
      { input: '{"root":{"val":3,"left":{"val":4,"left":{"val":1},"right":{"val":2,"left":{"val":0}}},"right":{"val":5}},"subRoot":{"val":4,"left":{"val":1},"right":{"val":2}}}', output: "false" },
    ],
    meta: { timeComplexity: "O(n*m)", spaceComplexity: "O(n)", topics: ["tree", "dfs"] },
  },
  {
    slug: "pvp-range-sum-bst",
    title: "Range Sum of BST",
    description: "Return the sum of all node values within [low, high] in a BST.\n\nInput: JSON object {\"root\": object|null, \"low\": number, \"high\": number}\nOutput: number",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"root":{"val":10,"left":{"val":5,"left":{"val":3},"right":{"val":7}},"right":{"val":15,"right":{"val":18}}},"low":7,"high":15}', output: "32" },
      { input: '{"root":{"val":10,"left":{"val":5,"left":{"val":3,"left":{"val":1},"right":{"val":6}},"right":{"val":7}},"right":{"val":15,"left":{"val":13},"right":{"val":18}}},"low":6,"high":10}', output: "23" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["tree", "dfs", "bst"] },
  },
  {
    slug: "pvp-two-sum-ii",
    title: "Two Sum II - Sorted Array",
    description: "Return 1-indexed indices of two numbers that sum to target. Exactly one solution.\n\nInput: JSON object {\"nums\": number[], \"target\": number}\nOutput: JSON array [i, j]",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"nums":[2,7,11,15],"target":9}', output: "[1,2]" },
      { input: '{"nums":[2,3,4],"target":6}', output: "[1,3]" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(1)", topics: ["arrays", "two-pointers", "binary-search"] },
  },
  {
    slug: "pvp-happy-number",
    title: "Happy Number",
    description: "Return true if n is a happy number (sum of squares of digits eventually reaches 1).\n\nInput: JSON number\nOutput: boolean",
    difficulty: "easy",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [{ input: "19", output: "true" }, { input: "2", output: "false" }],
    meta: { timeComplexity: "O(log n)", spaceComplexity: "O(1)", topics: ["math", "hash-table"] },
  },

  // ── MEDIUM ──
  {
    slug: "pvp-course-schedule",
    title: "Course Schedule",
    description: "Determine if all courses can be finished given prerequisites.\n\nInput: JSON object {\"numCourses\": number, \"prerequisites\": number[][]}\nOutput: boolean",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"numCourses":2,"prerequisites":[[1,0]]}', output: "true" },
      { input: '{"numCourses":2,"prerequisites":[[1,0],[0,1]]}', output: "false" },
    ],
    meta: { timeComplexity: "O(V+E)", spaceComplexity: "O(V+E)", topics: ["graph", "topological-sort", "dfs"] },
  },
  {
    slug: "pvp-number-of-islands",
    title: "Number of Islands",
    description: "Count the number of islands in a 2D grid. Land is '1', water is '0'.\n\nInput: JSON 2D array of strings\nOutput: number",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]', output: "1" },
      { input: '[[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]', output: "3" },
    ],
    meta: { timeComplexity: "O(m*n)", spaceComplexity: "O(m*n)", topics: ["graph", "dfs", "matrix"] },
  },
  {
    slug: "pvp-validate-bst",
    title: "Validate Binary Search Tree",
    description: "Determine if a binary tree is a valid BST.\n\nInput: JSON object (tree with val, left, right)\nOutput: boolean",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"val":2,"left":{"val":1},"right":{"val":3}}', output: "true" },
      { input: '{"val":5,"left":{"val":1},"right":{"val":4,"left":{"val":3},"right":{"val":6}}}', output: "false" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["tree", "bst", "dfs"] },
  },
  {
    slug: "pvp-pacific-atlantic",
    title: "Pacific Atlantic Water Flow",
    description: "Return cells where water can flow to both Pacific and Atlantic oceans.\n\nInput: JSON 2D array of numbers\nOutput: JSON array of [row, col] pairs",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]", output: "[[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]" },
      { input: "[[2,1],[1,2]]", output: "[[0,0],[0,1],[1,0],[1,1]]" },
    ],
    meta: { timeComplexity: "O(m*n)", spaceComplexity: "O(m*n)", topics: ["graph", "dfs", "matrix"] },
  },
  {
    slug: "pvp-letter-combinations",
    title: "Letter Combinations of a Phone Number",
    description: "Return all possible letter combinations a phone number could represent.\n\nInput: JSON string of digits\nOutput: JSON array of strings",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '"23"', output: '["ad","ae","af","bd","be","bf","cd","ce","cf"]' },
      { input: '""', output: "[]" },
    ],
    meta: { timeComplexity: "O(4^n)", spaceComplexity: "O(4^n)", topics: ["backtracking", "strings"] },
  },
  {
    slug: "pvp-generate-parentheses",
    title: "Generate Parentheses",
    description: "Generate all well-formed parentheses combinations for n pairs.\n\nInput: JSON number n\nOutput: JSON array of strings",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "3", output: '["((()))","(()())","(())()","()(())","()()()"]' },
      { input: "1", output: '["()"]' },
    ],
    meta: { timeComplexity: "O(4^n / sqrt(n))", spaceComplexity: "O(4^n / sqrt(n))", topics: ["backtracking", "strings"] },
  },
  {
    slug: "pvp-search-rotated",
    title: "Search in Rotated Sorted Array",
    description: "Search for target in a rotated sorted array. O(log n) expected.\n\nInput: JSON object {\"nums\": number[], \"target\": number}\nOutput: number (index or -1)",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"nums":[4,5,6,7,0,1,2],"target":0}', output: "4" },
      { input: '{"nums":[4,5,6,7,0,1,2],"target":3}', output: "-1" },
    ],
    meta: { timeComplexity: "O(log n)", spaceComplexity: "O(1)", topics: ["arrays", "binary-search"] },
  },
  {
    slug: "pvp-permutations",
    title: "Permutations",
    description: "Return all possible permutations of distinct integers.\n\nInput: JSON array of numbers\nOutput: JSON array of arrays",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[1,2,3]", output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" },
      { input: "[0,1]", output: "[[0,1],[1,0]]" },
    ],
    meta: { timeComplexity: "O(n*n!)", spaceComplexity: "O(n*n!)", topics: ["backtracking"] },
  },
  {
    slug: "pvp-largest-number",
    title: "Largest Number",
    description: "Arrange numbers to form the largest possible number.\n\nInput: JSON array of numbers\nOutput: JSON string",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[3,30,34,5,9]", output: '"9534330"' },
      { input: "[10,2]", output: '"210"' },
    ],
    meta: { timeComplexity: "O(n log n)", spaceComplexity: "O(n)", topics: ["sorting", "strings"] },
  },
  {
    slug: "pvp-odd-even-linked",
    title: "Odd Even Linked List",
    description: "Reorder linked list so odd positions come before even positions.\n\nInput: JSON array of numbers (values)\nOutput: JSON array of numbers (reordered)",
    difficulty: "medium",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[1,2,3,4,5]", output: "[1,3,5,2,4]" },
      { input: "[2,1,3,5,6,4,7]", output: "[2,3,6,7,1,5,4]" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(1)", topics: ["linked-list"] },
  },

  // ── HARD ──
  {
    slug: "pvp-sudoku-solver",
    title: "Sudoku Solver",
    description: "Solve a 9x9 Sudoku puzzle. Empty cells are 0.\n\nInput: JSON 2D array of numbers (9x9)\nOutput: JSON 2D array of numbers (solved 9x9)",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]]", output: "[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]]" },
    ],
    meta: { timeComplexity: "O(9^n)", spaceComplexity: "O(n)", topics: ["backtracking", "matrix"] },
  },
  {
    slug: "pvp-n-queens",
    title: "N-Queens",
    description: "Return all distinct solutions to the N-Queens puzzle.\n\nInput: JSON number n\nOutput: JSON array of 2D string arrays",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "4", output: '[[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]]' },
      { input: "1", output: '[[["Q"]]]' },
    ],
    meta: { timeComplexity: "O(n!)", spaceComplexity: "O(n^2)", topics: ["backtracking"] },
  },
  {
    slug: "pvp-largest-rectangle",
    title: "Largest Rectangle in Histogram",
    description: "Return the area of the largest rectangle in a histogram.\n\nInput: JSON array of numbers (heights)\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[2,1,5,6,2,3]", output: "10" },
      { input: "[2,4]", output: "4" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["stack", "arrays"] },
  },
  {
    slug: "pvp-sliding-window-max",
    title: "Sliding Window Maximum",
    description: "Return the maximum values in each sliding window of size k.\n\nInput: JSON object {\"nums\": number[], \"k\": number}\nOutput: JSON array of numbers",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"nums":[1,3,-1,-3,5,3,6,7],"k":3}', output: "[3,3,5,5,6,7]" },
      { input: '{"nums":[1],"k":1}', output: "[1]" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(k)", topics: ["sliding-window", "heap"] },
  },
  {
    slug: "pvp-burst-balloons",
    title: "Burst Balloons",
    description: "Return max coins from bursting balloons.\n\nInput: JSON array of numbers\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[3,1,5,8]", output: "167" },
      { input: "[1,5]", output: "10" },
    ],
    meta: { timeComplexity: "O(n^3)", spaceComplexity: "O(n^2)", topics: ["dynamic-programming", "divide-and-conquer"] },
  },
  {
    slug: "pvp-edit-distance",
    title: "Edit Distance",
    description: "Return minimum operations to convert word1 to word2.\n\nInput: JSON object {\"word1\": string, \"word2\": string}\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"word1":"horse","word2":"ros"}', output: "3" },
      { input: '{"word1":"intention","word2":"execution"}', output: "5" },
    ],
    meta: { timeComplexity: "O(n*m)", spaceComplexity: "O(n*m)", topics: ["dynamic-programming", "strings"] },
  },
  {
    slug: "pvp-max-path-sum",
    title: "Binary Tree Maximum Path Sum",
    description: "Return the maximum path sum in a binary tree.\n\nInput: JSON object (tree)\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"val":1,"left":{"val":2},"right":{"val":3}}', output: "6" },
      { input: '{"val":-10,"left":{"val":9},"right":{"val":20,"left":{"val":15},"right":{"val":7}}}', output: "42" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(n)", topics: ["tree", "dfs", "dynamic-programming"] },
  },
  {
    slug: "pvp-first-missing-positive",
    title: "First Missing Positive",
    description: "Return the smallest missing positive integer. O(n) time, O(1) space.\n\nInput: JSON array of numbers\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: "[1,2,0]", output: "3" },
      { input: "[3,4,-1,1]", output: "2" },
    ],
    meta: { timeComplexity: "O(n)", spaceComplexity: "O(1)", topics: ["arrays"] },
  },
  {
    slug: "pvp-regular-expression",
    title: "Regular Expression Matching",
    description: "Implement regex matching with '.' and '*'.\n\nInput: JSON object {\"s\": string, \"p\": string}\nOutput: boolean",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"s":"aa","p":"a"}', output: "false" },
      { input: '{"s":"aa","p":"a*"}', output: "true" },
      { input: '{"s":"ab","p":".*"}', output: "true" },
    ],
    meta: { timeComplexity: "O(n*m)", spaceComplexity: "O(n*m)", topics: ["dynamic-programming", "strings"] },
  },
  {
    slug: "pvp-distinct-subsequences",
    title: "Distinct Subsequences",
    description: "Return number of distinct subsequences of s that equal t.\n\nInput: JSON object {\"s\": string, \"t\": string}\nOutput: number",
    difficulty: "hard",
    languages: ["javascript", "python", "cpp", "java", "c"],
    testcases: [
      { input: '{"s":"rabbbit","t":"rabbit"}', output: "3" },
      { input: '{"s":"babgbag","t":"bag"}', output: "5" },
    ],
    meta: { timeComplexity: "O(n*m)", spaceComplexity: "O(n*m)", topics: ["dynamic-programming", "strings"] },
  },
];

async function main() {
  console.log(`Seeding ${extraSeeds.length} extra questions...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const seed of extraSeeds) {
    const { data: existing } = await supabase
      .from("practice_questions")
      .select("id")
      .eq("slug", seed.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP  ${seed.slug} — already exists`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("practice_questions").insert({
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      difficulty: seed.difficulty,
      languages: seed.languages,
      testcases: seed.testcases,
      meta: seed.meta ?? {},
    });

    if (error) {
      console.error(`  ERROR ${seed.slug} — ${error.message}`);
      errors++;
    } else {
      console.log(`  OK    ${seed.slug}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
