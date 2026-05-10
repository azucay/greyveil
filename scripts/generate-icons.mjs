import sharp from 'sharp'
import { mkdir } from 'fs/promises'

await mkdir('public', { recursive: true })

const svg512 = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1a1a2e"/>
  <rect x="56" y="56" width="400" height="400" rx="60" ry="60" fill="#1e3a5f" stroke="#3b82f6" stroke-width="12"/>
  <text x="256" y="332" font-family="Georgia,serif" font-size="260" font-weight="900" fill="#60a5fa" text-anchor="middle" dominant-baseline="auto">G</text>
</svg>`

const svg192 = `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#1a1a2e"/>
  <rect x="20" y="20" width="152" height="152" rx="24" ry="24" fill="#1e3a5f" stroke="#3b82f6" stroke-width="5"/>
  <text x="96" y="127" font-family="Georgia,serif" font-size="88" font-weight="900" fill="#60a5fa" text-anchor="middle" dominant-baseline="auto">G</text>
</svg>`

await sharp(Buffer.from(svg512)).png().toFile('public/icon-512.png')
await sharp(Buffer.from(svg192)).png().toFile('public/icon-192.png')

console.log('Icons generated: public/icon-192.png, public/icon-512.png')
