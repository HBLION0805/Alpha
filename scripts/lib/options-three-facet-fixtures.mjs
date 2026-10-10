// Synthetic geometry only. Never use these values as market observations.
import {freezeFibPlan} from '../../src/engines/options-three-facet/OptionsThreeFacet.ts';
export const at=t=>'2026-10-08T'+t+':00.000Z';
export function evidence(kind,id=kind,review='13:05') {return {id,kind,source:'SYNTHETIC_TEST_ONLY',publishedAt:at('09:00'),receivedAt:at('09:01'),reviewedAt:at(review)};}
export function fixture() {
  const bar=(id,start,end,open,high,low,close,volume=100)=>({id,openAt:at(start),closeAt:at(end),receivedAt:at(end),open,high,low,close,volume,closed:true,interpolated:false});
  const higher={symbol:'TEST',exchange:'SYNTHETIC',provider:'OWNER_EXPORT',transport:'SAVED_EXPORT',sourceRef:'synthetic-input',
    timezone:'America/New_York',intervalSeconds:3600,session:'REGULAR',adjustment:'UNADJUSTED',quality:'REVIEWED',
    bars:[bar('a','10:00','11:00',105,115,100,110),bar('b','11:00','12:00',115,120,110,118),bar('c','12:00','13:00',120,135,115,125)]};
  const lower={...structuredClone(higher),intervalSeconds:300,bars:[
    bar('l1','14:00','14:05',107,110,106,108),bar('l2','14:05','14:10',108,111,107,109),
    bar('l3','14:10','14:15',109,113,108,112,200)]};
  const plan={id:'synthetic-original',selectedAt:at('13:05'),direction:'UP',scale:'LINEAR',selectionReason:'Synthetic before-trigger selection',
    retracement:[{barId:'a',field:'low'},{barId:'b',field:'high'}],
    channel:[{barId:'a',field:'low'},{barId:'b',field:'low'},{barId:'c',field:'high'}],
    zones:[['SUPPORT',.618,.786],['RESISTANCE',0,0],['ENTRY',.382,.618],['CANCEL',1,1],['EXIT',0,0]]
      .map(([role,fromRatio,toRatio])=>({role,method:'RETRACEMENT',fromRatio,toRatio})),
    breakoutLevel:110,volumeBaselineBars:2,minimumVolumeRatio:1.5,maximumTriggerAgeSeconds:300};
  const facet=kind=>({direction:'UP',status:'SUPPORTED',validFrom:at('13:00'),validThrough:'2026-10-23T15:00:00.000Z',requiredEvidenceIds:[kind],evidence:[evidence(kind)]});
  const risk=Object.fromEntries(['capital','maximumLoss','liquidity','gap','correlation','exit'].map(k=>[k,{state:'PASS',evidence:[evidence('RISK',k,'14:15')]}]));
  return {version:'THREE_FACET_INPUT_V1',symbol:'TEST',instrumentType:'EQUITY',asOf:at('14:16'),holdingFrom:at('14:17'),holdingThrough:'2026-10-09T14:17:00.000Z',
    fundamental:{...facet('FUNDAMENTAL'),basis:'COMPANY',directionBasis:'HOLDING_WINDOW_PRICE_THESIS',directionRationale:'Synthetic explicit price thesis for the declared holding window; not operating growth.',operatingTrend:'UP',reassessedNewsIds:[]},news:{...facet('NEWS'),assumptionImpact:'NONE',materialChanges:[],trigger:'Synthetic dated event'},
    technical:{facet:facet('TECHNICAL'),higher,lower,frozen:freezeFibPlan(plan,higher)},risk};
}
