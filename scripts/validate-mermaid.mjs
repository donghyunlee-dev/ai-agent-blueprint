import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = join(repositoryRoot, 'docs')
const cliEntry = join(
  repositoryRoot,
  'node_modules',
  '@mermaid-js',
  'mermaid-cli',
  'src',
  'cli.js',
)

if (!existsSync(cliEntry)) {
  console.error('Mermaid CLI가 없습니다. npm install을 먼저 실행하세요.')
  process.exit(1)
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(target)
    return entry.name.endsWith('.md') ? [target] : []
  })
}

const diagrams = []
const blockPattern = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g

for (const file of markdownFiles(docsRoot)) {
  const markdown = readFileSync(file, 'utf8')
  for (const match of markdown.matchAll(blockPattern)) {
    const line = markdown.slice(0, match.index).split(/\r?\n/).length
    diagrams.push({ file, line, source: match[1].trim() })
  }
}

if (diagrams.length === 0) {
  console.log('검사할 Mermaid 다이어그램이 없습니다.')
  process.exit(0)
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'blueprint-mermaid-'))
const failures = []

try {
  diagrams.forEach((diagram, index) => {
    const input = join(temporaryDirectory, `${index}.mmd`)
    const output = join(temporaryDirectory, `${index}.svg`)
    writeFileSync(input, `${diagram.source}\n`)

    const result = spawnSync(process.execPath, [cliEntry, '--input', input, '--output', output, '--quiet'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })

    if (result.status !== 0) {
      failures.push({
        location: `${relative(repositoryRoot, diagram.file)}:${diagram.line}`,
        message: (
          result.error?.stack
          || result.stderr
          || result.stdout
          || `렌더링 프로세스 종료: status=${result.status}, signal=${result.signal}`
        ).trim(),
      })
    }
  })
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`Mermaid 검증 실패: ${failures.length}/${diagrams.length}`)
  for (const failure of failures) {
    console.error(`\n${failure.location}\n${failure.message}`)
  }
  process.exit(1)
}

console.log(`Mermaid 검증 성공: ${diagrams.length}개`)
