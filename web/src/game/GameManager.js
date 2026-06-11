import { GameState } from '../types';
export class GameManager {
    state = GameState.Playing;
    getState() { return this.state; }
    isPlaying() { return this.state === GameState.Playing; }
    pause() { this.state = GameState.Paused; }
    resume() { this.state = GameState.Playing; }
}
