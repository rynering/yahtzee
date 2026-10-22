export const categories = [
  {id:'ones',name:'Ones',hint:'Add all ones',face:1},
  {id:'twos',name:'Twos',hint:'Add all twos',face:2},
  {id:'threes',name:'Threes',hint:'Add all threes',face:3},
  {id:'fours',name:'Fours',hint:'Add all fours',face:4},
  {id:'fives',name:'Fives',hint:'Add all fives',face:5},
  {id:'sixes',name:'Sixes',hint:'Add all sixes',face:6},
  {id:'three',name:'Three of a kind',hint:'Add all dice'},
  {id:'four',name:'Four of a kind',hint:'Add all dice'},
  {id:'full',name:'Full house',hint:'Three + two · 25 points'},
  {id:'small',name:'Small straight',hint:'Four in a row · 30 points'},
  {id:'large',name:'Large straight',hint:'Five in a row · 40 points'},
  {id:'yahtzee',name:'Yahtzee',hint:'Five of a kind · 50 points'},
  {id:'chance',name:'Chance',hint:'Add all dice'}
];
export function freshGame(){return {dice:[3,5,2,6,4],held:[false,false,false,false,false],rolls:0,scores:Object.fromEntries(categories.map(c=>[c.id,null])),extra:0};}
export const isYahtzee=d=>d.every(x=>x===d[0]);
export function available(game){
  const free=categories.filter(c=>game.scores[c.id]===null).map(c=>c.id);
  if(!isYahtzee(game.dice)||game.scores.yahtzee===null)return free;
  const upper=categories[game.dice[0]-1].id;
  if(free.includes(upper))return [upper];
  const lower=free.filter(id=>categories.findIndex(c=>c.id===id)>5);
  return lower.length?lower:free;
}
export function scoreFor(id,game){
  const d=game.dice,counts=Array(7).fill(0);d.forEach(v=>counts[v]++);
  const sum=d.reduce((a,b)=>a+b,0),max=Math.max(...counts),index=categories.findIndex(c=>c.id===id);
  if(index<6)return counts[index+1]*(index+1);
  const joker=isYahtzee(d)&&game.scores.yahtzee!==null&&game.scores[categories[d[0]-1].id]!==null;
  const unique=new Set(d),run=n=>[1,2,3].some(start=>Array.from({length:n},(_,i)=>start+i).every(v=>unique.has(v)));
  return ({three:max>=3?sum:0,four:max>=4?sum:0,full:joker||(counts.includes(3)&&counts.includes(2))?25:0,small:joker||run(4)?30:0,large:joker||run(5)?40:0,yahtzee:max===5?50:0,chance:sum})[id];
}
export function totals(game){const upper=categories.slice(0,6).reduce((s,c)=>s+(game.scores[c.id]||0),0);const lower=categories.slice(6).reduce((s,c)=>s+(game.scores[c.id]||0),0);return {upper,bonus:upper>=63?35:0,lower,total:upper+lower+(upper>=63?35:0)+game.extra};}
export function commit(game,id){
  if(!game.rolls||!available(game).includes(id))throw new Error('Choose an available category after rolling.');
  const points=scoreFor(id,game),extra=isYahtzee(game.dice)&&game.scores.yahtzee===50?100:0;
  const next={...game,scores:{...game.scores,[id]:points},extra:game.extra+extra,held:Array(5).fill(false),rolls:0};
  return {game:next,points,extra,finished:categories.every(c=>next.scores[c.id]!==null)};
}
