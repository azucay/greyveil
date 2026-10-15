import * as Phaser from 'phaser';
import { hex, PAL } from '@/config';

const FX_DEPTH = 50000;

/** Kleine, billige Effekte: Partikel, Projektile, Pings, Text. */
export class Fx {
  constructor(private scene: Phaser.Scene) {}

  burst(x: number, y: number, color: string, n = 8, spread = 14) {
    for (let i = 0; i < n; i++) {
      const p = this.scene.add.image(x, y, 'px').setTint(hex(color)).setDepth(FX_DEPTH);
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.6);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.6 - 4,
        alpha: 0,
        duration: 350 + Math.random() * 250,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  projectile(x0: number, y0: number, x1: number, y1: number, color: string, onHit: () => void) {
    const p = this.scene.add.image(x0, y0, 'px').setTint(hex(color)).setDepth(FX_DEPTH).setScale(1.5, 1);
    p.rotation = Math.atan2(y1 - y0, x1 - x0);
    const dur = Math.min(450, Math.hypot(x1 - x0, y1 - y0) * 4);
    this.scene.tweens.add({ targets: p, x: x1, y: y1, duration: dur, onComplete: () => (p.destroy(), onHit()) });
  }

  ping(x: number, y: number, color: string) {
    const g = this.scene.add.graphics().setDepth(FX_DEPTH);
    const state = { r: 2, a: 1 };
    this.scene.tweens.add({
      targets: state,
      r: 10,
      a: 0,
      duration: 400,
      onUpdate: () => {
        g.clear();
        g.lineStyle(1.5, hex(color), state.a);
        g.strokeEllipse(x, y, state.r * 2, state.r * 1.2);
      },
      onComplete: () => g.destroy(),
    });
  }

  text(x: number, y: number, s: string, color: string = PAL.gold) {
    const t = this.scene.add
      .text(x, y, s, { fontFamily: 'Pixelify Sans', fontSize: '10px', color, stroke: '#000', strokeThickness: 2 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH)
      .setResolution(4);
    this.scene.tweens.add({ targets: t, y: y - 12, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  shake(intensity = 0.004) {
    this.scene.cameras.main.shake(180, intensity);
  }
}
