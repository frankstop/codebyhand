import assert from 'node:assert/strict';
import {
  cobolSections,
  getAllProblems,
  jsSections,
  rustSections,
} from '../src/curriculum';
import { executionEngine, freeToFixedCobol } from '../src/engine';
import type { LanguageId, ProblemSpec, SectionSpec } from '../src/types/schema';

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => next()
  );
  await Promise.all(workers);
  return results;
}

function auditCurriculumSchema(): void {
  console.log('=== [1/3] Auditing Curriculum Taxonomy & Schema ===');

  assert.equal(jsSections.length, 17, `Expected 17 JS sections, got ${jsSections.length}`);
  assert.equal(rustSections.length, 19, `Expected 19 Rust sections, got ${rustSections.length}`);
  assert.equal(cobolSections.length, 13, `Expected 13 COBOL sections, got ${cobolSections.length}`);

  const seenIds = new Set<string>();
  const allGroups: Array<{ lang: LanguageId; sections: SectionSpec[] }> = [
    { lang: 'js', sections: jsSections },
    { lang: 'rust', sections: rustSections },
    { lang: 'cobol', sections: cobolSections },
  ];

  for (const { lang, sections } of allGroups) {
    const seenSectionIds = new Set<string>();
    for (const section of sections) {
      assert.equal(section.language, lang, `Section ${section.id} language mismatch`);
      assert(!seenSectionIds.has(section.id), `Duplicate section ID ${section.id} in ${lang}`);
      seenSectionIds.add(section.id);
      assert(
        section.problems.length >= 6,
        `Section ${lang}/${section.id} must have >= 6 problems, got ${section.problems.length}`
      );

      const [minDiff, maxDiff] = section.difficultyRange;
      const isWarmup = section.id === 'warmup-1' || section.id === 'warmup-2';

      for (const prob of section.problems) {
        assert(!seenIds.has(prob.id), `Duplicate problem ID ${prob.id}`);
        seenIds.add(prob.id);
        assert.equal(prob.language, lang, `Problem ${prob.id} language mismatch`);
        assert.equal(prob.sectionId, section.id, `Problem ${prob.id} sectionId mismatch`);
        assert(
          prob.difficulty >= minDiff && prob.difficulty <= maxDiff,
          `Problem ${prob.id} difficulty ${prob.difficulty} outside [${minDiff}, ${maxDiff}]`
        );
        assert(prob.doc.trim().length > 10, `Problem ${prob.id} missing doc`);
        assert(prob.starterCode.trim().length > 0, `Problem ${prob.id} missing starterCode`);
        assert(prob.solution.trim().length > 0, `Problem ${prob.id} missing solution`);
        assert(prob.hints.length >= 1, `Problem ${prob.id} must have at least 1 hint`);

        const visibleTests = prob.tests.filter((t) => !t.hidden);
        const hiddenTests = prob.tests.filter((t) => t.hidden);
        assert(
          visibleTests.length >= 3,
          `Problem ${prob.id} must have >= 3 visible tests, got ${visibleTests.length}`
        );
        assert(
          hiddenTests.length >= 5,
          `Problem ${prob.id} must have >= 5 hidden tests, got ${hiddenTests.length}`
        );

        if (isWarmup) {
          assert.equal(
            prob.showsolution,
            true,
            `Warmup problem ${prob.id} must have showsolution: true`
          );
        } else {
          assert(
            prob.showsolution || prob.showpost,
            `Problem ${prob.id} must enable either showsolution or showpost`
          );
        }
      }
    }
  }

  console.log(
    `Schema audit passed: 49 sections, ${seenIds.size} unique problems verified.`
  );
}

