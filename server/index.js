const { WebSocketServer } = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3001
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const STATS_FILE = path.join(__dirname, 'stats.json')

const rooms = new Map() // code → Room

function loadStats() {
  try { return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) } catch { return { totalPlayers: 0 } }
}
function saveStats(s) {
  fs.writeFile(STATS_FILE, JSON.stringify(s), () => {})
}

const stats = loadStats()

function genCode() {
  let code
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  } while (rooms.has(code))
  return code
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg))
}

function broadcast(room, msg, excludeWs = null) {
  for (const p of room.players) {
    if (p.ws !== excludeWs) send(p.ws, msg)
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' }

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ totalPlayers: stats.totalPlayers, currentConnections: wss.clients.size }))
    return
  }
  if (req.method === 'GET' && req.url === '/ping') {
    stats.totalPlayers++
    saveStats(stats)
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' })
  res.end('Friends Slay the Dragon WS Server')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  let room = null
  let playerId = -1

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'createRoom': {
        const code = genCode()
        room = { code, players: [{ ws, id: 0, charConfirmed: false, charIdx: 0 }], started: false }
        rooms.set(code, room)
        playerId = 0
        stats.totalPlayers++
        saveStats(stats)
        send(ws, { type: 'roomCreated', code, playerId: 0 })
        break
      }

      case 'joinRoom': {
        const code = (msg.code ?? '').toString().toUpperCase().trim()
        const target = rooms.get(code)
        if (!target) { send(ws, { type: 'error', text: 'Room not found' }); break }
        if (target.started) { send(ws, { type: 'error', text: 'Game already started' }); break }
        if (target.players.length >= 4) { send(ws, { type: 'error', text: 'Room is full (max 4)' }); break }

        playerId = target.players.length
        target.players.push({ ws, id: playerId, charConfirmed: false, charIdx: 0 })
        room = target
        stats.totalPlayers++
        saveStats(stats)

        const ids = room.players.map(p => p.id)
        send(ws, { type: 'roomJoined', code, playerId, players: ids })
        broadcast(room, { type: 'playerJoined', playerId }, ws)
        break
      }

      case 'startGame': {
        if (!room || playerId !== 0) break // host only
        if (room.started) break
        room.started = true
        // Reset char confirmations for the new session
        for (const p of room.players) { p.charConfirmed = false; p.charIdx = 0 }
        const playerCount = room.players.length
        broadcast(room, { type: 'gameStart', playerCount }, ws)
        send(ws, { type: 'gameStart', playerCount })
        break
      }

      case 'charConfirm': {
        if (!room) break
        const cp = room.players.find(p => p.id === playerId)
        if (cp) { cp.charConfirmed = true; cp.charIdx = msg.charIdx ?? 0 }
        broadcast(room, { type: 'remoteCharConfirm', playerId, charIdx: msg.charIdx ?? 0 }, ws)
        if (room.players.every(p => p.charConfirmed)) {
          const charIdxs = room.players.map(p => p.charIdx ?? 0)
          const allMsg = { type: 'allCharsConfirmed', charIdxs }
          for (const p of room.players) send(p.ws, allMsg)
        }
        break
      }

      case 'input': {
        if (!room || !room.started) break
        broadcast(room, {
          type: 'remoteInput',
          playerId,
          left:    !!msg.left,
          right:   !!msg.right,
          jump:    !!msg.jump,
          shield:  !!msg.shield,
          ability: !!msg.ability,
        }, ws)
        break
      }
    }
  })

  ws.on('close', () => {
    if (!room) return
    room.players = room.players.filter(p => p.ws !== ws)
    broadcast(room, { type: 'playerLeft', playerId })
    if (room.players.length === 0) rooms.delete(room.code)
  })

  ws.on('error', () => {})
})

server.listen(PORT, () => {
  console.log(`Friends Slay the Dragon server listening on port ${PORT}`)
  console.log(`Players connect via ws://localhost:${PORT}`)
})
