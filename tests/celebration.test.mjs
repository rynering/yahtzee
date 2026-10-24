import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,commit,totals} from '../dist/engine.mjs';
import {celebrationFor} from '../dist/celebration.mjs';

const rolled=dice=>({...freshGame(),dice,rolls:1});
function plan(g,id){const snapshot=structuredClone(g),result=commit(g,id),p=celebrationFor(g,result,id);assert.deepEqual(g,snapshot);if(p){assert.equal(p.from,totals(g).total);assert.equal(p.to,totals(result.game).total);assert.equal(p.steps.at(-1).to,p.to);assert.equal(p.steps.reduce((s,x)=>s+x.points,p.from),p.to);}return p;}
test('first scored Yahtzee counts exactly 50 points',()=>{const p=plan(rolled([4,4,4,4,4]),'yahtzee');assert.equal(p.award,50);assert.deepEqual(p.steps.map(s=>s.points),[50]);assert.equal(p.to,50);});
test('ordinary scoring and a scratched Yahtzee do not trigger an award',()=>{assert.equal(plan(rolled([1,2,3,4,5]),'chance'),null);assert.equal(plan(rolled([1,2,3,4,5]),'yahtzee'),null);});
test('upper bonus counts the category, then adds the newly earned 35',()=>{const g=rolled([6,6,6,1,2]);Object.assign(g.scores,{ones:3,twos:6,threes:9,fours:12,fives:15});const p=plan(g,'sixes');assert.deepEqual(p.steps.map(s=>s.points),[18,35]);assert.equal(p.award,35);assert.equal(p.from,45);assert.equal(p.to,98);});
test('an already earned upper bonus is not celebrated or added again',()=>{const g=rolled([1,2,3,4,5]);Object.assign(g.scores,{ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18});assert.equal(plan(g,'chance'),null);});
test('extra Yahtzee counts its category and the 100 bonus',()=>{const g=rolled([5,5,5,5,5]);g.scores.yahtzee=50;const p=plan(g,'fives');assert.equal(p.award,100);assert.deepEqual(p.steps.map(s=>s.points),[25,100]);assert.equal(p.to,175);});
test('upper bonus and extra Yahtzee on one turn are added separately',()=>{const g=rolled([6,6,6,6,6]);Object.assign(g.scores,{ones:3,twos:6,threes:9,fours:12,fives:15,yahtzee:50});const p=plan(g,'sixes');assert.deepEqual(p.steps.map(s=>s.points),[30,35,100]);assert.equal(p.award,135);assert.equal(p.from,95);assert.equal(p.to,260);});
test('five of a kind after a scratched Yahtzee earns no 100-point award',()=>{const g=rolled([5,5,5,5,5]);g.scores.yahtzee=0;assert.equal(plan(g,'fives'),null);});
test('a final-round Yahtzee plan uses the completed game total',()=>{const g=rolled([2,2,2,2,2]);for(const key in g.scores)if(key!=='yahtzee')g.scores[key]=0;const p=plan(g,'yahtzee');assert.equal(p.to,50);assert.equal(p.steps[0].kind,'yahtzee');});
