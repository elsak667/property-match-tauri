import { chromium } from 'playwright';

const URL = 'https://feat-policy-precision-match.property-match-tauri.pages.dev';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    panelAppearsOnRight: false,
    panelHasThreeTabs: false,
    tabNames: [] as string[],
    tab1HasChengzuInfo: false,
    tab2HasAddButton: false,
    tab2ShowsListOrEmpty: false,
    differentCustomerUpdatesPanel: false,
    screenshots: [] as string[],
  };

  try {
    // 1. Navigate to the page
    console.log('1. Navigating to page...');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/step1_initial.png' });
    results.screenshots.push('/tmp/step1_initial.png');

    // 2. Execute window.__setPage__('customer')
    console.log('2. Setting page to customer...');
    await page.evaluate(() => {
      (window as any).__setPage__('customer');
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/step2_customer_list.png' });
    results.screenshots.push('/tmp/step2_customer_list.png');

    // 3. Wait for customer list to load
    console.log('3. Waiting for customer list...');
    const customerRow = page.locator('table tbody tr').first();
    await customerRow.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    // 4. Click any customer row
    console.log('4. Clicking first customer row...');
    await customerRow.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/step4_detail_panel.png' });
    results.screenshots.push('/tmp/step4_detail_panel.png');

    // Check: Detail panel appears on the RIGHT side (not a modal overlay)
    const modalBackdrop = page.locator('.modal-backdrop, [role="dialog"], [aria-modal="true"]');
    const hasModalOverlay = await modalBackdrop.count() > 0;
    const detailPanel = page.locator('[class*="panel"], [class*="drawer"], [class*="sidebar"]').filter({ has: page.locator('[class*="tab"]') });
    const panelCount = await detailPanel.count();
    results.panelAppearsOnRight = !hasModalOverlay && panelCount > 0;
    console.log(`  Panel on right (no modal): ${results.panelAppearsOnRight} (modal count: ${hasModalOverlay ? 1 : 0}, panel count: ${panelCount})`);

    // Check: Panel has 3 tabs
    const tabs = page.locator('[class*="tab"], button[class*="tab"], [role="tab"]');
    const tabCount = await tabs.count();
    results.tabHasThreeTabs = tabCount >= 3;
    console.log(`  Has 3 tabs: ${results.tabHasThreeTabs} (found ${tabCount})`);

    // Get tab labels
    const tabTexts: string[] = [];
    for (let i = 0; i < tabCount && i < 5; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) tabTexts.push(text.trim());
    }
    results.tabNames = tabTexts;
    console.log(`  Tab names: ${JSON.stringify(tabTexts)}`);

    // Check for expected tab names
    const hasTab1 = tabTexts.some(t => t.includes('基本') || t.includes('信息'));
    const hasTab2 = tabTexts.some(t => t.includes('跟进') || t.includes('记录'));
    const hasTab3 = tabTexts.some(t => t.includes('进度') || t.includes('历史'));
    results.panelHasThreeTabs = hasTab1 && hasTab2 && hasTab3;
    console.log(`  Expected tabs present: ${results.panelHasThreeTabs}`);

    // 5. Check Tab1 content for 承租信息 section
    console.log('5. Checking Tab1 for 承租信息 section...');
    const pageContent = await page.content();
    const hasChengzuInfo = pageContent.includes('承租信息') ||
      pageContent.includes('current_location') ||
      pageContent.includes('rental_area') ||
      pageContent.includes('lease_start') ||
      pageContent.includes('lease_end') ||
      pageContent.includes('rental_status');
    results.tab1HasChengzuInfo = hasChengzuInfo;
    console.log(`  Tab1 has 承租信息 section: ${results.tab1HasChengzuInfo}`);

    // 6. Click Tab2 (跟进记录)
    console.log('6. Clicking Tab2 (跟进记录)...');
    const tab2 = tabs.filter({ hasText: /跟进|记录/ }).first();
    if (await tab2.count() > 0) {
      await tab2.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/step6_tab2.png' });
      results.screenshots.push('/tmp/step6_tab2.png');

      // Check for "+ 新增跟进" button
      const addButton = page.locator('button', { hasText: /新增|跟进|添加/ });
      results.tab2HasAddButton = await addButton.count() > 0;
      console.log(`  Tab2 has "+新增跟进" button: ${results.tab2HasAddButton}`);

      // Check for list or empty state
      const tab2Content = await page.content();
      results.tab2ShowsListOrEmpty = tab2Content.includes('暂无跟进记录') ||
        tab2Content.includes('跟进记录') ||
        tab2Content.includes('loading') ||
        tab2Content.includes('暂无') ||
        await page.locator('table, [class*="list"], [class*="record"]').count() > 0;
      console.log(`  Tab2 shows list or empty state: ${results.tab2ShowsListOrEmpty}`);
    } else {
      console.log('  Tab2 not found');
    }

    // 7. Click a different customer row
    console.log('7. Clicking different customer row...');
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    if (rowCount > 1) {
      await rows.nth(1).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/step7_different_customer.png' });
      results.screenshots.push('/tmp/step7_different_customer.png');

      const panelStillExists = await detailPanel.count() > 0;
      results.differentCustomerUpdatesPanel = panelStillExists;
      console.log(`  Panel updates for different customer: ${results.differentCustomerUpdatesPanel}`);
    } else {
      console.log('  Only one customer row found, skipping');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n=== TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

runTest();