const fs = require("fs").promises
const path = require("path")
const archiver = require("archiver")
const axios = require("axios")

async function createZipBackup() {
  const backupDir = path.join(__dirname, "../backup")
  await fs.mkdir(backupDir, { recursive: true })

  const zipFileName = `backup-${Date.now()}.zip`
  const zipFilePath = path.join(backupDir, zipFileName)

  const output = require("fs").createWriteStream(zipFilePath)
  const archive = archiver("zip", { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    output.on("close", () => resolve({ zipFilePath, zipFileName }))
    archive.on("error", reject)

    archive.pipe(output)
    archive.directory(path.join(__dirname, "../database"), false)
    archive.finalize()
  })
}

async function pushBackupToGitHub(zipFilePath, zipFileName) {
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH || "main"
  const token = process.env.GITHUB_TOKEN
  const githubApi = `https://api.github.com/repos/${repo}/contents/backup/${zipFileName}`

  const content = await fs.readFile(zipFilePath, { encoding: "base64" })

  let sha = null
  try {
    const existing = await axios.get(githubApi, {
      headers: { Authorization: `Bearer ${token}` }
    })
    sha = existing.data.sha
  } catch (err) {
    // Not found is okay
  }

  const response = await axios.put(
    githubApi,
    {
      message: `Backup: ${zipFileName}`,
      content,
      branch,
      ...(sha && { sha }),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  )

  return response.data.content.path
}

module.exports = {
  createZipBackup,
  pushBackupToGitHub,
}
