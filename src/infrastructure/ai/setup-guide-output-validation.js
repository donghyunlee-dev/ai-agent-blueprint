const supportedExecutables = new Set([
  'npm','npx','pnpm','yarn','bun','node','docker','kubectl','git','pip','pip3','python','python3','uv','poetry',
  'curl','wget','ssh','scp','rsync','tar','make','bash','sh','apt','apt-get','brew','go','cargo','composer','ruby','gem',
]);
const shellBuiltins = new Set(['cd','export','echo','printf','pwd','mkdir','cp','mv','rm','cat','chmod','chown','source','set','unset','test','which','command','env','touch','ln','ls','grep','sed','awk','head','tail','true','false']);
const shellLanguages = new Set(['sh','bash','shell','zsh','console','terminal']);

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
  return strict && /[-/.]/.test(executable);
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
    const language = block[1].toLowerCase();
    fencedRanges.push([block.index, block.index + block[0].length]);
    if (language && !shellLanguages.has(language)) continue;
    for (const line of block[2].split(/\r?\n/)) add(line.replace(/\s+#.*$/,''), {split:true,strict:true});
  }

  const outsideChars = markdown.split('');
  for (const [start,end] of fencedRanges) for (let index=start;index<end;index+=1) outsideChars[index]=' ';
  const outsideFences = outsideChars.join('');
  for (const match of outsideFences.matchAll(/`([^`\n]+)`/g)) add(match[1], {strict:true});

  const proseCue = /\b(?:run|execute|use|install|start|build|launch|command(?:\s+(?:is|as|below))?)\s*[:：]?\s+([^\n]+)|(?:실행(?:하세요|합니다|해)?|설치(?:하세요|합니다|해)?|명령(?:어)?(?:은|으로)?\s*[:：]?)\s*([^\n]+)/giu;
  for (const match of outsideFences.matchAll(proseCue)) add(match[1] ?? match[2], {split:false,strict:true});

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
    const executable = executableOf(command);
    if (!supportedExecutables.has(executable)) {
      errors.push({command,reason:'unrecognized'});
      continue;
    }
    const normalizedCommand = command.toLowerCase().replace(/\s+/g,' ').trim();
    if (!evidence.includes(normalizedCommand)) errors.push({command,reason:'unsupported'});
  }
  return errors;
}
