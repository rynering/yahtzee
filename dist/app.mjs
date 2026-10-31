import {categories,freshGame,available,scoreFor,totals,commit,isYahtzee} from './engine.mjs';
import {celebrationFor} from './celebration.mjs?v=9';
const $=id=>document.getElementById(id),KEY='lucky-roll-v1';
let storageOK=true,saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{storageOK=false;}
function validGame(g){return g&&Array.isArray(g.dice)&&g.dice.length===5&&g.dice.every(x=>Number.isInteger(x)&&x>=1&&x<=6)&&Array.isArray(g.held)&&g.held.length===5&&g.held.every(x=>typeof x==='boolean')&&Number.isInteger(g.rolls)&&g.rolls>=0&&g.rolls<=3&&Number.isInteger(g.extra)&&g.extra>=0&&g.scores&&categories.every(c=>g.scores[c.id]===null||(Number.isInteger(g.scores[c.id])&&g.scores[c.id]>=0&&g.scores[c.id]<=50));}
let resumableGame=validGame(saved.game)&&(saved.game.rolls>0||categories.some(c=>saved.game.scores[c.id]!==null))?saved.game:null;
let game=freshGame(),sound=saved.sound!==false,records=Array.isArray(saved.records)?saved.records.filter(r=>Number.isInteger(r.score)&&r.score>=0&&typeof r.date==='string').slice(0,10):[];
let scoreFilter='remaining';
let selected=null,rolling=false,scoring=false,audioContext,installPrompt=null,finishInlineCelebration=null,inlineCelebration=null;
const completed=()=>categories.every(c=>game.scores[c.id]!==null);
function persist(){try{localStorage.setItem(KEY,JSON.stringify({game:resumableGame||game,sound,records}));}catch{storageOK=false;$('save-note').textContent='Saving is unavailable in this browser. Keep this tab open to continue.';}}
const pips={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function dieMarkup(value){return Array.from({length:9},(_,i)=>`<span class="pip ${pips[value].includes(i)?'visible':''}"></span>`).join('');}
function renderDice(){
  const focus=document.activeElement?.dataset?.die,unrolled=game.rolls===0&&!rolling&&!completed()&&!inlineCelebration;
  const shownDice=inlineCelebration?.dice||game.dice;
  $('dice').innerHTML=shownDice.map((value,i)=>`<div class="die-wrap ${game.held[i]?'is-held':''}" style="--roll-delay:${i*35}ms;--rest-angle:${[-7,4,0,-4,7][i]}deg"><button class="die ${unrolled?'unrolled':''}" data-die="${i}" aria-label="${unrolled?`Die ${i+1}: not rolled yet`:`Die ${i+1}: ${value}. ${game.held[i]?'Held. Tap to release.':'Tap to hold.'}`}" aria-pressed="${game.held[i]}" ${!game.rolls||rolling||scoring||completed()?'disabled':''}>${unrolled?'<span class="unrolled-mark" aria-hidden="true">?</span>':dieMarkup(value)}</button><span class="held-tag">${game.held[i]?'HELD':''}</span></div>`).join('');
  if(focus!==undefined)$('dice').querySelector(`[data-die="${focus}"]`)?.focus({preventScroll:true});
}
function renderRows(){
  const allowed=available(game),ready=game.rolls>0&&!rolling&&!scoring&&!completed();
  const row=c=>{
    const used=game.scores[c.id]!==null,possible=ready&&!used&&allowed.includes(c.id);
    const points=used?game.scores[c.id]:possible?scoreFor(c.id,game):'—';
    const state=used?'used':possible?'open':'waiting';
    const status=used?'✓ Used':possible?'Available':ready?'Joker rule':'Not rolled yet';
    return `<button class="score-row state-${state} ${selected===c.id?'selected':''}" data-category="${c.id}" ${!possible?'disabled':''} aria-pressed="${selected===c.id}" aria-label="${c.name}: ${used?`${points} points, already used`:possible?`${points} points available. ${c.hint}. Select to score`:status}" title="${c.hint}"><span class="row-copy"><span class="row-title">${c.name}</span><span class="category-status">${status}</span></span><span class="score-value ${used?'locked':possible?'possible':''} ${points===0?'zero':''}">${points}<span class="points-label">pts</span></span></button>`;
  };
  const visible=c=>scoreFilter==='all'||(scoreFilter==='used'?game.scores[c.id]!==null:game.scores[c.id]===null);
  const empty=`<p class="empty-section">${scoreFilter==='used'?'No categories used here yet.':'All categories here are used.'}</p>`;
  $('upper-rows').innerHTML=categories.slice(0,6).filter(visible).map(row).join('')||empty;
  $('lower-rows').innerHTML=categories.slice(6).filter(visible).map(row).join('')||empty;
  const used=categories.filter(c=>game.scores[c.id]!==null).length;
  $('remaining-count').textContent=13-used;$('used-count').textContent=used;
  for(const filter of ['remaining','used','all'])$('score-filter-'+filter).setAttribute('aria-pressed',String(scoreFilter===filter));
}

function render(){
  const t=totals(game),filled=categories.filter(c=>game.scores[c.id]!==null).length,done=completed();
  $('resume-banner').hidden=!resumableGame;
  $('new-game').disabled=rolling||scoring;
  $('current-score').textContent=inlineCelebration?.displayTotal??t.total;$('total-score').textContent=inlineCelebration?.displayTotal??t.total;$('best-score').textContent=records.length?Math.max(...records.map(r=>r.score)):'—';$('round').textContent=Math.min(filled+1,13);$('filled-count').textContent=`${filled} of 13 filled`;
  $('bonus-count').textContent=`${t.upper} / 63`;$('bonus-fill').style.width=`${Math.min(t.upper/63*100,100)}%`;$('bonus-text').textContent=t.bonus?'Bonus earned: +35 points':`${Math.max(63-t.upper,0)} points to the +35 bonus`;
  $('extra-bonus').hidden=!game.extra;$('extra-bonus').textContent=`✧ Extra Yahtzee bonus +${game.extra}`;
  const displayedRoll=game.rolls+(rolling?1:0);
  $('roll-counter').textContent=done?'ALL 13 ROUNDS COMPLETE':displayedRoll?`ROLL ${displayedRoll} OF 3`:'YOUR FIRST ROLL AWAITS';
  $('roll-status-label').textContent=done?'Game complete':displayedRoll?`Roll ${displayedRoll} of 3`:'Ready to roll';
  $('roll-status-detail').textContent=done?'All 13 rounds scored':rolling?'Dice in motion…':!game.rolls?'3 rolls available this turn':game.rolls===3?'No rolls left — choose your score':`${3-game.rolls} roll${game.rolls===1?'s':''} left — hold dice or score now`;
  const needed=categories.filter(c=>game.scores[c.id]===null);
  $('needed-count').textContent=`${needed.length} left`;
  $('needed-list').innerHTML=needed.length===13?'<li>All 13 categories are open.</li>':needed.length?needed.map(c=>`<li data-needed="${c.id}">${c.name}</li>`).join(''):'<li>All categories filled. Nicely played!</li>';
  $('hold-hint').textContent=done?`Final score: ${t.total} points`:rolling?'Let the dice decide…':!game.rolls?'Roll the dice to get started':game.rolls===3?'Out of rolls? You’re right on time. Choose your score.':`${game.held.filter(Boolean).length} held · Tap any die to keep or release it`;
  $('roll-label').textContent=done?'Play again':rolling?'Rolling…':game.rolls===3?'Rolls used':game.rolls?'Roll again':'Roll dice';$('roll').disabled=rolling||scoring||(!done&&(game.rolls>=3||(game.rolls>0&&game.held.every(Boolean))));
  $('choose-score').disabled=rolling||scoring||(!game.rolls&&!done);
  $('choose-score').textContent=done?'View scores':'Choose score';
  $('view-scorecard').disabled=rolling||scoring;
  $('score-dialog-title').textContent=done?'Final scorecard':game.rolls?'Choose score':'Your scorecard';
  $('score-dialog-hint').textContent=done?'All 13 rounds complete. Well played.':!game.rolls?'Roll first to start scoring.':available(game).length===1&&game.scores.yahtzee!==null&&isYahtzee(game.dice)?'Joker rule: choose the matching upper category.':scoreFilter==='used'?'These categories are already used and locked.':scoreFilter==='all'?'Available categories can be chosen. Used ones are locked.':'Choose a remaining category, then confirm.';
  $('score-roll-number').textContent=done?'Game complete':game.rolls?`Roll ${game.rolls} of 3`:'Ready to roll';
  $('score-dice').setAttribute('aria-label',game.rolls||done?`Dice: ${game.dice.join(', ')}`:'Dice not rolled yet');
  $('score-dice').innerHTML=game.dice.map((value,i)=>`<span class="score-die-item" aria-hidden="true"><span class="score-mini-die ${game.held[i]?'mini-held':''}">${game.rolls||done?dieMarkup(value):'<span class="score-unrolled">?</span>'}</span><strong class="score-die-number">${game.rolls||done?value:'—'}</strong></span>`).join('');
  $('roll-progress').innerHTML=Array.from({length:3},(_,i)=>`<i class="${i+1===displayedRoll?'current':i<displayedRoll?'used':''}">${i+1}</i>`).join('');
  $('sound').innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4z"/>${sound?'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>':'<path d="m16 9 6 6m0-6-6 6"/>'}</svg> Sound ${sound?'on':'off'}`;$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',`Sound ${sound?'on. Turn off':'off. Turn on'}`);
  renderDice();renderRows();
  if(selected){const c=categories.find(c=>c.id===selected),v=scoreFor(selected,game);$('score-action').innerHTML=`<p class="selected-description">${c.name} · ${c.hint}</p><button id="confirm-score">${v===0?'Take a zero':`Score ${v} point${v===1?'':'s'}`} in ${c.name}</button>`;}
  else $('score-action').innerHTML=`<p>${done?'Your completed scorecard.':game.rolls?'Choose a category above to see your score.':'Roll the dice first. Your three rolls are waiting.'}</p><button id="back-to-dice" class="score-back-button">Back to dice</button>`;
  renderInlineCelebration();
  if(!storageOK)$('save-note').textContent='Saving is unavailable in this browser. Keep this tab open to continue.';
}
function tone(freq=440,duration=.08,delay=0,type='sine',gain=.045){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});const o=audioContext.createOscillator(),g=audioContext.createGain(),at=audioContext.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,at);g.gain.setValueAtTime(gain,at);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g);g.connect(audioContext.destination);o.start(at);o.stop(at+duration);}catch{}}
function randomDie(){const bytes=new Uint32Array(1);let n;do{crypto.getRandomValues(bytes);n=bytes[0];}while(n>=4294967292);return n%6+1;}
async function roll(){
  if(rolling||scoring)return;
  if(completed()){reset();return;}
  if(game.rolls>=3||(game.rolls&&game.held.every(Boolean)))return;
  finishInlineCelebration?.(true);
  resumableGame=null;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const result=game.dice.map((d,i)=>game.held[i]?d:randomDie());
  selected=null;rolling=true;$('announcement').textContent='';render();
  $('dice').classList.add('rolling');
  for(let i=0;i<8;i++)tone(130+i*45,.045,i*.085,'triangle',.035);
  const started=performance.now();
  const frames=reducedMotion?null:setInterval(()=>{
    document.querySelectorAll('.die').forEach((d,i)=>{
      if(!game.held[i])d.innerHTML=dieMarkup(performance.now()-started>620+i*35?result[i]:randomDie());
    });
  },65);
  await new Promise(r=>setTimeout(r,reducedMotion?150:1000));
  if(frames!==null)clearInterval(frames);
  game.dice=result;game.rolls++;rolling=false;
  $('dice').classList.remove('rolling');persist();render();
  $('announcement').textContent=`Roll ${game.rolls} of 3: ${game.dice.join(', ')}. ${3-game.rolls} rolls left.`;
  if(isYahtzee(game.dice)){[523,659,784,1047].forEach((f,i)=>tone(f,.25,i*.12));celebrate();}
  if(game.rolls===3)openScorecard();
}
function openScorecard(){
  if(rolling||scoring)return;
  finishInlineCelebration?.(false);
  selected=null;scoreFilter=completed()?'used':'remaining';render();
  if(!$('score-dialog').open)$('score-dialog').showModal();
  document.body.classList.add('score-open');
}
function closeScorecard(){
  if($('score-dialog').open)$('score-dialog').close();
  document.body.classList.remove('score-open');
}
function showModal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function rules(){showModal(`<div class="eyebrow">THE CLASSIC RULES</div><h2>A little refresher.</h2><ol><li><strong>Roll up to three times.</strong> Tap dice to hold or release them between rolls. You can score after any roll.</li><li><strong>Choose one category.</strong> Preview the points on your scorecard, then confirm. Each category can be used once, even if you take a zero.</li><li><strong>Play all 13 rounds.</strong> Your goal is the highest total. There’s no timer, so take your time.</li></ol><h3>How the scoring works</h3><p>Ones through Sixes: add only the matching dice. Reach 63 in the upper section to earn a 35-point bonus.</p><p>Three or Four of a kind: add all five dice if you have at least three or four matching dice. Full house: exactly three of one number and two of another for 25. Small straight: four consecutive numbers for 30. Large straight: five consecutive numbers for 40. Yahtzee: five matching dice for 50. Chance: add all five dice.</p><h3>Extra Yahtzees & the Joker rule</h3><p>Once your Yahtzee box is filled, another five of a kind must go in its matching upper box if that box is empty. Otherwise, use an open lower box: full house and straights receive their fixed scores. If all lower boxes are filled, take zero in an open upper box. Each extra Yahtzee adds 100 bonus points only if your Yahtzee box contains 50.</p><h3>Keep it close</h3><p>Your game, sound setting, and ten best completed scores are saved in this browser. They don’t sync between devices. Clearing this site’s data removes them.</p><button class="secondary-button" id="install-help">Add to your home screen ↗</button><div class="dialog-actions"><button class="primary-button" data-close>Let’s roll</button></div>`);}
function history(){showModal(`<div class="eyebrow">A LITTLE FRIENDLY COMPETITION</div><h2>Your personal bests.</h2>${records.length?`<ol class="record-list">${records.map((r,i)=>`<li><span>${i===0?'♜':'#'+(i+1)} &nbsp; ${new Date(r.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><strong>${r.score}</strong></li>`).join('')}</ol>`:'<p>A clean slate, full of possibility. Finish your first game to put a score on the board.</p>'}<p>Saved on this device · Completed games only</p><div class="dialog-actions"><button class="primary-button" data-close>Back to the game</button></div>`);}
function reset(){finishInlineCelebration?.(true);closeScorecard();resumableGame=null;game=freshGame();selected=null;persist();render();$('announcement').textContent='A new game is ready. Click Roll to take your first roll.';$('modal').close();}
function requestReset(){if(rolling||scoring)return;if(!game.rolls&&!categories.some(c=>game.scores[c.id]!==null)){reset();return;}if(completed()){reset();return;}showModal('<div class="eyebrow">A FRESH START</div><h2>Start a new game?</h2><p>Your current game will be cleared. Your personal bests will stay safe.</p><div class="dialog-actions"><button class="secondary-button" data-close>Keep playing</button><button class="primary-button" id="reset-confirm">Start new game</button></div>');}
function confirmScore(){
  if(!selected||rolling||scoring)return;
  finishInlineCelebration?.(true);scoring=true;
  const id=selected,name=categories.find(c=>c.id===id).name,result=commit(game,id);
  const award=celebrationFor(game,result,id);
  const previousBest=records.length?Math.max(...records.map(r=>r.score)):-1;
  closeScorecard();game=result.game;selected=null;
  const final=totals(game).total;
  if(result.finished){
    records.push({score:final,date:new Date().toISOString()});
    records.sort((a,b)=>b.score-a.score);records=records.slice(0,10);
  }
  persist();scoring=false;render();
  if(award)playInlineCelebration(award);
  else{tone(523,.12);tone(659,.16,.09);}
  if(result.finished){
    celebrate();
    $('announcement').textContent=`${final>previousBest?'New personal best! ':''}Game complete. ${final} points, saved on this device.`;
  }else{
    $('announcement').textContent=award?`${award.title} ${award.award} points earned. Total ${final}. Ready for the next round.`:`${name}: ${result.points} points. Ready for the next round.`;
  }
  $('roll').focus({preventScroll:true});
}
function renderInlineCelebration(){
  const banner=$('score-celebration');
  banner.hidden=!inlineCelebration;
  document.querySelector('.roll-status').classList.toggle('has-award',!!inlineCelebration);
  document.querySelector('.stats').classList.toggle('score-counting',!!inlineCelebration&&!inlineCelebration.done);
  if(!inlineCelebration)return;
  $('inline-award-label').textContent=inlineCelebration.label;
  $('inline-award-points').textContent=`+${inlineCelebration.points}`;
  $('inline-award-total').textContent=inlineCelebration.displayTotal;
}
function playInlineCelebration(plan){
  finishInlineCelebration?.(true);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const awards=plan.steps.filter(s=>s.kind!=='score');
  const label=awards.length>1?'BONUS POINTS!':awards[0].kind==='upper'?'UPPER BONUS!':awards[0].label.toUpperCase();
  const state={...plan,displayTotal:reduced?plan.to:plan.from,label,points:plan.award,done:false};
  inlineCelebration=state;
  let stopped=false,frame=null;
  const timers=new Set();
  const total=value=>{
    if(inlineCelebration!==state)return;
    state.displayTotal=value;
    for(const id of ['current-score','total-score','inline-award-total'])$(id).textContent=value;
  };
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!stopped)fn();},ms);timers.add(id);};
  const finish=(clear=true)=>{
    if(stopped&&finishInlineCelebration!==finish)return;
    stopped=true;if(frame!==null)cancelAnimationFrame(frame);timers.forEach(clearTimeout);
    $('inline-award-points').getAnimations().forEach(a=>a.cancel());
    total(totals(game).total);state.done=true;state.label=label;state.points=plan.award;
    if(clear&&inlineCelebration===state)inlineCelebration=null;
    if(finishInlineCelebration===finish)finishInlineCelebration=null;
    // A completed banner stays readable until the next roll or new game.
    if(!clear)finishInlineCelebration=finish;
    renderInlineCelebration();
  };
  finishInlineCelebration=finish;render();
  const complete=()=>{
    total(plan.to);state.done=true;state.label=label;state.points=plan.award;renderInlineCelebration();
    [523,659,784,1047].forEach((frequency,i)=>tone(frequency,.2,i*.09,'sine',.045));
  };
  if(reduced){complete();return;}
  function stepAt(index){
    if(stopped||inlineCelebration!==state)return;
    if(index===plan.steps.length){complete();return;}
    const step=plan.steps[index],points=$('inline-award-points');
    if(step.kind!=='score'){
      state.label=step.kind==='upper'?'UPPER BONUS!':step.label.toUpperCase();state.points=step.points;
      renderInlineCelebration();
      points.getAnimations().forEach(a=>a.cancel());
      points.animate([{transform:'translateY(10px) scale(.85)',opacity:.4},{transform:'translateY(0) scale(1.08)',opacity:1},{transform:'translateY(0) scale(1)',opacity:1}],{duration:700,easing:'ease-out'});
    }
    tone(step.kind==='score'?440:660,.12,0,'triangle',.035);
    const start=performance.now(),duration=step.kind==='score'?700:2800;let lastTone=start;
    const tick=now=>{
      if(stopped||inlineCelebration!==state)return;
      const progress=Math.min(1,(now-start)/duration),eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2;
      total(step.from+Math.floor(step.points*eased));
      if(now-lastTone>260&&progress<.95){tone(460+progress*360,.045,0,'sine',.025);lastTone=now;}
      if(progress<1){frame=requestAnimationFrame(tick);return;}
      total(step.to);later(()=>stepAt(index+1),450);
    };
    frame=requestAnimationFrame(tick);
  }
  later(()=>stepAt(0),650);
}

