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
      assert.equal(await page.locator('#needed-count').innerText(),'10 left');
      assert.equal(await page.locator('[data-needed]').count(),10);
      assert.equal(await page.locator('[data-needed="ones"], [data-needed="twos"], [data-needed="yahtzee"]').count(),0,'used categories, including zeroes, must not appear in the roll reminder');
      assert.equal(await page.locator('[data-needed="threes"], [data-needed="fours"], [data-needed="four"]').count(),3);
      const reminder=await page.locator('#needed-list').boundingBox(),dice=await page.locator('#dice').boundingBox();
      assert.ok(reminder.y+reminder.height<=dice.y,'remaining categories must sit above the dice');
      assert.ok(await page.locator('#needed-list').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'reminder must wrap without horizontal overflow');
      assert.ok(await page.locator('#needed-list').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=14),'reminder text must remain readable');
      await page.screenshot({path:`artifacts/screenshots/roll-reminder-${viewport.width}.png`});
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
      assert.equal(await page.locator('[data-needed="chance"]').count(),1,'previewing a score must not remove the reminder');
      await page.getByRole('button',{name:'Score 20 points in Chance',exact:true}).click();
      await page.waitForSelector('#score-dialog',{state:'hidden'});
      assert.equal(await page.locator('#roll-status-label').innerText(),'Ready to roll');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lucky-roll-v1')).game.scores.chance),20);
      assert.equal(await page.locator('#needed-count').innerText(),'9 left');
      assert.equal(await page.locator('[data-needed="chance"]').count(),0,'confirmed categories must leave the reminder');
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
  const awardCases=[
    {name:'yahtzee',width:390,height:844,id:'yahtzee',dice:[4,4,4,4,4],scores:{},total:50,award:50,motion:'no-preference'},
    {name:'upper',width:320,height:568,id:'sixes',dice:[6,6,6,1,2],scores:{ones:3,twos:6,threes:9,fours:12,fives:15},total:98,award:35,motion:'no-preference'},
    {name:'extra-yahtzee',width:390,height:844,id:'fives',dice:[5,5,5,5,5],scores:{yahtzee:50},total:175,award:100,motion:'no-preference'},
    {name:'combined',width:320,height:568,id:'sixes',dice:[6,6,6,6,6],scores:{ones:3,twos:6,threes:9,fours:12,fives:15,yahtzee:50},total:260,award:135,motion:'no-preference',interrupt:'new-game'},
    {name:'reduced-motion',width:390,height:844,id:'yahtzee',dice:[3,3,3,3,3],scores:{},total:50,award:50,motion:'reduce'},
    {name:'final-round',width:390,height:844,id:'yahtzee',dice:[2,2,2,2,2],scores:Object.fromEntries(['ones','twos','threes','fours','fives','sixes','three','four','full','small','large','chance'].map(k=>[k,0])),total:50,award:50,motion:'no-preference',finished:true},
    {name:'sound-on',width:390,height:844,id:'yahtzee',dice:[6,6,6,6,6],scores:{},total:50,award:50,motion:'no-preference',interrupt:'roll',sound:true}
  ];
  for(const spec of awardCases){
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},reducedMotion:spec.motion,serviceWorkers:'block'});
    await context.route('https://fonts.googleapis.com/**',r=>r.abort());
    const g=freshGame();g.rolls=1;g.dice=spec.dice;Object.assign(g.scores,spec.scores);
    const oldTotal=Object.values(g.scores).reduce((n,v)=>n+(v||0),0);
    await context.addInitScript(state=>{
      localStorage.setItem('lucky-roll-v1',JSON.stringify(state));
      window.__audioNotes=0;
      const create=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...args){window.__audioNotes++;return create.apply(this,args);};
    },{game:g,sound:!!spec.sound,records:[]});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Resume game',exact:true}).click();
      await page.getByRole('button',{name:'Choose score',exact:true}).click();
      await page.locator(`[data-category="${spec.id}"]`).click();
      const awardStarted=Date.now();
      await page.locator('#confirm-score').click();
      await page.waitForSelector('#score-dialog',{state:'hidden'});
      await page.waitForSelector('#score-celebration',{state:'visible'});
      assert.equal(await page.locator('dialog[open]').count(),0,'an award must not open a modal or obscure the game');
      assert.equal(await page.locator('#bonus-dialog').count(),0);
      assert.ok(await page.locator('#inline-award-points').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=36),'added points must be prominent');
      assert.ok(await page.locator('#score-celebration').evaluate(e=>getComputedStyle(e).color===getComputedStyle(e.querySelector('#inline-award-points')).color&&getComputedStyle(e).color===getComputedStyle(e.querySelector('#inline-award-total')).color),'award numbers must retain dark, readable text on gold');
      assert.ok(await page.locator('#roll').isEnabled(),'the player can roll while the points animate');
      assert.ok(await page.locator('#new-game').isEnabled());
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('lucky-roll-v1')));
      const sum=Object.values(stored.game.scores).reduce((n,v)=>n+(v||0),0)+stored.game.extra+(Object.values(stored.game.scores).slice(0,6).reduce((n,v)=>n+(v||0),0)>=63?35:0);
      assert.equal(sum,spec.total,'the real score must already be saved');
      const awardBox=await page.locator('#score-celebration').boundingBox(),diceBox=await page.locator('#dice').boundingBox(),rollBox=await page.locator('#roll').boundingBox();
      assert.ok(awardBox.y>=0&&awardBox.y+awardBox.height<=spec.height,'in-place award must stay on screen');
      assert.ok(diceBox.y>=0&&diceBox.y+diceBox.height<=awardBox.y,'the scored dice remain visible above the award');
      assert.ok(awardBox.y+awardBox.height<=rollBox.y,'the award must not cover the Roll button');
      for(let i=0;i<5;i++)assert.match(await page.locator(`[data-die="${i}"]`).getAttribute('aria-label'),new RegExp(`: ${spec.dice[i]}\\.`),'the roll screen must retain the dice that earned the award');
      if(spec.motion==='reduce'){
        assert.equal(await page.locator('#inline-award-total').innerText(),String(spec.total));
        assert.equal(await page.locator('#inline-award-points').evaluate(e=>e.getAnimations().length),0);
        assert.equal(await page.locator('#current-score').evaluate(e=>e.getAnimations().length),0);
      }else{
        await page.waitForFunction(({from,to})=>{const n=Number(document.querySelector('#inline-award-total').textContent);return n>from&&n<to;},{from:oldTotal,to:spec.total});
      }
      assert.ok(await page.evaluate(()=>document.querySelector('#current-score').textContent===document.querySelector('#inline-award-total').textContent),'the in-place tally and main score stay in sync');
      if(['yahtzee','upper','combined'].includes(spec.name))await page.screenshot({path:`artifacts/screenshots/inline-award-${spec.name}.png`});
      const notes=await page.evaluate(()=>window.__audioNotes);
      assert.ok(spec.sound?notes>0:notes===0,'inline award audio must follow the sound toggle');
      if(spec.interrupt==='new-game'){
        await page.getByRole('button',{name:'New game',exact:true}).click();
        await page.getByRole('button',{name:'Start new game',exact:true}).click();
        await page.waitForTimeout(1800);
        assert.equal(await page.locator('#current-score').innerText(),'0');
        assert.equal(await page.locator('#score-celebration').isVisible(),false,'restart must cancel the previous count-up');
        assert.equal(await page.locator('#needed-count').innerText(),'13 left');
      }else if(spec.interrupt==='roll'){
        await page.getByRole('button',{name:'Roll dice',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('#roll').disabled);
        assert.equal(await page.locator('#score-celebration').isVisible(),false);
        assert.equal(await page.locator('#current-score').innerText(),String(spec.total),'starting another roll must settle the correct total');
      }else{
        await page.waitForFunction(to=>document.querySelector('#inline-award-total').textContent===String(to)&&!document.querySelector('.stats').classList.contains('score-counting'),spec.total);
        assert.equal(await page.locator('#inline-award-points').innerText(),'+'+spec.award);
        if(spec.name==='yahtzee')assert.ok(Date.now()-awardStarted>=3400,'keep the readable count-up timing');
        if(spec.name==='yahtzee'||spec.motion==='reduce'){
          await page.waitForTimeout(1800);
          assert.ok(await page.locator('#score-celebration').isVisible(),'award remains readable until the player starts another roll');
        }
        assert.equal(await page.locator('#current-score').innerText(),String(spec.total));
        if(spec.finished){
          assert.equal(stored.records[0].score,spec.total);
          assert.equal(await page.locator('dialog[open]').count(),0,'a final-round award remains on the current screen too');
          assert.equal(await page.locator('#needed-count').innerText(),'0 left');
          await page.getByRole('button',{name:'Play again',exact:true}).click();
          assert.equal(await page.locator('#current-score').innerText(),'0');
          assert.equal(await page.locator('#score-celebration').isVisible(),false);
        }else{
          await page.locator('#view-scorecard').click();
          assert.equal(await page.locator('#total-score').innerText(),String(spec.total));
          await page.locator('#close-score').click();
          assert.ok(await page.locator('#score-celebration').isVisible());
        }
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS inline award ${spec.name}: no popup, readable dice and points, live controls, correct saved total, and safe interruptions.`);
    }catch(e){await page.screenshot({path:`artifacts/screenshots/failure-inline-${spec.name}.png`});throw e;}
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
