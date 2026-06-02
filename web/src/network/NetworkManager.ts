export interface RemoteInput {
  left: boolean
  right: boolean
  jump: boolean
  shield: boolean
  ability: boolean
}

export class NetworkManager {
  private ws: WebSocket | null = null
  readonly serverUrl: string

  playerId = -1
  roomCode = ''
  isHost = false
  playerCount = 1
  connectedIds = new Set<number>()

  onRoomCreated?: (code: string) => void
  onRoomJoined?: (code: string, players: number[]) => void
  onPlayerJoined?: (id: number) => void
  onPlayerLeft?: (id: number) => void
  onGameStart?: (playerCount: number) => void
  onRemoteInput?: (id: number, input: RemoteInput) => void
  onRemoteCharConfirm?: (playerId: number, charIdx: number) => void
  onAllCharsConfirmed?: (charIdxs: number[]) => void
  onError?: (text: string) => void

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl)
      this.ws.onopen  = () => resolve()
      this.ws.onerror = () => reject(new Error('Cannot connect to server'))
      this.ws.onmessage = (e) => this.handle(JSON.parse(e.data as string))
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(msg: any) {
    switch (msg.type) {
      case 'roomCreated':
        this.playerId = 0
        this.roomCode = msg.code
        this.isHost = true
        this.connectedIds.add(0)
        this.onRoomCreated?.(msg.code)
        break

      case 'roomJoined':
        this.playerId = msg.playerId
        this.roomCode = msg.code
        this.isHost = false
        this.connectedIds = new Set(msg.players as number[])
        this.onRoomJoined?.(msg.code, msg.players as number[])
        break

      case 'playerJoined':
        this.connectedIds.add(msg.playerId as number)
        this.onPlayerJoined?.(msg.playerId as number)
        break

      case 'playerLeft':
        this.connectedIds.delete(msg.playerId as number)
        this.onPlayerLeft?.(msg.playerId as number)
        break

      case 'gameStart':
        this.playerCount = msg.playerCount as number
        this.onGameStart?.(msg.playerCount as number)
        break

      case 'remoteInput':
        this.onRemoteInput?.(msg.playerId as number, {
          left:    msg.left,
          right:   msg.right,
          jump:    msg.jump,
          shield:  msg.shield,
          ability: msg.ability,
        })
        break

      case 'remoteCharConfirm':
        this.onRemoteCharConfirm?.(msg.playerId as number, msg.charIdx as number)
        break

      case 'allCharsConfirmed':
        this.onAllCharsConfirmed?.(msg.charIdxs as number[])
        break

      case 'error':
        this.onError?.(msg.text as string)
        break
    }
  }

  createRoom() { this.send({ type: 'createRoom' }) }
  joinRoom(code: string) { this.send({ type: 'joinRoom', code }) }
  startGame() { this.send({ type: 'startGame' }) }
  sendCharConfirm(charIdx: number) { this.send({ type: 'charConfirm', charIdx }) }

  sendInput(input: RemoteInput) {
    this.send({ type: 'input', ...input })
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}
