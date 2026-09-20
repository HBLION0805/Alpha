// Shared form vocabulary only. These are reviewer choices, never news classifiers.
export const STORY_CHANGES=['NOT_CLASSIFIED','NEW_FACT','NEW_POLICY','NEW_ACTOR_ACTION','NEW_FLOW_DATA','NEW_NARRATIVE','RECURRING_STORY','POTENTIAL_MODEL_CONTRADICTION','INSUFFICIENT_EVIDENCE'];
export const STORY_LIMITATIONS=[
  'A reviewed link is reading context, not authentication of the news or proof of causality.',
  'Source coverage and original evidence grades are unchanged. No trade implication.',
  'Current-state knowledge remains disabled; new reports stay in the source layer.'
];
export function storylinePreviewMatches(preview,request){return Boolean(preview&&JSON.stringify(preview.request)===JSON.stringify(request));}
