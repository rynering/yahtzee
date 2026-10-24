import {categories,totals} from './engine.mjs';

// Describe the award without changing the game or awarding points a second time.
export function celebrationFor(before,result,category){
  const start=totals(before),end=totals(result.game);
  const yahtzee=category==='yahtzee'&&result.points===50;
  const upper=end.bonus-start.bonus,extra=result.extra;
  if(!yahtzee&&!upper&&!extra)return null;
  const steps=[];
  if(result.points>0)steps.push({label:yahtzee?'Yahtzee!':categories.find(c=>c.id===category).name,points:result.points,kind:yahtzee?'yahtzee':'score'});
  if(upper)steps.push({label:'Upper bonus',points:upper,kind:'upper'});
  if(extra)steps.push({label:'Extra Yahtzee!',points:extra,kind:'yahtzee'});
  let running=start.total;
  for(const step of steps){step.from=running;running+=step.points;step.to=running;}
  const award=(yahtzee?50:0)+upper+extra;
  return {title:upper&&extra?'Double bonus!':yahtzee||extra?'Yahtzee!':'Upper bonus unlocked!',award,from:start.total,to:end.total,steps,dice:[...before.dice]};
}
