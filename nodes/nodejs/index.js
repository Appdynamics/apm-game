const express = require('express')
const app = express()
const process = require('process')

const port = parseInt(process.argv[2])

app.post('/**', (req, res) => res.send(req.url))

app.listen(port, () => console.log(`Listening on port ${port}`))
