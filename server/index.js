const http = require('http')
const express = require('express')
const fs = require('fs/promises')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const cors = require('cors')
const chokidar = require('chokidar');
const AWS = require('aws-sdk')

const pty = require('node-pty')

const LOCAL_USER_DIR = path.join(__dirname, 'user')
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'local').toLowerCase()
const USE_S3 = STORAGE_PROVIDER === 's3'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET
const AWS_S3_PREFIX = (process.env.AWS_S3_PREFIX || 'cloud-ide').replace(/^\/+|\/+$/g, '')

const s3Client = USE_S3 ? new AWS.S3({ region: AWS_REGION }) : null

const ptyProcess = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: LOCAL_USER_DIR,
    env: process.env
});

const app = express()
const server = http.createServer(app);
const io = new SocketServer({
    cors: '*'
})

app.use(cors())

io.attach(server);

if (!USE_S3) {
    chokidar.watch(LOCAL_USER_DIR).on('all', (event, filePath) => {
        io.emit('file:refresh', filePath)
    });
}

ptyProcess.onData(data => {
    io.emit('terminal:data', data)
})

io.on('connection', (socket) => {
    console.log(`Socket connected`, socket.id)

    socket.emit('file:refresh')

    socket.on('file:change', async ({ path: filePath, content }) => {
        try {
            await writeFileContent(filePath, content)
            io.emit('file:refresh', filePath)
        } catch (error) {
            console.error('Failed to save file', error)
        }
    })

    socket.on('terminal:write', (data) => {
        console.log('Term', data)
        ptyProcess.write(data);
    })
})

app.get('/files', async (req, res) => {
    try {
        const fileTree = await generateFileTree();
        return res.json({ tree: fileTree })
    } catch (error) {
        console.error('Failed to get file tree', error)
        return res.status(500).json({ error: 'Failed to get file tree' })
    }
})

app.get('/files/content', async (req, res) => {
    const filePath = req.query.path;

    if (!filePath) {
        return res.status(400).json({ error: 'path query param is required' })
    }

    try {
        const content = await getFileContent(filePath)
        return res.json({ content })
    } catch (error) {
        console.error('Failed to read file content', error)
        return res.status(500).json({ error: 'Failed to read file content' })
    }
})

app.get('/storage-mode', async (req, res) => {
    return res.json({
        mode: USE_S3 ? 's3' : 'local',
        bucket: USE_S3 ? AWS_S3_BUCKET : null,
        prefix: USE_S3 ? AWS_S3_PREFIX : null,
    })
})

server.listen(9000, () => console.log(`🐳 Docker server running on port 9000`))


function toS3Key(filePath) {
    const normalizedPath = normalizeFilePath(filePath)
    return AWS_S3_PREFIX ? `${AWS_S3_PREFIX}/${normalizedPath}` : normalizedPath
}

function normalizeFilePath(filePath = '') {
    return String(filePath).replace(/^\/+/, '')
}

function fromS3Key(key) {
    if (!AWS_S3_PREFIX) return key

    const prefixWithSlash = `${AWS_S3_PREFIX}/`
    if (key.startsWith(prefixWithSlash)) {
        return key.slice(prefixWithSlash.length)
    }

    return key
}

function buildTreeFromPaths(paths) {
    const tree = {}

    for (const fullPath of paths) {
        if (!fullPath || fullPath.endsWith('/')) continue

        const parts = fullPath.split('/').filter(Boolean)
        let current = tree

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isFile = i === parts.length - 1

            if (isFile) {
                current[part] = null
            } else {
                current[part] = current[part] || {}
                current = current[part]
            }
        }
    }

    return tree
}

function mergeTrees(baseTree, incomingTree) {
    const result = { ...baseTree }

    for (const key of Object.keys(incomingTree)) {
        const baseNode = result[key]
        const incomingNode = incomingTree[key]

        if (baseNode && incomingNode && typeof baseNode === 'object' && typeof incomingNode === 'object') {
            result[key] = mergeTrees(baseNode, incomingNode)
        } else {
            result[key] = incomingNode
        }
    }

    return result
}

async function generateLocalFileTree() {
    const tree = {}

    async function buildTreeLocal(currentDir, currentTree) {
        const files = await fs.readdir(currentDir)

        for (const file of files) {
            const filePath = path.join(currentDir, file)
            const stat = await fs.stat(filePath)

            if (stat.isDirectory()) {
                currentTree[file] = {}
                await buildTreeLocal(filePath, currentTree[file])
            } else {
                currentTree[file] = null
            }
        }
    }

    await buildTreeLocal(LOCAL_USER_DIR, tree);
    return tree
}

async function generateFileTree() {
    if (USE_S3) {
        if (!AWS_S3_BUCKET) {
            throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3')
        }

        const allPaths = []
        let continuationToken = undefined

        do {
            const response = await s3Client.listObjectsV2({
                Bucket: AWS_S3_BUCKET,
                Prefix: AWS_S3_PREFIX ? `${AWS_S3_PREFIX}/` : undefined,
                ContinuationToken: continuationToken,
            }).promise()

            const keys = (response.Contents || []).map((item) => fromS3Key(item.Key || '')).filter(Boolean)
            allPaths.push(...keys)
            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
        } while (continuationToken)

        const s3Tree = buildTreeFromPaths(allPaths)

        try {
            const localTree = await generateLocalFileTree()
            return mergeTrees(localTree, s3Tree)
        } catch {
            return s3Tree
        }
    }

    return generateLocalFileTree()
}

async function getFileContent(filePath) {
    if (USE_S3) {
        if (!AWS_S3_BUCKET) {
            throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3')
        }

        try {
            const response = await s3Client.getObject({
                Bucket: AWS_S3_BUCKET,
                Key: toS3Key(filePath),
            }).promise()

            return response.Body.toString('utf-8')
        } catch (error) {
            if (error.code !== 'NoSuchKey') {
                throw error
            }
        }
    }

    const normalizedPath = normalizeFilePath(filePath)
    return fs.readFile(path.join(LOCAL_USER_DIR, normalizedPath), 'utf-8')
}

async function writeFileContent(filePath, content) {
    if (USE_S3) {
        if (!AWS_S3_BUCKET) {
            throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3')
        }

        await s3Client.putObject({
            Bucket: AWS_S3_BUCKET,
            Key: toS3Key(filePath),
            Body: content,
            ContentType: 'text/plain; charset=utf-8',
        }).promise()
    }

    const normalizedPath = normalizeFilePath(filePath)
    const targetPath = path.join(LOCAL_USER_DIR, normalizedPath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content)
}