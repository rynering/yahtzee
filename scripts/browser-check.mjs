import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
import {freshGame} from '../dist/engine.mjs';

const root=resolve('dist');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
await mkdir('artifacts/screenshots',{recursive:true});
try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:1000}]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('https://fonts.googleapis.com/**',route=>route.abort());
    const saved=freshGame();saved.dice=[2,3,4,5,6];saved.rolls=2;saved.scores.ones=0;saved.scores.twos=6;saved.scores.yahtzee=50;
    await context.addInitScript(state=>localStorage.setItem('lucky-roll-v1',JSON.stringify(state)),{game:saved,sound:false,records:[]});
    const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Resume game',exact:true}).click();
      await page.getByRole('button',{name:'Choose score',exact:true}).click();
      await page.waitForSelector('#score-dialog[open]');
      assert.deepEqual(await page.locator('.score-die-number').allTextContents(),['2','3','4','5','6']);
      assert.equal(await page.locator('.score-row').count(),10,'remaining filter must hide all used categories');
      assert.equal(await page.locator('.state-used').count(),0);
      const metrics=await page.evaluate(()=>({
        width:innerWidth,pageWidth:document.documentElement.scrollWidth,
        font:parseFloat(getComputedStyle(document.querySelector('.row-title')).fontSize),
        die:document.querySelector('.score-mini-die').getBoundingClientRect().width,
        pip:document.querySelector('.score-mini-die .pip.visible').getBoundingClientRect().width,
        listHeight:document.querySelector('#score-scroll').clientHeight,
        fullRows:[...document.querySelectorAll('.score-row')].filter(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#score-scroll').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}).length,
        rowOverflow:[...document.querySelectorAll('.score-row')].some(e=>e.scrollWidth>e.clientWidth+1),
        dialogOverflow:document.querySelector('#score-dialog').scrollWidth>document.querySelector('#score-dialog').clientWidth+1
      }));
      assert.ok(metrics.font>=16,'category text must stay readable');
      assert.ok(metrics.die>=46,'rolled dice must stay large');
      assert.ok(metrics.pip>=5,'die pips must stay readable');
      assert.ok(metrics.listHeight>=180&&metrics.fullRows>=4,'at least two rows per column must fit below the pinned dice: '+JSON.stringify(metrics));
      assert.ok(metrics.pageWidth<=metrics.width&&!metrics.rowOverflow&&!metrics.dialogOverflow,JSON.stringify(metrics));
      const before=await page.locator('#score-dice').boundingBox();
      await page.locator('#score-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
      const after=await page.locator('#score-dice').boundingBox();
      assert.ok(Math.abs(before.y-after.y)<1,'dice must remain fixed while categories scroll');
      const diceBox=await page.locator('#score-dice').boundingBox();
      assert.ok(diceBox.y>=0&&diceBox.y+diceBox.height<viewport.height,'dice must remain on screen');
      await page.locator('#score-filter-used').click();
      assert.equal(await page.locator('.state-used').count(),3);
      assert.equal(await page.locator('.score-row:enabled').count(),0);
      const usedZero=page.locator('[data-category="ones"]');
      assert.match(await usedZero.innerText(),/✓ Used/);
      assert.match(await usedZero.locator('.score-value').innerText(),/^0/,'a scratched zero must remain visibly used');
      await page.locator('#score-filter-all').click();
      assert.equal(await page.locator('.score-row').count(),13);
      assert.equal(await page.locator('.state-used').count(),3);
      assert.equal(await page.locator('.state-open').count(),10);
      await page.screenshot({path:`artifacts/screenshots/scorecard-${viewport.width}.png`});
      await page.locator('[data-category="full"]').click();
      assert.match(await page.locator('#confirm-score').innerText(),/Take a zero/);
      await page.locator('#close-score').click();
      await page.getByRole('button',{name:'Choose score',exact:true}).click();
      await page.locator('[data-category="chance"]').click();
      await page.getByRole('button',{name:'Score 20 points in Chance',exact:true}).click();
      await page.waitForSelector('#score-dialog',{state:'hidden'});
      assert.equal(await page.locator('#roll-status-label').innerText(),'Ready to roll');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lucky-roll-v1')).game.scores.chance),20);
      await page.getByRole('button',{name:'Roll dice',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#roll-status-label').textContent==='Roll 1 of 3'&&!document.querySelector('#roll').disabled);
      await page.getByRole('button',{name:'Roll again',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#roll-status-label').textContent==='Roll 2 of 3'&&!document.querySelector('#roll').disabled);
      await page.getByRole('button',{name:'Roll again',exact:true}).click();
      await page.waitForSelector('#score-dialog[open]');
      assert.equal(await page.locator('#score-roll-number').innerText(),'Roll 3 of 3');
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}×${viewport.height}: large dice/text, used and remaining categories, pinned dice, zero preview, scoring, and third-roll opening.`);
    }catch(e){await page.screenshot({path:`artifacts/screenshots/failure-${viewport.width}.png`});throw e;}
    finally{await context.close();}
  }
  const offline=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await offline.route('https://fonts.googleapis.com/**',route=>route.abort());
  const page=await offline.newPage();
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline installation timed out')),20000))]));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await offline.setOffline(true);await page.reload();
  assert.equal(await page.locator('#roll-status-label').innerText(),'Ready to roll');
  await page.getByRole('button',{name:'Roll dice',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#choose-score').disabled);
  await page.getByRole('button',{name:'Choose score',exact:true}).click();
  await page.waitForSelector('#score-dialog[open]');
  assert.equal(await page.locator('.score-die-number').count(),5);
  await offline.close();
  console.log('PASS offline: cached game loads, rolls, and opens the scorecard.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
