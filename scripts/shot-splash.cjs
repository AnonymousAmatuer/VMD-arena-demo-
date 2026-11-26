const {chromium}=require('@playwright/test');
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3000',{waitUntil:'networkidle'});await p.waitForTimeout(4200);
await p.screenshot({path:'artifacts/splash-v2.jpg',quality:88});
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(1200);
await p.screenshot({path:'artifacts/splash-v2-mobile.jpg',quality:85});
console.log('errors',errs.length?errs.join(' | '):'none');await b.close();})().catch(e=>{console.error('FAILED',e.message.slice(0,300));process.exit(1)});
