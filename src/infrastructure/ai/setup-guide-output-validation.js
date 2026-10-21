const supportedExecutables = new Set([
  'npm','npx','pnpm','yarn','bun','node','docker','kubectl','git','pip','pip3','python','python3','uv','poetry',
  'curl','wget','ssh','scp','rsync','tar','make','bash','sh','apt','apt-get','brew','go','cargo','composer','ruby','gem','terraform','systemctl','sudo','irm','iwr','invoke-webrequest','invoke-restmethod','install-module','set-executionpolicy','start-process','get-command',
]);
const shellBuiltins = new Set(['cd','export','echo','printf','pwd','mkdir','cp','mv','rm','cat','chmod','chown','source','set','unset','test','which','command','env','touch','ln','ls','grep','sed','awk','head','tail','true','false']);
const actionVerbs = new Set(['add','apply','build','check','clean','configure','create','delete','deploy','destroy','disable','down','enable','exec','get','install','init','list','login','logout','plan','pull','push','restart','run','set','start','status','stop','test','update','upgrade','up','version']);
const proseDeterminers = new Set(['a','an','the','this','that','these','those','my','your','our','their','its']);
const proseConnectors = new Set(['as','for','with','to','by','from','after','before','because','while','when','which','who','where','whether','and','or','but']);

function splitShellCommands(value) {
  return value.split(/&&|\|\||[;|]/).map((item) => item.trim()).filter(Boolean);
}

function cleanCommand(value) {
  return value.trim()
    .replace(/^(?:\$|>)\s*/,'')
    .replace(/^(?:[A-Z_][A-Z0-9_]*=(?:[^ ]*|"[^"]*"|'[^']*')\s+)+/i,'')
    .replace(/^[`“”'"([{]+/,'')
    .replace(/[.,!?。；;:：)\]}”’'"`]+$/,'')
    .replace(/\s+/g,' ');
}

function executableOf(command) {
  const token = command.match(/^([^\s]+)/)?.[1];
  return token?.split('/').pop()?.toLowerCase();
}

function looksLikeExecutable(command, strict = false) {
  const executable = executableOf(command);
  if (!executable || shellBuiltins.has(executable)) return false;
  if (supportedExecutables.has(executable)) return true;
  const action = command.trim().split(/\s+/,2)[1]?.replace(/^["']|["']$/g,'').toLowerCase();
  const hasArguments = command.trim().split(/\s+/).length > 1;
  return strict && hasArguments && (/[-/.]/.test(executable) || (action && actionVerbs.has(action)) || /^[a-z][a-z0-9_-]*$/i.test(executable));
}

export function extractSetupGuideCommands(markdown) {
  const commands = [];
  const fencedRanges = [];
  const add = (candidate, { split = false, strict = false } = {}) => {
    const parts = split ? splitShellCommands(candidate) : [candidate];
    for (const part of parts) {
      const command = cleanCommand(part);
      if (command && looksLikeExecutable(command, strict)) commands.push(command);
    }
  };

  for (const block of markdown.matchAll(/```([\w-]*)\s*\n([\s\S]*?)```/g)) {
    fencedRanges.push([block.index, block.index + block[0].length]);
    for (const line of block[2].split(/\r?\n/)) add(line.replace(/\s+#.*$/,''), {split:true,strict:true});
  }

  const outsideChars = markdown.split('');
  for (const [start,end] of fencedRanges) for (let index=start;index<end;index+=1) outsideChars[index]=' ';
  const outsideFences = outsideChars.join('');
  for (const match of outsideFences.matchAll(/`([^`\n]+)`/g)) add(match[1], {strict:true});

  const proseCue = /\b(?:run|execute|use|install|start|build|launch|command(?:\s+(?:is|as|below))?)\s*[:：]?\s+([^\n]+)|(?:실행(?:하세요|합니다|해)?|설치(?:하세요|합니다|해)?|명령(?:어)?(?:은|으로)?\s*[:：]?)\s*([^\n]+)/giu;
  for (const match of outsideFences.matchAll(proseCue)) {
    const candidate = match[1] ?? match[2];
    const words = cleanCommand(candidate).split(/\s+/);
    const firstWord = words[0]?.toLowerCase();
    const secondWord = words[1]?.replace(/^['"]|['"]$/g,'').toLowerCase();
    if (!proseDeterminers.has(firstWord) && !proseConnectors.has(secondWord)) add(candidate, {split:false,strict:true});
  }

  for (const line of outsideFences.split(/\r?\n/)) {
    const command = cleanCommand(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/,''));
    if (command.includes(' ') && looksLikeExecutable(command)) commands.push(command);
  }

  const seen = new Set();
  return commands.filter((command) => {
    const key = command.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateSetupGuideCommandEvidence(markdown, evidenceValues) {
  const evidence = evidenceValues.join('\n').toLowerCase().replace(/\s+/g,' ').trim();
  const errors = [];
  for (const command of extractSetupGuideCommands(markdown)) {
    const executables = command.trim().split(/\s+/).map((token) => token.replace(/^["']|["']$/g,'').toLowerCase());
    const executable = executables[0];
    const wrappedExecutable = executable === 'sudo' ? executables.find((token,index) => index>0&&!token.startsWith('-')) : executable;
    if (!supportedExecutables.has(executable) || (executable === 'sudo' && !supportedExecutables.has(wrappedExecutable))) {
      errors.push({command,reason:'unrecognized'});
      continue;
    }
    const normalizedCommand = command.toLowerCase().replace(/\s+/g,' ').trim();
    if (!evidence.includes(normalizedCommand)) errors.push({command,reason:'unsupported'});
  }
  return errors;
}