async function verifyAllReferenceSolutions(): Promise<void> {
  console.log('\n=== [2/3] Executing 100% of Reference Solutions via ExecutionEngine ===');

  const languages: LanguageId[] = ['js', 'rust', 'cobol'];
  let grandTotalProblems = 0;
  let grandTotalTests = 0;

  for (const lang of languages) {
    const problems = getAllProblems(lang);
    const concurrency = lang === 'js' ? 16 : 8;
    const started = performance.now();

    const failures: Array<{ problem: ProblemSpec; reason: string }> = [];
    let visibleCount = 0;
    let hiddenCount = 0;

    await mapWithConcurrency(problems, concurrency, async (prob) => {
      const res = await executionEngine.execute(lang, prob.solution, prob);
      const vis = prob.tests.filter((t) => !t.hidden).length;
      const hid = prob.tests.filter((t) => t.hidden).length;
      visibleCount += vis;
      hiddenCount += hid;

      if (!res.allPassed || res.outcome !== 'passed' || res.timedOut) {
        const failedRows = res.visibleResults
          .filter((r) => !r.passed)
          .map((r) => `${r.call}: expected=${r.expected}, run=${r.run}`)
          .join('; ');
        const diagMsg = res.diagnostics.map((d) => d.message).join('; ');
        failures.push({
          problem: prob,
          reason: `outcome=${res.outcome}, other=${res.otherTests.message}, failedVisible=[${failedRows}], diags=[${diagMsg}]`,
        });
      }
    });

    const elapsedSec = ((performance.now() - started) / 1000).toFixed(2);
    const totalLangTests = visibleCount + hiddenCount;
    grandTotalProblems += problems.length;
    grandTotalTests += totalLangTests;

    console.log(
      `  [${lang.toUpperCase()}] ${problems.length - failures.length}/${problems.length} problems passed ` +
        `(${visibleCount} visible + ${hiddenCount} hidden = ${totalLangTests} tests) in ${elapsedSec}s`
    );

    if (failures.length > 0) {
      for (const f of failures) {
        console.error(`    FAIL ${f.problem.id}: ${f.reason}`);
      }
      throw new Error(`${failures.length} reference solution(s) failed in ${lang}`);
    }
  }

  console.log(
    `All ${grandTotalProblems} reference solutions passed ${grandTotalTests}/${grandTotalTests} unit tests (0 failures)!`
  );
}