function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const layer=document.createElement('div');layer.className='celebrate';layer.setAttribute('aria-hidden','true');for(let i=0;i<45;i++){const piece=document.createElement('i');piece.className='confetti';piece.style.cssText=`left:${Math.random()*100}%;background:${['#d8b878','#805263','#f6eddc','#c3a48e'][i%4]};animation-delay:${Math.random()*.7}s;animation-duration:${1.7+Math.random()}s;`;layer.append(piece);}document.body.append(layer);setTimeout(()=>layer.remove(),3600);}
function installHelp(){showModal(`<div class="eyebrow">YOUR FAVORITE GAME. ONE TAP AWAY.</div><h2>Make yourself at home.</h2><p>Open this game’s link on the phone or tablet where you want to play.</p><h3>iPhone or iPad</h3><p>Open in <strong>Safari</strong>, tap <strong>Share</strong> (the square with an arrow), choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. You may need to tap “More” to find it.</p><h3>Android</h3><p>Open in <strong>Chrome</strong>, tap the <strong>⋮ menu</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p><h3>On a computer</h3><p>Chrome and Edge offer an install button in the address bar when installation is available.</p><p>After the first complete online visit, the game works offline. Play in the installed app to keep all its scores together.</p>${installPrompt?'<button class="primary-button" id="install-now">Install Lucky Roll</button>':''}<div class="dialog-actions"><button class="secondary-button" data-close>Got it</button></div>`);}
$('roll').addEventListener('click',roll);$('new-game').addEventListener('click',requestReset);$('rules').addEventListener('click',rules);$('history').addEventListener('click',history);$('sound').addEventListener('click',()=>{finishInlineCelebration?.(false);sound=!sound;persist();render();tone(660,.08);});
$('choose-score').addEventListener('click',openScorecard);
$('score-filters').addEventListener('click',e=>{const button=e.target.closest('[data-score-filter]');if(!button)return;scoreFilter=button.dataset.scoreFilter;selected=null;render();$('score-scroll').scrollTop=0;});
$('view-scorecard').addEventListener('click',openScorecard);
$('close-score').addEventListener('click',closeScorecard);
$('score-dialog').addEventListener('close',()=>document.body.classList.remove('score-open'));
$('resume-game').addEventListener('click',()=>{if(!resumableGame||rolling)return;finishInlineCelebration?.(true);game=resumableGame;resumableGame=null;selected=null;persist();render();$('announcement').textContent=`Saved game resumed. ${completed()?'Game complete.':game.rolls?`Roll ${game.rolls} of 3, with ${3-game.rolls} rolls left.`:'Ready for the first roll of this turn.'}`;});
$('dice').addEventListener('click',e=>{const b=e.target.closest('[data-die]');if(!b||rolling||!game.rolls||completed()||b.disabled)return;const i=Number(b.dataset.die);game.held[i]=!game.held[i];tone(game.held[i]?520:360,.05);persist();render();});
document.querySelector('.scorecard').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b&&!b.disabled){selected=selected===b.dataset.category?null:b.dataset.category;render();if(selected)$('confirm-score').focus({preventScroll:true});}if(e.target.closest('#confirm-score'))confirmScore();if(e.target.closest('#back-to-dice'))closeScorecard();});
$('modal').addEventListener('click',async e=>{if(e.target.closest('[data-close],.close-modal'))$('modal').close();if(e.target.id==='reset-confirm')reset();if(e.target.id==='view-final-score'){$('modal').close();openScorecard();}if(e.target.id==='install-help')installHelp();if(e.target.id==='install-now'&&installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('modal').close();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
render();persist();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(reg=>{if(reg.active)return;const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='activated'&&storageOK)$('save-note').innerHTML='✓ Saved on this device · Ready for offline play · <button class="install-link" id="install-note">Add to home screen</button>';});}).catch(()=>{}));}
$('save-note').addEventListener('click',e=>{if(e.target.closest('#install-note'))installHelp();});
if(storageOK)$('save-note').innerHTML='✓ Saved on this device · <button class="install-link" id="install-note">Add to home screen</button>';

