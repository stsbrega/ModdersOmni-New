import { test, expect } from '@playwright/test';

/**
 * Verifies that clicking "Generate Modlist" on the final step of the setup
 * wizard immediately routes the user to /generate/client-pipeline-pending
 * (the synthetic placeholder route that the in-browser pipeline boots into).
 *
 * Strategy: rather than driving the full 4-step wizard through the UI, we
 * preload sessionStorage with the wizard's own refresh-recovery snapshot.
 * SetupComponent.ngOnInit reads that snapshot and lands the user directly on
 * step 4 with prior selections restored. We also seed an Anthropic-shaped
 * key into localStorage so pickLlmConfig() resolves a whitelisted provider.
 */
test('Generate button routes to /generate/client-pipeline-pending', async ({
  page,
}) => {
  // Seed storage BEFORE Angular bootstraps so the wizard restores state on
  // its very first render.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'setup_wizard_progress',
      JSON.stringify({
        gameId: 1, // Skyrim Special Edition (synthetic id from games.json)
        gameVersion: 'SE',
        gameVersions: ['SE', 'AE'],
        specs: {
          gpu: 'NVIDIA GeForce RTX 4070',
          vram_mb: 12288,
          cpu: 'AMD Ryzen 7 7800X3D',
          ram_gb: 32,
          cpu_cores: 8,
          cpu_speed_ghz: 4.2,
          storage_drives: 'C: 500 GB free',
        },
        timestamp: Date.now(),
      }),
    );

    // An Anthropic-shaped sk-ant-* key so detectProvider + pickLlmConfig
    // accept it. Value is fake — the pipeline call will fail later, but
    // navigation happens BEFORE any network round-trip.
    localStorage.setItem(
      'settings.llmKeys',
      JSON.stringify({
        anthropic: 'sk-ant-api03-FAKE_E2E_KEY_FOR_NAVIGATION_TEST_ONLY',
      }),
    );
  });

  await page.goto('/setup');

  // Wizard should land directly on step 4 — the "Customize Your Modlist"
  // heading is the visible signal.
  await expect(
    page.getByRole('heading', { name: 'Customize Your Modlist' }),
  ).toBeVisible();

  // Step 4 needs at least one preference to enable the Generate button.
  // Typing into the "Describe Your Vision" textarea is the lightest path —
  // no dependency on preset cards being loaded.
  await page
    .getByPlaceholder(/dark souls-like combat/i)
    .fill('A heavy combat overhaul with survival mechanics.');

  const generateButton = page.getByRole('button', {
    name: /generate modlist/i,
  });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  // The fix under test: navigation happens immediately on click, using the
  // 'client-pipeline-pending' placeholder rather than waiting for the
  // pipeline's StoredSession to resolve.
  await expect(page).toHaveURL(/\/generate\/client-pipeline-pending$/);
});
