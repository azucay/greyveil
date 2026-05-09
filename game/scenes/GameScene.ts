import * as Phaser from 'phaser'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA_SPEED } from '@/game/constants'
import { MapSystem } from '@/game/systems/MapSystem'
import { ResourceSystem } from '@/game/systems/ResourceSystem'

export class GameScene extends Phaser.Scene {
  private mapSystem!: MapSystem
  resourceSystem!: ResourceSystem
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }
  private dragStartX = 0
  private dragStartY = 0
  private isDragging = false

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.mapSystem = new MapSystem()
    this.mapSystem.render(this)

    this.resourceSystem = new ResourceSystem()
    this.resourceSystem.placeNodes(this, this.mapSystem.getMap())

    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)

    this.setupKeyboard()
    this.setupDragPanning()

    this.scene.launch('UIScene')
  }

  update(_time: number, delta: number): void {
    this.handleKeyboardCamera(delta)
  }

  private setupKeyboard(): void {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
  }

  private setupDragPanning(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !pointer.isDown) return
      const cam = this.cameras.main
      cam.scrollX -= pointer.x - this.dragStartX
      cam.scrollY -= pointer.y - this.dragStartY
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.input.on('pointerupoutside', () => {
      this.isDragging = false
    })
  }

  private handleKeyboardCamera(delta: number): void {
    const speed = (CAMERA_SPEED * delta) / 1000
    const cam = this.cameras.main

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      cam.scrollX -= speed
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      cam.scrollX += speed
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      cam.scrollY -= speed
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      cam.scrollY += speed
    }
  }
}
