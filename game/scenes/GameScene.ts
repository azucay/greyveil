import * as Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.scene.launch('UIScene')
  }

  update(_time: number, _delta: number): void {
    // Map, camera and game logic added in T002+
  }
}
