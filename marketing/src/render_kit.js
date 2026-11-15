const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const S=process.argv[2];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args:['--allow-file-access-from-files'] });
  for (const lang of ['he','en']) for (const size of ['story','feed']) {
    const h=size==='feed'?1350:1920;
    const page = await browser.newPage({ viewport: { width: 1080, height: h } });
    for (const piece of ['hook','steps','ai','book']) {
      await page.goto(`file://${S}/mk/kit.html?piece=${piece}&size=${size}&lang=${lang}`, { waitUntil: 'load' });
      await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(700);
      await page.screenshot({ path: `${S}/mk/out/morivo-${lang}-${piece}-${size==='feed'?'1080x1350':'1080x1920'}.png` });
    }
    await page.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
