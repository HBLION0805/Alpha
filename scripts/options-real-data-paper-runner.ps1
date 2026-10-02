param([switch]$DryRun)
$ErrorActionPreference='Stop'
$repo='C:\projects\Alpha-event-intelligence-v1'
$alpha='C:\projects\Alpha'
$tsx=Join-Path $repo 'node_modules\tsx\dist\cli.mjs'
$bridge=Join-Path $repo 'scripts\options-real-data-paper-bridge.mjs'
$mcp=Join-Path $repo 'scripts\options-real-data-paper-mcp.mjs'
$guidance=Join-Path $repo 'scripts\options-daily-guidance.mjs'
$base=Join-Path $alpha 'data\runtime\options-real-data-experiments\runs'
New-Item -ItemType Directory -Force -Path $base | Out-Null
$started=Get-Date
$date=$started.ToString('yyyy-MM-dd')
$receiptPath=Join-Path $base ($date+'-run.json')
$result=[ordered]@{version='ALPHA_REAL_DATA_PAPER_RUN_V1';date=$date;startedAt=$started.ToString('o');status='STARTED';phase='PRECHECK';engineeringAcceptance='PENDING';strategyValidationEligible=$false;liveOrderAuthority=$false;executionAllowed=$false;captures=@()}
function Save-Result {$result.updatedAt=(Get-Date).ToString('o');$result|ConvertTo-Json -Depth 16|Set-Content -LiteralPath $receiptPath -Encoding UTF8}
function Stop-Run([string]$status,[string]$phase,[string]$reason,[int]$code=2){$result.status=$status;$result.phase=$phase;$result.reason=$reason;if($status -in @('SYSTEM_FAILURE','BLOCKED_DATA_INTEGRITY','INCOMPLETE_EXPERIMENT')){$result.engineeringAcceptance='FAILED'};Save-Result;exit $code}
Save-Result
foreach($p in @($repo,$alpha,$tsx,$bridge,$mcp,$guidance)){if(-not(Test-Path -LiteralPath $p)){Stop-Run 'SYSTEM_FAILURE' 'PRECHECK' 'DEPENDENCY_MISSING'}}
$cx=(Get-ChildItem 'C:\Users\liuha\AppData\Local\OpenAI\Codex\bin' -Recurse -Filter codex.exe -File -ErrorAction SilentlyContinue|Sort-Object LastWriteTime -Descending|Select-Object -First 1).FullName
if(-not $cx -or -not(Test-Path -LiteralPath $cx)){Stop-Run 'SYSTEM_FAILURE' 'PRECHECK' 'CODEX_EXECUTABLE_MISSING'}
$result.codexPath=$cx
if($DryRun){
  $result.status='DRY_RUN_PASS';$result.phase='DRY_RUN';$result.dependenciesChecked=$true
  $result.note='No market, account, position, or order call was made.'
  Save-Result;exit 0
}
if($date -ne '2026-10-08'){Stop-Run 'SYSTEM_FAILURE' 'DATE_GUARD' 'WRONG_EXPERIMENT_DATE'}
$sourceRun=Join-Path $alpha ('data\runtime\options-workbench-development\local-1550\runs\'+$date+'-1550-run.json')
$deadline=$started.Date.AddHours(15).AddMinutes(52).AddSeconds(45)
$result.phase='WAIT_1550_CAPTURE';Save-Result
while((Get-Date) -lt $deadline){
  if(Test-Path -LiteralPath $sourceRun){
    try{$source=Get-Content -LiteralPath $sourceRun -Raw|ConvertFrom-Json}catch{$source=$null}
    if($source -and @('PASS','BLOCKED','FAILED','MISSED','SKIPPED','FINISHED_NOT_PASS') -contains $source.status){break}
  }
  Start-Sleep -Milliseconds 500
}
if(-not $source){Stop-Run 'SYSTEM_FAILURE' 'WAIT_1550_CAPTURE' '1550_RECEIPT_UNAVAILABLE'}
$result.source1550=[ordered]@{path=$sourceRun;status=$source.status;updatedAt=$source.updatedAt;captureLocal=$source.captureLocal}
if($source.status -ne 'PASS'){Stop-Run 'SYSTEM_FAILURE' 'WAIT_1550_CAPTURE' ('1550_'+$source.status)}
Set-Location $repo
$result.phase='ARM';Save-Result
$armRaw=& 'C:\Program Files\nodejs\node.exe' $tsx $bridge --arm --workspace $alpha
try{$arm=$armRaw|ConvertFrom-Json}catch{Stop-Run 'SYSTEM_FAILURE' 'ARM' 'ARM_OUTPUT_INVALID'}
$result.arm=$arm
if($arm.status -eq 'NO_TRADE_VALID'){$result.status='NO_TRADE_VALID';$result.phase='COMPLETED';$result.engineeringAcceptance='NON_TRADE_PATH_PASSED_ONLY';Save-Result;exit 0}
if($arm.status -eq 'BLOCKED_DATA_INTEGRITY'){Stop-Run 'BLOCKED_DATA_INTEGRITY' 'ARM' (($arm.blockers -join ',')) 2}
if($arm.status -eq 'SYSTEM_FAILURE'){Stop-Run 'SYSTEM_FAILURE' 'ARM' $arm.errorCode}
if($arm.status -ne 'PAPER_ARMED'){Stop-Run 'SYSTEM_FAILURE' 'ARM' 'UNEXPECTED_ARM_STATUS'}
$decisionAt=[datetimeoffset]::Parse($arm.request.decisionAt).ToLocalTime().DateTime
$timeExit=[datetimeoffset]::Parse($arm.request.timeExitAt).ToLocalTime().DateTime
$targets=@($decisionAt.AddSeconds(15),$decisionAt.AddSeconds(75),$decisionAt.AddSeconds(180),$timeExit.AddSeconds(20))
$result.targets=@($targets|ForEach-Object{$_.ToString('o')})
$result.phase='OBSERVING';Save-Result
function Invoke-ExactCapture([datetime]$target,[int]$index){
  while((Get-Date) -lt $target){Start-Sleep -Milliseconds 200}
  $log=Join-Path $base ($date+'-capture-'+('{0:D2}' -f $index)+'.jsonl')
  $prompt=@"
ALPHA REAL-DATA ENGINEERING PAPER CAPTURE. NO REPO EXPLORATION. NO WEB. NO CODE EDITS.
This is paper simulation only. Never access account, balance, portfolio, positions, orders, executions, transactions, or any write/trading tool.
1. Call alpha_paper_host prepare_capture exactly once. Require status=READY.
2. Evaluate its returned source function exactly ONCE with clock async()=>new Date().toISOString().
3. Its call(tool,args) may invoke ONLY robinhood_alpha_market_data: get_option_chains, get_option_instruments, get_equity_quotes, get_option_quotes. Do not call any other Robinhood tool.
4. Do not alter the contract, symbols, expiry, strike or returned collector source.
5. Immediately call alpha_paper_host accept_capture exactly once with the complete collector result.
6. Return one compact line containing accept status, outcomeLabel, engineeringAcceptance, paperStatus/paperStage if present, and executionAllowed. No retry.
"@
  $args=@('exec','-m','gpt-6-sol','-c','model_reasoning_effort="low"',
    '-c',"mcp_servers.alpha_paper_host.command='C:/Program Files/nodejs/node.exe'",
    '-c',"mcp_servers.alpha_paper_host.args=['C:/projects/Alpha-event-intelligence-v1/node_modules/tsx/dist/cli.mjs','C:/projects/Alpha-event-intelligence-v1/scripts/options-real-data-paper-mcp.mjs']",
    '-c',"mcp_servers.alpha_paper_host.env.ALPHA_PRIVATE_ROOT='C:/projects/Alpha'",
    '-c','mcp_servers.alpha_paper_host.startup_timeout_sec=15','-c','mcp_servers.alpha_paper_host.tool_timeout_sec=40',
    '--approve-for-me','-C',$repo,'--add-dir',$alpha,'--json','-')
  $ErrorActionPreference='Continue';$prompt|& $cx @args 2>&1|Out-File -LiteralPath $log -Encoding utf8;$exit=$LASTEXITCODE;$ErrorActionPreference='Stop'
  $accept=$null
  foreach($line in Get-Content -LiteralPath $log -ErrorAction SilentlyContinue){
    try{$j=$line|ConvertFrom-Json}catch{continue}
    if($j.type -eq 'item.completed' -and $j.item.type -eq 'mcp_tool_call' -and $j.item.server -eq 'alpha_paper_host' -and $j.item.tool -eq 'accept_capture'){$accept=$j.item.result.structured_content}
  }
  $row=[ordered]@{index=$index;targetAt=$target.ToString('o');finishedAt=(Get-Date).ToString('o');codexExit=$exit;log=$log;accept=$accept}
  $result.captures+=@($row);Save-Result
  if($exit -ne 0 -or -not $accept){Stop-Run 'SYSTEM_FAILURE' 'OBSERVING' ('CAPTURE_'+$index+'_NO_ACCEPT_RESULT')}
  if($accept.outcomeLabel -eq 'SYSTEM_FAILURE'){Stop-Run 'SYSTEM_FAILURE' 'OBSERVING' $accept.errorCode}
  if($accept.outcomeLabel -eq 'BLOCKED_DATA_INTEGRITY'){Stop-Run 'BLOCKED_DATA_INTEGRITY' 'OBSERVING' (($accept.failureCodes -join ',')) 2}
  return $accept
}
$last=$null
for($i=0;$i -lt $targets.Count;$i++){
  $last=Invoke-ExactCapture $targets[$i] ($i+1)
  if($last.paperStatus -eq 'CLOSED_MODELED'){break}
}
$result.phase='FINALIZE';Save-Result
$finalRaw=& 'C:\Program Files\nodejs\node.exe' $tsx $guidance --observe-paper --workspace $alpha
try{$final=$finalRaw|ConvertFrom-Json}catch{Stop-Run 'SYSTEM_FAILURE' 'FINALIZE' 'FINALIZE_OUTPUT_INVALID'}
$result.finalize=$final
$finalRow=@($final.results|Where-Object{$_.planId -eq $arm.planId}|Select-Object -Last 1)
if($finalRow.Count -gt 0){
  $f=$finalRow[0]
  if($f.error){Stop-Run 'SYSTEM_FAILURE' 'FINALIZE' $f.error}
  if($f.status -eq 'CLOSED_MODELED'){$result.status='PAPER_FILLED';$result.engineeringAcceptance='POSITION_AND_EXIT_PATH_COMPLETED'}
  elseif($f.status -eq 'OPEN_UNRESOLVED'){$result.status='PAPER_FILLED';$result.engineeringAcceptance='POSITION_LIFECYCLE_OPEN'}
  elseif($f.status -eq 'NO_ENTRY' -and $f.paperStage -eq 'ENTRY_WINDOW_ENDED'){$result.status='NO_TRADE_VALID';$result.engineeringAcceptance='NON_TRADE_PATH_PASSED_ONLY'}
  else{$result.status='INCOMPLETE_EXPERIMENT';$result.engineeringAcceptance='FAILED_OR_INCOMPLETE'}
}else{
  if($last.paperStatus -eq 'CLOSED_MODELED'){$result.status='PAPER_FILLED';$result.engineeringAcceptance='POSITION_AND_EXIT_PATH_COMPLETED'}
  elseif($last.paperStatus -eq 'OPEN_UNRESOLVED'){$result.status='PAPER_FILLED';$result.engineeringAcceptance='POSITION_LIFECYCLE_OPEN'}
  elseif($last.outcomeLabel -eq 'NO_TRADE_VALID'){$result.status='NO_TRADE_VALID';$result.engineeringAcceptance='NON_TRADE_PATH_PASSED_ONLY'}
  else{$result.status='INCOMPLETE_EXPERIMENT';$result.engineeringAcceptance='FAILED_OR_INCOMPLETE'}
}
$result.phase='COMPLETED';$result.finishedAt=(Get-Date).ToString('o');Save-Result
if($result.status -in @('PAPER_FILLED','NO_TRADE_VALID')){exit 0}else{exit 2}
