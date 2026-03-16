const express = require('express')
const path = require('path')

const PORT = 8000

const app = express()

app.use(express.static(__dirname))

app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', service: 'react-preview' })
})

app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'))
})

app.listen(PORT, () => console.log(`User preview server started on port ${PORT}`))


















                                    
