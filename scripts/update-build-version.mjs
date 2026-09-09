import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.resolve(__dirname, '../package.json')
const versionJsonPath = path.resolve(__dirname, '../src/assets/version.json')

function getTodayParts () {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

function parseBuildVersion (version) {
  const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)-build\.(\d+)$/)
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), build: Number(match[4]) }
    : null
}

async function main () {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  const today = getTodayParts()
  const current = parseBuildVersion(packageJson.version)
  const sameDay = current && current.year === today.year && current.month === today.month && current.day === today.day
  const nextVersion = `${today.year}.${today.month}.${today.day}-build.${sameDay ? current.build + 1 : 1}`

  packageJson.version = nextVersion
  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  await fs.writeFile(versionJsonPath, `${JSON.stringify({ version: nextVersion }, null, 2)}\n`, 'utf8')
  console.log(`Updated Network build version to ${nextVersion}`)
}

main().catch(error => {
  console.error('Failed to update Network build version.')
  console.error(error)
  process.exit(1)
})
