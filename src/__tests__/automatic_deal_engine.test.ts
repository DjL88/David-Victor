import { describe, expect, it } from 'vitest';
import { qualifyAutomaticDeals } from '../commerce/automaticDealEngine';

const p=(plu:string, price:number)=>({id:plu,plu,gtin:[],name:plu,price,categoryIds:[],productTags:[],displayLabels:[],allergens:[],active:true,stockStatus:'IN_STOCK'} as any);
const modifier=(id:string,plu:string,price:number)=>({id,name:id,plu:id+'###',standalonePlu:plu,standalonePriceMinor:price,priceMinor:0,active:true,snoozed:false});
const deal=(id:string,priceMinor:number,plus:string[])=>({id,plu:id,name:id,priceMinor,currency:'GBP',isCombo:true,stockStatus:'IN_STOCK',sections:plus.map((plu,i)=>({id:id+i,name:'s'+i,min:1,max:1,modifiers:[modifier(id+i,plu,plu==='A'?300:plu==='B'?200:100)]}))} as any);

describe('automatic basket deal engine',()=>{
 it('derives a deal from ordinary basket items with no historical allocation',()=>{
  const result=qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1},{plu:'C',quantity:1}],[deal('meal',500,['A','B','C'])],[p('A',300),p('B',200),p('C',100)]);
  expect(result).toHaveLength(1); expect(result[0].discountTotalMinor).toBe(100);
 });
 it('removes qualification automatically when a required item is removed',()=>{
  expect(qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1}],[deal('meal',500,['A','B','C'])],[p('A',300),p('B',200),p('C',100)])).toEqual([]);
 });
 it('chooses the best saving when deals compete for the same physical units',()=>{
  const result=qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1},{plu:'C',quantity:1}],[deal('weak',550,['A','B','C']),deal('best',450,['A','B','C'])],[p('A',300),p('B',200),p('C',100)]);
  expect(result).toHaveLength(1); expect(result[0].bundleId).toBe('best'); expect(result[0].discountTotalMinor).toBe(150);
 });
 it('can allocate two deals when the basket contains two complete sets',()=>{
  const result=qualifyAutomaticDeals([{plu:'A',quantity:2},{plu:'B',quantity:2},{plu:'C',quantity:2}],[deal('meal',500,['A','B','C'])],[p('A',300),p('B',200),p('C',100)]);
  expect(result).toHaveLength(2);
  expect(result.reduce((sum, allocation) => sum + allocation.discountTotalMinor, 0)).toBe(200);
 });
});


 it('keeps the base deal when an optional upsell is removed',()=>{
  const bundle:any=deal('meal',500,['A','B','C']);
  bundle.sections.push({id:'up',name:'Upsell',min:0,max:1,isUpsell:true,modifiers:[{id:'beans',name:'Beans',plu:'D',standalonePlu:'D',standalonePriceMinor:140,priceMinor:95,active:true,snoozed:false}]});
  const products=[p('A',300),p('B',200),p('C',100),p('D',140)];
  const withUpsell=qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1},{plu:'C',quantity:1},{plu:'D',quantity:1}],[bundle],products);
  const withoutUpsell=qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1},{plu:'C',quantity:1}],[bundle],products);
  expect(withUpsell).toHaveLength(1);
  expect(withoutUpsell).toHaveLength(1);
  expect(withUpsell[0].discountTotalMinor).toBeGreaterThan(withoutUpsell[0].discountTotalMinor);
  expect(withUpsell[0].components.some((component)=>component.componentPlu==='D')).toBe(true);
  expect(withoutUpsell[0].components.some((component)=>component.componentPlu==='D')).toBe(false);
 });
 it('never makes an optional upsell dearer than its shelf price',()=>{
  const bundle:any=deal('meal',500,['A','B','C']);
  bundle.sections.push({id:'up',name:'Upsell',min:0,max:1,isUpsell:true,modifiers:[{id:'beans',name:'Beans',plu:'D',standalonePlu:'D',standalonePriceMinor:80,priceMinor:95,active:true,snoozed:false}]});
  const result=qualifyAutomaticDeals([{plu:'A',quantity:1},{plu:'B',quantity:1},{plu:'C',quantity:1},{plu:'D',quantity:1}],[bundle],[p('A',300),p('B',200),p('C',100),p('D',80)]);
  const upsell=result[0].components.find((component)=>component.componentPlu==='D');
  expect(upsell?.protectedUnitPricesMinor).toEqual([80]);
 });