async function verifyNegativeAndSandboxCases(): Promise<void> {
  console.log('\n=== [3/3] Verifying Compiler Errors, Hidden-Test Anti-Cheat, Timeouts, Fixed COBOL & WASM ===');

  const jsProb = jsSections[0].problems[0]; // sleepIn
  const rustProb = rustSections[0].problems[0];
  const cobolProb = cobolSections[0].problems[0];

  // 1. JS SyntaxError
  const jsSyntax = await executionEngine.execute(
    'js',
    `function ${jsProb.functionName}(a, b {\n  return true;\n}`,
    jsProb
  );
  assert.equal(jsSyntax.outcome, 'compile_error', 'JS broken syntax should produce compile_error');
  assert(jsSyntax.diagnostics.length > 0, 'JS SyntaxError should include diagnostics');
  console.log('  [OK] JS SyntaxError diagnostic verified');

  // 2. JS Hardcoded Visible-Only Anti-Cheat (passes visible, fails hidden "other tests")
  // Use diff21(n) (integer domain) rather than sleepIn(bool, bool) whose 4 boolean states fit inside 5 visible cases
  const jsAntiCheatProb = jsSections[0].problems[1];
  const visibleMapEntries = jsAntiCheatProb.tests
    .filter((t) => !t.hidden)
    .map((t) => `[JSON.stringify(${JSON.stringify(t.args)}), ${JSON.stringify(t.expected)}]`);
  const hardcodedJs = `function ${jsAntiCheatProb.functionName}(...args) {
    const table = new Map([${visibleMapEntries.join(', ')}]);
    const key = JSON.stringify(args);
    if (table.has(key)) return table.get(key);
    return "__WRONG_HIDDEN_SENTINEL__";
  }`;
  const jsCheat = await executionEngine.execute('js', hardcodedJs, jsAntiCheatProb);
  assert.equal(jsCheat.allPassed, false, 'Hardcoded visible lookup must not pass overall');
  assert(
    jsCheat.visibleResults.every((r) => r.passed),
    'Hardcoded visible lookup should pass visible rows'
  );
  assert.equal(
    jsCheat.otherTests.allPassed,
    false,
    'Hardcoded visible lookup must fail hidden otherTests'
  );
  console.log(`  [OK] JS hidden other-tests anti-cheat verified (${jsCheat.otherTests.message})`);

  // 3. JS Infinite Loop Timeout
  const jsTimeout = await executionEngine.execute(
    'js',
    `function ${jsProb.functionName}() { while (true) {} }`,
    jsProb,
    { timeoutMs: 600 }
  );
  assert.equal(jsTimeout.timedOut, true, 'JS infinite loop must time out');
  assert.equal(jsTimeout.outcome, 'timeout');
  console.log('  [OK] JS infinite-loop timeout sandbox verified');

  // 4. Rust Compiler Error with Line Mapping
  const rustBroken = rustProb.starterCode.replace(
    'todo!()',
    'let broken_type: i32 = "not_an_int";\n    todo!()'
  );
  const rustErr = await executionEngine.execute('rust', rustBroken, rustProb);
  assert.equal(rustErr.outcome, 'compile_error', 'Rust type mismatch must return compile_error');
  assert(rustErr.diagnostics.length > 0, 'Rust compile_error must include rustc diagnostics');
  assert(typeof rustErr.diagnostics[0].line === 'number', 'Rust diagnostic must map line number');
  console.log(`  [OK] Rust rustc diagnostic verified (line ${rustErr.diagnostics[0].line})`);

  // 5. Rust Infinite Loop Timeout
  const rustLoopCode = rustProb.starterCode.replace('todo!()', 'loop {}');
  const rustTimeout = await executionEngine.execute('rust', rustLoopCode, rustProb, {
    timeoutMs: 800,
  });
  assert.equal(rustTimeout.timedOut, true, 'Rust infinite loop must time out');
  assert.equal(rustTimeout.outcome, 'timeout');
  console.log('  [OK] Rust infinite-loop SIGKILL timeout verified');

  // 6. COBOL Compiler Error (undeclared identifier inside PROCEDURE DIVISION)
  const cobolBroken = cobolProb.starterCode.replace(
    /STOP RUN\./i,
    'MOVE UNDECLARED-VAR-XYZ TO WS-NONEXISTENT-TARGET.\nSTOP RUN.'
  );
  const cobolErr = await executionEngine.execute('cobol', cobolBroken, cobolProb, {
    cobolBackend: 'server',
  });
  assert.equal(cobolErr.outcome, 'compile_error', 'COBOL syntax error must return compile_error');
  assert(cobolErr.diagnostics.length > 0, 'COBOL compile_error must include cobc diagnostics');
  console.log('  [OK] COBOL cobc compiler diagnostic verified');

  // 7. COBOL Infinite Loop Timeout
  const cobolLoop = cobolProb.solution.replace(
    /STOP RUN\./i,
    'PERFORM UNTIL 1 = 2\n  CONTINUE\nEND-PERFORM\nSTOP RUN.'
  );
  const cobolTimeout = await executionEngine.execute('cobol', cobolLoop, cobolProb, {
    cobolBackend: 'server',
    timeoutMs: 700,
  });
  assert.equal(cobolTimeout.timedOut, true, 'COBOL infinite PERFORM loop must time out');
  assert.equal(cobolTimeout.outcome, 'timeout');
  console.log('  [OK] COBOL infinite-loop SIGKILL timeout verified');

  // 8. COBOL Fixed-Format Conversion & Execution
  const fixedSolution = freeToFixedCobol(cobolProb.solution);
  const cobolFixedRes = await executionEngine.execute('cobol', fixedSolution, cobolProb, {
    cobolFormat: 'fixed',
    cobolBackend: 'server',
  });
  assert.equal(cobolFixedRes.allPassed, true, 'COBOL Fixed-Format solution must pass all tests');
  console.log('  [OK] COBOL Fixed-Format (Cols 7-72) execution verified');

  // 9. COBOL WebAssembly (@live-codes/cobol-wasm) Execution
  const cobolWasmRes = await executionEngine.execute('cobol', cobolProb.solution, cobolProb, {
    cobolFormat: 'free',
    cobolBackend: 'wasm',
    timeoutMs: 5000,
  });
  assert.equal(
    cobolWasmRes.allPassed,
    true,
    `COBOL WASM execution failed: ${JSON.stringify(cobolWasmRes.diagnostics)}`
  );
  assert.equal(cobolWasmRes.runnerUsed, 'cobol-wasm');
  console.log('  [OK] COBOL WebAssembly (@live-codes/cobol-wasm) execution verified');
}

async function main(): Promise<void> {
  auditCurriculumSchema();
  await verifyAllReferenceSolutions();
  await verifyNegativeAndSandboxCases();
  console.log('\nALL QA SOLUTION & SANDBOX VERIFICATION CHECKS PASSED 100%!');
}

main().catch((err) => {
  console.error('\nQA VERIFICATION FAILED:', err);
  process.exit(1);
});
