const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Listen for console messages from the page
  page.on('console', msg => {
    // A simplified logger, you can format this as you wish
    console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Construct the absolute file path
  const filePath = path.resolve(__dirname, 'string_scaling_simulation.html');

  try {
    // Go to the local HTML file
    await page.goto(`file://${filePath}`);

    console.log('Page loaded. Waiting for simulation to initialize...');

    // Wait for the simulation to be ready (e.g., canvas is present)
    await page.waitForSelector('#simulation-window canvas');
    console.log('Canvas found.');

    // --- Comprehensive Interaction Test ---

    console.log('\n--- Testing UI Interactions ---');

    // 1. Test Density Slider
    const initialDensity = await page.locator('#density-readout').textContent();
    console.log(`Initial density readout: ${initialDensity}`);
    await page.locator('#density-slider').fill('8');
    const newDensity = await page.locator('#density-readout').textContent();
    console.log(`New density readout after slider change: ${newDensity}`);
    if (newDensity === '8') {
      console.log('✅ Density slider test PASSED');
    } else {
      console.log('❌ Density slider test FAILED');
    }

    // 2. Test Expansion Model Dropdown
    await page.locator('#expansion-select').selectOption('matter');
    const newModel = await page.locator('#expansion-select').inputValue();
    console.log(`New expansion model value: ${newModel}`);
    if (newModel === 'matter') {
      console.log('✅ Expansion model test PASSED');
    } else {
      console.log('❌ Expansion model test FAILED');
    }

    // 3. Start, Run, and Verify Data
    await page.click('#start-sim-btn');
    console.log('\n--- Running Simulation ---');
    console.log('Clicked "Start/Pause", waiting 5 seconds...');
    await page.waitForTimeout(5000);

    const statsAfterRun = await page.locator('#quantitative-panel').textContent();
    const scalingParamAfterRun = statsAfterRun.match(/Scaling Parameter \(L\/t\): ([\d\.]+)/)[1];
    console.log(`Stats after 5s run. Scaling Param: ${scalingParamAfterRun}`);
    if (!isNaN(parseFloat(scalingParamAfterRun)) && scalingParamAfterRun !== "N/A") {
        console.log('✅ Data generation test PASSED');
    } else {
        console.log('❌ Data generation test FAILED');
    }

    // 4. Test Reset Button
    await page.click('#reset-sim-btn');
    console.log('\n--- Testing Reset ---');
    console.log('Clicked "Reset Simulation", waiting 2 seconds...');
    await page.waitForTimeout(2000);

    const statsAfterReset = await page.locator('#quantitative-panel').textContent();
    console.log(`Stats after reset: ${statsAfterReset.trim()}`);
    if (statsAfterReset.includes("Scaling Parameter (L/t): N/A")) {
        console.log('✅ Reset test PASSED');
    } else {
        console.log('❌ Reset test FAILED');
    }

    // 5. Final Screenshot
    const screenshotPath = 'scaling_simulation_screenshot.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`\nScreenshot saved to ${screenshotPath}`);

  } catch (error) {
    console.error('An error occurred during verification:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
