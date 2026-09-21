import {InMemoryPredictionLogRepository} from '../../src/repositories/InMemoryPredictionLogRepository.ts';
import {InMemoryAlphaJournalRepository} from '../../src/repositories/InMemoryAlphaJournalRepository.ts';
import {InMemoryResearchRepository} from '../../src/repositories/InMemoryResearchRepository.ts';
import {InMemoryStrategyRepository} from '../../src/repositories/InMemoryStrategyRepository.ts';
import {alphaJournalFingerprint,canonicalizeAlphaJournalValue} from '../../src/contracts/AlphaJournalValidation.ts';
import {researchFingerprint} from '../../src/contracts/ResearchValidation.ts';
import {strategyFingerprint} from '../../src/contracts/StrategyVersionValidation.ts';
import {exportPredictions} from '../../src/engines/prediction-log/PredictionExports.ts';
import {exportAlphaJournal} from '../../src/engines/alpha-journal/AlphaJournalExports.ts';
import {exportResearch} from '../../src/engines/research-lab/ResearchExports.ts';
import {exportStrategies} from '../../src/engines/strategy-versioning/StrategyExports.ts';

export const repositoryKinds=['prediction','journal','research','strategy'];
const constructors={prediction:InMemoryPredictionLogRepository,journal:InMemoryAlphaJournalRepository,research:InMemoryResearchRepository,strategy:InMemoryStrategyRepository};
const fingerprints={journal:alphaJournalFingerprint,research:researchFingerprint,strategy:strategyFingerprint};
export const canonicalRepository=canonicalizeAlphaJournalValue;
export function repository(kind,events,scoped=false){
  if(!constructors[kind])throw Error('CASE_EXPORT_REPOSITORY');
  if(kind==='prediction')return new constructors[kind](events);
  // Original envelopes stay in the bundle. Only an isolated in-memory ordering
  // wrapper is regenerated; every business record and history stays unchanged.
  const normalized=events.map((event,index)=>{
    if(event.fingerprint!==fingerprints[kind]({...event,fingerprint:undefined}))throw Error('CASE_EXPORT_BUSINESS_FINGERPRINT');
    if(!scoped)return event;
    const v={...event,sequence:index+1,fingerprint:undefined};return {...v,fingerprint:fingerprints[kind](v)};
  });
  return new constructors[kind](normalized);
}
export function repositoryExport(kind,repo,at){
  if(kind==='prediction')return JSON.parse(exportPredictions(repo.query(),'JSON',at).content);
  const exporter={journal:exportAlphaJournal,research:exportResearch,strategy:exportStrategies}[kind];
  const result=exporter(repo,{exportId:'case-evidence-local',requestedAt:at,format:'JSON',destination:'LOCAL_SNAPSHOT',query:{}},{allowExternalExports:false,requireSensitiveAuthorization:true,sensitiveAuthorizationReferences:[]});
  if(!result.content)throw Error('CASE_EXPORT_REPOSITORY_EXPORT');return JSON.parse(result.content);
}
export function eventEntity(kind,e){
  if(kind==='prediction')return e.prediction?.predictionId??e.history?.predictionId??e.outcome?.predictionId??e.start?.predictionId??e.review?.predictionId;
  if(kind==='journal')return e.entry?.entryId??e.amendment?.entryId??e.review?.entryId??e.history?.entryId;
  if(kind==='research')return e.record?.researchId??e.amendment?.researchId??e.review?.researchId??e.history?.researchId??e.supersession?.priorResearchId;
  return e.definition?.definitionId??e.version?.definitionId??e.history?.versionId??e.validation?.versionId??e.approval?.versionId??e.activation?.versionId??e.suspension?.versionId??e.retirement?.versionId??e.performance?.versionId;
}
