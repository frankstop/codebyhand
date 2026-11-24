import { expect, test, type Page } from '@playwright/test';
import { cobolSections, jsSections, rustSections } from '../src/curriculum';

function attachZeroConsoleErrorGuard(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

async function replaceCodeMirrorContent(page: Page, newCode: string): Promise<void> {
  const editor = page.locator('.cm-content');
  await editor.click();
  const selectAllCombo = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';
  await page.keyboard.press(selectAllCombo);
  await page.keyboard.press('Backspace');
  await editor.fill(newCode);
}

test.describe('CodeByHand End-to-End Verification Suite', () => {
  test('1. Language Hub taxonomy: 17 JS, 19 Rust, and 13 COBOL sections with hints & star slots', async ({
    page,
  }) => {
    const errors = attachZeroConsoleErrorGuard(page);

    await page.goto('/');
    await expect(page.locator('h1#hub-main-heading')).toHaveText('JavaScript');
    await expect(page.locator('.section-card')).toHaveCount(17);
    await expect(page.locator('.hint-badge').first()).toHaveText('H');

    // Switch to Rust
    await page.getByRole('link', { name: /Rust/ }).first().click();
    await expect(page.locator('h1#hub-main-heading')).toHaveText('Rust');
    await expect(page.locator('.section-card')).toHaveCount(19);

    // Switch to COBOL
    await page.getByRole('link', { name: /COBOL/ }).first().click();
    await expect(page.locator('h1#hub-main-heading')).toHaveText('COBOL');
    await expect(page.locator('.section-card')).toHaveCount(13);

    expect(errors).toEqual([]);
  });

  test('2. JS Workspace: sample cases, progressive hints, showsolution pre-solve, timeout, and 1 gold star after 3 solves', async ({
    page,
  }) => {
    const errors = attachZeroConsoleErrorGuard(page);
    const warmup1 = jsSections[0];
    const p1 = warmup1.problems[0];
    const p2 = warmup1.problems[1];
    const p3 = warmup1.problems[2];

    await page.goto(`/#/js/${warmup1.id}/${p1.slug}`);
    await expect(page.locator('h1.problem-title')).toHaveText(p1.title);

    // First 3 sample test cases rendered
    await expect(page.locator('.sample-case-item')).toHaveCount(3);

    // Progressive Hints drawer
    const hintDetails = page.locator('details.hint-disclosure');
    await hintDetails.locator('summary').click();
    await expect(hintDetails).toHaveAttribute('open', '');
    if (p1.hints.length > 1) {
      await page.getByRole('button', { name: /Next Hint/ }).click();
      await expect(page.locator('.hint-item')).toHaveCount(2);
    }

    // Warmup-1 has showsolution: true -> Show Solution available BEFORE solving
    const showSolBtn = page.getByRole('button', { name: 'Show Solution' });
    await expect(showSolBtn).toBeEnabled();
    await showSolBtn.click();
    await expect(page.locator('.solution-code-block')).toBeVisible();

    // Run wrong answer -> Fail row
    await replaceCodeMirrorContent(
      page,
      `function ${p1.functionName}() { return "wrong_value"; }`
    );
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner')).toContainText('Keep trying');
    await expect(page.locator('.status-pill.is-fail').first()).toBeVisible();

    // Run infinite loop -> Web Worker terminates at ~2,000ms and shows Timed out
    await replaceCodeMirrorContent(
      page,
      `function ${p1.functionName}() { while (true) {} }`
    );
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner')).toContainText('Timed out', {
      timeout: 8000,
    });

    // Solve problem 1 via Copy to Editor + Ctrl/Cmd+Enter shortcut
    await page.getByRole('button', { name: 'Copy to Editor' }).click();
    await page.locator('.cm-content').click();
    const runShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
    await page.keyboard.press(runShortcut);
    await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!');
    await expect(page.locator('.other-tests-row.is-pass')).toBeVisible();

    // Solve problems 2 and 3 in Warmup-1 to earn 1 Gold Star (1 star per 3 solved)
    for (const prob of [p2, p3]) {
      await page.goto(`/#/js/${warmup1.id}/${prob.slug}`);
      await replaceCodeMirrorContent(page, prob.solution);
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!');
    }

    // Verify Warmup-1 card on JS Hub now shows 3 solved & 1 earned gold star
    await page.goto('/#/js');
    const warmupCard = page.locator('.section-card').first();
    await expect(warmupCard).toContainText(`3 / ${warmup1.problems.length} solved`);
    await expect(warmupCard.locator('[aria-label*="1 of"]')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('3. showpost gating & chance navigation on non-warmup section', async ({ page }) => {
    const errors = attachZeroConsoleErrorGuard(page);
    const logic1 = jsSections.find((s) => s.id === 'logic-1')!;
    const target = logic1.problems.find((p) => !p.showsolution && p.showpost)!;

    await page.goto(`/#/js/${logic1.id}/${target.slug}`);
    await expect(page.locator('h1.problem-title')).toHaveText(target.title);

    // Locked before solving
    const lockedBtn = page.getByRole('button', { name: /Show Solution \(Locked\)/ });
    await expect(lockedBtn).toBeDisabled();

    // Solve problem -> Show Solution unlocks automatically
    await replaceCodeMirrorContent(page, target.solution);
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!');

    const unlockedBtn = page.getByRole('button', { name: 'Show Solution' });
    await expect(unlockedBtn).toBeEnabled();
    await unlockedBtn.click();
    await expect(page.locator('.solution-code-block')).toBeVisible();

    // Click `chance` -> jumps to a DIFFERENT unfinished problem in Logic-1
    await page.getByRole('button', { name: 'chance' }).click();
    await expect(page).not.toHaveURL(new RegExp(`${target.slug}$`));
    await expect(page).toHaveURL(/#\/js\/logic-1\//);

    expect(errors).toEqual([]);
  });

  test('4. Real Rust & COBOL (Fixed-Format switch + Browser WASM + Server cobc) execution, persistence & JSON export/import', async ({
    page,
  }) => {
    const errors = attachZeroConsoleErrorGuard(page);

    // --- Rust execution ---
    const rustProb = rustSections[0].problems[0];
    await page.goto(`/#/rust/${rustProb.sectionId}/${rustProb.slug}`);
    await replaceCodeMirrorContent(
      page,
      `pub fn ${rustProb.functionName}() -> i32 { "type_error" }`
    );
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner.is-error')).toContainText(
      'Compile / Syntax Error'
    );
    await expect(page.locator('.diagnostics-panel')).toBeVisible();

    await replaceCodeMirrorContent(page, rustProb.solution);
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!');

    // --- COBOL Fixed-Format + Server cobc + Browser WASM execution ---
    const cobolProb = cobolSections[0].problems[0];
    await page.goto(`/#/cobol/${cobolProb.sectionId}/${cobolProb.slug}`);
    await replaceCodeMirrorContent(page, cobolProb.solution);

    // Toggle Free -> Fixed format switch
    await page.getByText('Fixed-Format (Cols 7–72)').click();
    await expect(page.locator('.cobol-format-badge')).toHaveText('FIXED');

    // Run on Server cobc 3.2 in Fixed-Format
    await page.locator('select.cobol-runner-select').selectOption('server');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!');
    await expect(page.locator('.runner-chip')).toHaveText('cobc-server');

    // Switch back to Free-Format and run in-browser WebAssembly (@live-codes/cobol-wasm)
    await page.getByText('Fixed-Format (Cols 7–72)').click();
    await expect(page.locator('.cobol-format-badge')).toHaveText('FREE');
    await page.locator('select.cobol-runner-select').selectOption('wasm');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('.outcome-banner.is-pass')).toContainText('All Correct!', {
      timeout: 45_000,
    });
    await expect(page.locator('.runner-chip')).toHaveText('cobol-wasm');

    // --- Persistence + Done / Progress Export, Reset & Import ---
    await page.reload();
    await expect(page.locator('.solved-pill')).toContainText('Solved');

    await page.getByRole('link', { name: /Done \/ Progress/ }).click();
    await expect(page.locator('h1.page-title')).toHaveText('Done & Progress');
    await expect(page.locator('.done-subtitle')).toContainText('2 of');

    // Capture localStorage JSON (same payload exported by Export Progress)
    const exportedJson = await page.evaluate(() =>
      window.localStorage.getItem('codebyhand.progress.v1')
    );
    expect(exportedJson).toBeTruthy();

    // Also verify Export Progress button triggers a valid download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Progress (JSON)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('codebyhand-progress-');

    // Reset All Progress via native <dialog>
    await page.getByRole('button', { name: 'Reset All Progress' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Reset All Progress' }).click();
    await expect(page.locator('.done-subtitle')).toContainText('0 of');

    // Import Progress back via native <dialog>
    await page.getByRole('button', { name: 'Import Progress (JSON)' }).click();
    const importDialog = page.locator('dialog[open]');
    await importDialog.locator('textarea.import-textarea').fill(exportedJson!);
    await importDialog.getByRole('button', { name: 'Import Progress' }).click();
    await expect(page.locator('.done-subtitle')).toContainText('2 of');

    expect(errors).toEqual([]);
  });
});
