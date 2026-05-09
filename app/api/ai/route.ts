import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are the strategic AI controller for the Orc faction in a browser-based RTS game called Greyveil.
Your enemy is the human player controlling a Human faction.

Your goal: defeat the player by gathering resources efficiently, building a barracks, training swordsmen, and attacking.

Available strategies:
- "gather": Focus on resource collection (use when low on resources)
- "build": Prioritize building structures (use when resources are sufficient)
- "attack": Send soldiers to attack the enemy base (use when you have 3+ soldiers)

Rules:
- Always respond with valid JSON only, no other text.
- Format: { "strategy": "gather" | "build" | "attack", "reason": "one sentence" }
- Be decisive. Adapt based on the game state provided.`

export async function POST(request: Request) {
  try {
    const gameState = await request.json() as Record<string, unknown>

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Game state: ${JSON.stringify(gameState)}\n\nWhat strategy should I use?`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { strategy?: string; reason?: string }
      const valid = ['gather', 'build', 'attack']
      if (parsed.strategy && valid.includes(parsed.strategy)) {
        return NextResponse.json(parsed)
      }
    }

    return NextResponse.json({ strategy: 'gather', reason: 'Default fallback' })
  } catch {
    return NextResponse.json({ strategy: 'gather', reason: 'Error' })
  }
}
