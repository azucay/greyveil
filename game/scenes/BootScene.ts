import * as Phaser from 'phaser'
import { WAR2_ASSET_FILES } from '@/game/assets/War2Assets'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    for (const asset of WAR2_ASSET_FILES) {
      this.load.image(asset.key, asset.path)
    }
  }

  create(): void {
    this.scene.start('GameScene')
  }
}
