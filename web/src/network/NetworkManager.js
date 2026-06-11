export class NetworkManager {
    ws = null;
    serverUrl;
    playerId = -1;
    roomCode = '';
    isHost = false;
    playerCount = 1;
    connectedIds = new Set();
    onRoomCreated;
    onRoomJoined;
    onPlayerJoined;
    onPlayerLeft;
    onGameStart;
    onRemoteInput;
    onRemoteCharConfirm;
    onAllCharsConfirmed;
    onError;
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.serverUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = () => reject(new Error('Cannot connect to server'));
            this.ws.onmessage = (e) => this.handle(JSON.parse(e.data));
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle(msg) {
        switch (msg.type) {
            case 'roomCreated':
                this.playerId = 0;
                this.roomCode = msg.code;
                this.isHost = true;
                this.connectedIds.add(0);
                this.onRoomCreated?.(msg.code);
                break;
            case 'roomJoined':
                this.playerId = msg.playerId;
                this.roomCode = msg.code;
                this.isHost = false;
                this.connectedIds = new Set(msg.players);
                this.onRoomJoined?.(msg.code, msg.players);
                break;
            case 'playerJoined':
                this.connectedIds.add(msg.playerId);
                this.onPlayerJoined?.(msg.playerId);
                break;
            case 'playerLeft':
                this.connectedIds.delete(msg.playerId);
                this.onPlayerLeft?.(msg.playerId);
                break;
            case 'gameStart':
                this.playerCount = msg.playerCount;
                this.onGameStart?.(msg.playerCount);
                break;
            case 'remoteInput':
                this.onRemoteInput?.(msg.playerId, {
                    left: msg.left,
                    right: msg.right,
                    jump: msg.jump,
                    shield: msg.shield,
                    ability: msg.ability,
                });
                break;
            case 'remoteCharConfirm':
                this.onRemoteCharConfirm?.(msg.playerId, msg.charIdx);
                break;
            case 'allCharsConfirmed':
                this.onAllCharsConfirmed?.(msg.charIdxs);
                break;
            case 'error':
                this.onError?.(msg.text);
                break;
        }
    }
    createRoom() { this.send({ type: 'createRoom' }); }
    joinRoom(code) { this.send({ type: 'joinRoom', code }); }
    startGame() { this.send({ type: 'startGame' }); }
    sendCharConfirm(charIdx) { this.send({ type: 'charConfirm', charIdx }); }
    sendInput(input) {
        this.send({ type: 'input', ...input });
    }
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    disconnect() {
        this.ws?.close();
        this.ws = null;
    }
}
