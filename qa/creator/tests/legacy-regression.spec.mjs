import {test,expect,boot,writeEvidence,assertNoOverflow} from './helpers.mjs';

test('legacy 53 catalog / 567 archive and supported navigation remain intact',async({page},testInfo)=>{
  await boot(page);
  await page.getByRole('link',{name:'研究与成果目录',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\//);
  await expect(page.locator('html')).toHaveAttribute('data-layout','B');
  await expect(page.locator('html')).toHaveAttribute('data-color','dark');
  const count=await page.locator('#catalog-data').evaluate(node=>JSON.parse(node.textContent).records.length);
  expect(count).toBe(53);
  await page.locator('.sidebar a[data-page="library"]').click();
  await expect(page.locator('#library')).toBeVisible();
  await expect(page.locator('#library-count')).toContainText('53 / 53');
  await expect(page.locator('#library-results [data-catalog-id]')).toHaveCount(53);
  await page.locator('#library-q').fill('synthetic-no-public-record-qa');
  await expect(page.locator('#library-count')).toContainText('0 / 53');
  await page.locator('#library-form button[type="reset"]').click();
  await expect(page.locator('#library-count')).toContainText('53 / 53');
  await page.locator('.sidebar a[data-page="tasks"]').click();
  await expect(page.locator('#tasks')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#library')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#tasks')).toBeVisible();
  await assertNoOverflow(page);
  await page.getByRole('link',{name:'六模块创作 · 演示',exact:true}).click();
  await expect(page.locator('#view-title')).toHaveText('工作台');

  // Inspect only counts, stable IDs and filtering. Do not attach archive text
  // or screenshots of the public conversation to the QA artifact.
  await page.getByRole('link',{name:'公开聊天',exact:true}).click();
  await expect(page.locator('article.record')).toHaveCount(567);
  const archive=await page.locator('article.record').evaluateAll(records=>({
    total:records.length,uniqueIds:new Set(records.map(item=>item.id)).size,
    users:records.filter(item=>item.dataset.role==='user').length,
  }));
  expect(archive.uniqueIds).toBe(567);
  await page.locator('#role').selectOption('user');
  await expect(page.locator('article.record:not([hidden])')).toHaveCount(archive.users);
  await page.locator('#query').fill('synthetic-no-public-record-qa');
  await expect(page.locator('#empty')).toBeVisible();
  await page.locator('#empty-reset').click();
  await expect(page.locator('article.record:not([hidden])')).toHaveCount(567);
  await page.getByRole('link',{name:'AI研究工作台',exact:true}).click();
  await expect(page.locator('#workbench')).toBeVisible();
  await page.getByRole('link',{name:'六模块创作 · 演示',exact:true}).click();
  await expect(page.locator('#view-title')).toHaveText('工作台');
  await writeEvidence(testInfo,'legacy-regression',{scope:'Read-only public count/filter/history/navigation regression; no remote status requests',catalogRecords:53,archiveRecords:archive.total,uniqueArchiveIds:archive.uniqueIds,defaultLayout:'B',defaultColor:'dark',creatorReturn:true,archiveContentAttached:false});
});
