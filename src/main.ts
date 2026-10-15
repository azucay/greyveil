import * as Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';
import { Difficulty, PAL } from '@/config';
import { GameScene } from '@/scenes/GameScene';
import { Hud } from '@/ui/Hud';
import { sfx } from '@/audio/Sfx';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: PAL.bg,
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 3 },
  scene: [],
});
game.scene.add('game', GameScene, false);

let difficulty: Difficulty = 'normal';
let hud: Hud | null = null;

function start(d: Difficulty) {
  difficulty = d;
  sfx.unlock();
  void document.documentElement.requestFullscreen?.().catch(() => {});
  for (const id of ['screen-start', 'screen-menu', 'screen-over']) $(id).hidden = true;
  if (game.scene.isActive('game') || game.scene.isPaused('game')) game.scene.stop('game');
  GameScene.onReady = (scene) => {
    hud = new Hud(scene);
    const startedAt = performance.now();
    scene.world.on('over', (won) => {
      const min = Math.round((performance.now() - startedAt) / 60000);
      setTimeout(() => {
        $('over-title').textContent = won ? 'Sieg!' : 'Niederlage';
        $('over-text').textContent = won ? `Die Horde ist gebrochen. (${min} Min.)` : `Deine Basis ist gefallen. (${min} Min.)`;
        $('screen-over').hidden = false;
      }, 1400);
    });
    if (!tickBound) scene.events.on('update', (_t: number, dt: number) => hud?.tick(dt / 1000));
    tickBound = true;
  };
  // Achtung: start() kann synchron create() ausführen → onReady vorher setzen
  game.scene.start('game', { difficulty: d, seed: Math.floor(Math.random() * 1e9) });
}
let tickBound = false;

function quit() {
  game.scene.stop('game');
  hud = null;
  $('hud').hidden = true;
  $('screen-menu').hidden = true;
  $('screen-over').hidden = true;
  $('screen-start').hidden = false;
}

const scene = () => game.scene.getScene('game') as GameScene;

document.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) => (b.onclick = () => start(b.dataset.diff as Difficulty)));
$('btn-menu').onclick = () => {
  scene().paused = true;
  $('screen-menu').hidden = false;
};
$('m-resume').onclick = () => {
  scene().paused = false;
  $('screen-menu').hidden = true;
};
$('m-sound').onclick = () => {
  sfx.muted = !sfx.muted;
  $('m-sound').textContent = `Ton: ${sfx.muted ? 'aus' : 'an'}`;
};
$('m-restart').onclick = () => start(difficulty);
$('m-quit').onclick = quit;
$('o-again').onclick = () => start(difficulty);
$('o-menu').onclick = quit;

// Auto-Pause, wenn die App in den Hintergrund geht
document.addEventListener('visibilitychange', () => {
  if (document.hidden && hud && !scene().world.over) {
    scene().paused = true;
    $('screen-menu').hidden = false;
  }
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');

// Debug-Zugriff für Tests
(window as unknown as { __greyveil: unknown }).__greyveil = { game, scene };
