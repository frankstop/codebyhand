# CodeByHand

**Live Practice Site:** `https://frankstop.github.io/codebyhand/`

**CodeByHand** is a fast, zero-setup, repetition-focused coding practice platform inspired by [CodingBat](https://codingbat.com/), built to develop core programming fluency across three radically different paradigms: **JavaScript (ES2023)**, **Rust (Edition 2021)**, and **COBOL (GnuCOBOL 3.2)**.

> **49 graded sections · 333 hand-crafted problems · 4,212 unit tests (1,665 visible + 2,547 hidden)** — running with instant feedback in the browser on GitHub Pages or locally with native compilers.

---

## Why "CodeByHand"? — The Pedagogy Behind the Site

Most coding challenges today bury learners under project boilerplate, ambiguous multi-paragraph stories, or heavy algorithm trivia. **CodeByHand** follows CodingBat's deliberate-practice philosophy:

1. **Zero-Setup, Instant Feedback:** Every exercise asks you to write a single self-contained function or COBOL `PROCEDURE DIVISION` routine and press **Go** (`Ctrl+Enter` / `Cmd+Enter`). Removing setup friction lets you complete 15–20 focused reps in the time it would normally take to scaffold one project.
2. **Difficulty Lives in the Logic, Not the Prose:** Problem statements (`Doc`) are short and unambiguous, using consistent short parameter names (`str`/`s`, `a`, `b`, `c`, `nums`, `n`, `start`, `map`). Introductory problems include concise `Note:` callouts for language-specific constructs (`slice()`, `&str` vs `String`, `PIC 9(5)V99`, `INSPECT`).
3. **Diagnostic Non-Boolean Return Values:** Whenever possible, problems return strings, numbers, arrays/vectors, maps, or formatted currency records rather than pure `true`/`false`. Seeing `Expected: "$1,250.00"` next to `Run: "$1,250.00-"` in a test table teaches far more than a row of red `false` values.
4. **Scaffolded Solutions (`showsolution` vs `showpost`):**
   - **Introductory problems** (`Warmup-1`, `Warmup-2`, and the first two problems of newly introduced topics like `Ownership & Borrowing-1`, `Option & Result-1`, `HashMap-1`, `PIC & Fixed-Point-1`, `Tables (OCCURS)-1`, `Functional-1`, and `Recursion-1`) allow **Show Solution** *before* solving to eliminate blank-screen paralysis.
   - **Practice problems** lock the reference solution (`showpost: true`) until you pass 100% of visible and hidden tests, then unlock it so you can compare your working code against a clean, commented, idiomatic reference implementation.
5. **Anti-Hardcoding Hidden Tests (`Other tests`):** Every problem pairs **5 visible test cases** (with the first 3 previewed below the prompt) with **7–8 hidden edge-case variations** summarized at the bottom of the results table (`Other tests: 8/8 passed`).
6. **Mastery Momentum:** Sections award **1 Gold Star (★) for every 3 solved problems**, and every workspace includes `prev`, `next`, and **`chance`** (which jumps to a random *unfinished* problem in the current section).

---

## Three Languages, Three Mental Models (An Educational Guide)

Practicing the same foundational algorithmic patterns across **JavaScript**, **Rust**, and **COBOL** reveals how each language's runtime and type system shape the way you think about data:

### 1. JavaScript (`ES2023` — 17 Sections, 128 Problems, 1,663 Tests)
JavaScript teaches **expressive dynamic problem-solving**: string slicing, array transformations, dictionary/frequency patterns, higher-order functions (`.map()`, `.filter()`, `.reduce()`), and recursive backtracking.
- **Tracks:** `Warmup-1/2`, `Logic-1/2`, `String-1/2/3`, `Array-1/2/3`, `Map-1/2`, `Functional-1/2`, `Applied-1`, `Recursion-1/2`.
- **Key Mental Models:** Non-mutating vs mutating array operations, strict equality & edge-case ordering, closure/arrow pipelines, and base-case-first recursion.

### 2. Rust (`Edition 2021` — 19 Sections, 125 Problems, 1,509 Tests)
Rust takes the same core logic and introduces **compile-time memory safety and explicit error modeling** without garbage collection.
- **Tracks:** All 17 core tracks **plus** two Rust-native bridges:
  - **`Ownership & Borrowing-1`**: Understanding when to borrow `&str` / `&[i32]` slices vs allocate owned `String` / `Vec<T>`, avoiding unnecessary `.clone()`.
  - **`Option & Result-1`**: Eliminating `null`/exceptions using `match`, `if let`, `unwrap_or`, `?`, and safe `.get()` indexing.
- **Key Mental Models:** UTF-8 `.chars()` vs `.bytes()` iteration, `HashMap` `.entry().or_insert()` APIs, zero-cost `.iter().filter().map().fold()` chains, and slice pattern recursion (`[first, rest @ ..]`).

### 3. COBOL (`GnuCOBOL 3.2` — 13 Sections, 80 Problems, 1,040 Tests)
COBOL powers trillions of dollars of daily financial clearing, insurance, payroll, and government batch processing—yet almost no interactive drill sites teach it. CodeByHand makes COBOL approachable by pre-wiring `IDENTIFICATION DIVISION`, `DATA DIVISION`, and `ACCEPT` input parsing so you focus purely on `PROCEDURE DIVISION` logic.
- **Tracks:** `Warmup-1/2`, `Logic-1/2` (88-level condition names & `EVALUATE TRUE`), `PIC & Fixed-Point-1`, `PIC & Edited-Output-2`, `String-1`, `String & INSPECT-2`, `PERFORM & Loops-1`, `Tables (OCCURS)-1/2`, `Lookup & Key-Value-1` (`SEARCH` / `SEARCH ALL`), and `Record & Business Logic-1`.
- **Key Mental Models:**
  - **Exact Fixed-Point Decimal Arithmetic:** Unlike IEEE-754 floating point (where `0.1 + 0.2 !== 0.3`), `PIC 9(5)V99` stores exact base-10 digits with an implied decimal point `V`, explicit `ROUNDED` rules, and `ON SIZE ERROR` overflow traps.
  - **Declarative Edited Output Masks:** Formatting currency and signs declaratively with masks like `$ZZ,ZZ9.99-`, `$$$,$$9.99`, and `$Z,ZZ9.99CR`.
  - **Free-Format vs Fixed-Format (Cols 7–72):** Historically, COBOL came from 80-column punched cards (Cols 1–6 sequence numbers, Col 7 `*` comment / `-` continuation, Cols 8–11 Area A for divisions/paragraphs/`01`/`77`, Cols 12–72 Area B for statements). CodeByHand defaults to modern **Free-Format** (`-free`) and provides a live **Fixed-Format (Cols 7–72)** toggle that converts your buffer and compiles with `-fixed`.

---

## How the Sandboxed Execution Architecture Works

All three languages implement one unified TypeScript contract (`ExecutionEngine.execute(language, userCode, problemSpec, options) -> Promise<ExecutionResult>` in [src/types/schema.ts](src/types/schema.ts)):

```text
Browser UI (React 19 + CodeMirror 6)
  │
  ├── JavaScript ──► Dedicated Browser Web Worker (jsWorker.ts)
  │                    • Hard worker.terminate() at 2,000 ms (infinite-loop safe)
  │                    • structuredClone() input isolation + deepEqual (Array/Object/Map/Set)
  │
  ├── Rust ────────► POST /api/execute/rust (Local rustc / Judge0 proxy)
  │                    • Falls back automatically to Rust Playground CORS API on static GitHub Pages
  │                    • Wraps user code on line 2 (1:1 compiler error line mapping)
  │                    • Runs all visible + hidden cases in one binary with std::panic::catch_unwind
  │                    • Autoref-specialized deterministic formatting (sorted HashMap keys)
  │
  └── COBOL ───────► Dual Runner (Auto / Browser WASM / Server cobc 3.2)
                       • Browser WASM: GnuCOBOL 3.2 compiled to WASI/WASM (@live-codes/cobol-wasm)
                         inside a dedicated Web Worker (works 100% offline & on GitHub Pages)
                       • Native Server: POST /api/execute/cobol (cobc -x -free | -fixed) with
                         parallel stdin test batching and process-group SIGKILL timeout
```

---

## Repository Structure

```text
codebyhand/
├── src/
│   ├── types/schema.ts          # Locked TypeScript contracts (ProblemSpec, SectionSpec, ExecutionResult)
│   ├── curriculum/
│   │   ├── js/                  # 17 modular JS section files (128 problems, 1,663 tests)
│   │   ├── rust/                # 19 modular Rust section files (125 problems, 1,509 tests)
│   │   └── cobol/               # 13 modular COBOL section files (80 problems, 1,040 tests)
│   ├── engine/
│   │   ├── jsRunner.ts          # Browser Web Worker + Node VM sandbox runner
│   │   ├── rustRunner.ts        # Local API + Rust Playground fallback runner
│   │   ├── rustHarness.ts       # Shared main.rs test harness generator & diagnostics parser
│   │   ├── cobolRunner.ts       # Server cobc + @live-codes/cobol-wasm Web Worker runner
│   │   └── cobolFormat.ts       # Bidirectional Free-Format <-> Fixed-Format (Cols 7-72) converter
│   ├── components/              # LanguageHub, SectionDetail, ProblemWorkspace, CodeEditor, ResultsPanel, DoneProgress
│   └── utils/                   # Hash router, localStorage progressStore, COBOL syntax highlighter
├── server/                      # Optional Express 5 backend (/api/execute/rust, /api/execute/cobol, /api/health)
├── qa/
│   ├── verifyAllSolutions.ts    # Automated verifier: 333/333 reference solutions (4,212 tests) + negative sandbox checks
│   └── e2e.spec.ts              # Playwright Chromium E2E test suite (zero console/page errors)
└── .github/workflows/deploy.yml # Automated GitHub Pages build & deploy workflow
```

---

## Running Locally

### Prerequisites
- **Node.js 20+**
- Optional (for local native compilation instead of Rust Playground / Browser WASM):
  - `rustc` (Edition 2021+)
  - `cobc` (GnuCOBOL 3.2, e.g. `brew install rust gnucobol`)

### Development & Production Commands

```bash
# 1. Install dependencies
npm install

# 2. Copy GnuCOBOL 3.2 WASM assets and start Vite (:5173) + Express API (:3001)
npm run prepare:wasm
npm run dev

# 3. Production build + single-port server (:3001)
npm run build
npm start
```

### Automated QA & Verification

```bash
# Run all 333 reference solutions (4,212 unit tests) + syntax error, hidden-test anti-cheat, timeout, Fixed COBOL & WASM checks
npm run qa:solutions

# Run Playwright Chromium end-to-end UI tests
npm run qa:e2e
```

### Optional Server-Side Judge0 Proxy

When running the Express server (`server/index.ts`), you can optionally proxy Rust (`language_id: 73`) and COBOL (`language_id: 77`) through a Judge0-compatible endpoint without ever exposing API keys to client code:

```bash
JUDGE0_API_URL="https://your-judge0-instance.example.com" \
JUDGE0_API_KEY="your-secret-key" \
npm start
```

---

## License

MIT (with `@live-codes/cobol-wasm` runtime assets subject to their upstream MIT/GPL-3.0-or-later notices).
