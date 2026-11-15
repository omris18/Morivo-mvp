const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const fs=require('fs');
const S=process.argv[2], only=process.argv[3];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args:['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(`file://${S}/mk/video.html`, { waitUntil: 'load' });
  await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(1500);
  if (only) { for (const t of only.split(',')) { await page.evaluate(t=>window.setT(t), parseFloat(t)); await page.screenshot({ path: `${S}/mk/preview-${t}.jpg`, type:'jpeg', quality:80 }); } await browser.close(); return; }
  fs.mkdirSync(`${S}/mk/frames`,{recursive:true});
  const FPS=30, N=20*FPS;
  for (let i=0;i<N;i++){ await page.evaluate(t=>window.setT(t), i/FPS); await page.screenshot({ path: `${S}/mk/frames/f${String(i).padStart(4,'0')}.jpg`, type:'jpeg', quality:93 }); }
  await browser.close(); console.log('frames done');
})().catch(e=>{console.error(e);process.exit(1)});
