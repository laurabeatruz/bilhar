'use client'

import { useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const W = 880
const H = 480
const BALL_R = 13

const BALL_COLORS: Record<string, number> = {
  ball_0: 0xffdd00, ball_1: 0x0044ff, ball_2: 0xff2200,
  ball_3: 0x9900cc, ball_4: 0x111111, ball_5: 0xff8800,
  ball_6: 0x006600, ball_7: 0x8B0000, ball_8: 0x0099aa,
  ball_9: 0xffdd00,
}

const BALL_NUMBERS: Record<string, string> = {
  ball_0: '1', ball_1: '2', ball_2: '3', ball_3: '4',
  ball_4: '8', ball_5: '5', ball_6: '6', ball_7: '7',
  ball_8: '9', ball_9: '10',
}

const BALL_COLORS_CSS = [
  '#ffdd00','#0044ff','#ff2200','#9900cc',
  '#111111','#ff8800','#006600','#8B0000','#0099aa','#ffdd00'
]

export default function Home() {
  const gameRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'menu' | 'waiting' | 'playing'>('menu')
  const [roomId, setRoomId] = useState('')
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [gameOver, setGameOver] = useState<null | { won: boolean; reason: string }>(null)
  const [myPocketedBalls, setMyPocketedBalls] = useState<{id: number, label: string}[]>([])
  const [opponentPocketedBalls, setOpponentPocketedBalls] = useState<{id: number, label: string}[]>([])
  const ballGraphics = useRef<Map<string | number, any>>(new Map())
  const cueBallGraphic = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const isMyTurnRef = useRef(false)
  const isShootingRef = useRef(false)

  function joinQueue() {
  const socket = io('https://bilhar-production.up.railway.app', {
  path: '/socket.io',
  transports: ['websocket', 'polling']
})

    socket.on('connect', () => {
      socket.emit('join_queue', { betAmount: 20 })
      setStatus('waiting')
    })

    socket.on('match_found', ({ roomId, currentTurn, initialState }: any) => {
      setRoomId(roomId)
      setStatus('playing')
      const myTurn = currentTurn === socket.id
      setIsMyTurn(myTurn)
      isMyTurnRef.current = myTurn
      isShootingRef.current = false
      initGame(socket, roomId, initialState)
    })

    socket.on('state_update', (state: any) => {
      if (cueBallGraphic.current) {
        cueBallGraphic.current.setPosition(state.cueBall.x, state.cueBall.y)
      }
      state.balls.forEach((ball: any) => {
        const g = ballGraphics.current.get(ball.id)
        if (g) g.setPosition(ball.x, ball.y)
      })
    })

    socket.on('turn_change', ({ currentTurn }: any) => {
      const myTurn = currentTurn === socket.id
      setIsMyTurn(myTurn)
      isMyTurnRef.current = myTurn
      isShootingRef.current = false  // SEMPRE reseta aqui
    })

    socket.on('ball_pocketed', ({ ballId, label, scoredBy }: any) => {
      const g = ballGraphics.current.get(ballId)
      if (g) g.setVisible(false)
      const ball = { id: ballId, label }
      if (scoredBy === socket.id) {
        setMyPocketedBalls(prev => [...prev, ball])
      } else {
        setOpponentPocketedBalls(prev => [...prev, ball])
      }
    })

    socket.on('game_over', ({ winner, reason }: any) => {
      const won = winner === socket.id
      setGameOver({ won, reason })
    })

    socket.on('cue_ball_pocketed', () => {
      // Bola branca volta automaticamente — só avisa
    })

    socket.on('opponent_disconnected', () => {
      alert('Oponente desconectou! Você venceu!')
      setStatus('menu')
    })
  }

  function initGame(socket: Socket, roomId: string, initialState: any) {
    const setup = async () => {
      const Phaser = (await import('phaser')).default
      let pointer = { x: 0, y: 0 }

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: W,
        height: H,
        parent: gameRef.current!,
        backgroundColor: '#1a6b3c',
        scene: {
          create() {
            const scene = this as Phaser.Scene
            sceneRef.current = scene

            // Mesa
            const g = scene.add.graphics()
            g.fillStyle(0x5C3317)
            g.fillRect(0, 0, W, H)
            g.fillStyle(0x2d7a3a)
            g.fillRect(20, 20, W - 40, H - 40)

            // Caçapas
            const pockets = [
              { x: 25, y: 25 }, { x: W / 2, y: 15 }, { x: W - 25, y: 25 },
              { x: 25, y: H - 25 }, { x: W / 2, y: H - 15 }, { x: W - 25, y: H - 25 },
            ]
            pockets.forEach(p => {
              g.fillStyle(0x000000)
              g.fillCircle(p.x, p.y, 18)
            })

            // Linha do meio
            g.lineStyle(1, 0xffffff, 0.1)
            g.beginPath()
            g.moveTo(W / 2, 20)
            g.lineTo(W / 2, H - 20)
            g.strokePath()
            g.strokeCircle(W / 2, H / 2, 60)

            // Bolas coloridas com número
            initialState.balls.forEach((ball: any) => {
              const bg = scene.add.graphics()
              bg.fillStyle(BALL_COLORS[ball.label] ?? 0xffffff)
              bg.fillCircle(0, 0, BALL_R)
              // Círculo branco no centro para o número
              bg.fillStyle(0xffffff)
              bg.fillCircle(0, 0, 5)
              bg.setPosition(ball.x, ball.y)
              ballGraphics.current.set(ball.id, bg)

              // Número da bola
              const num = scene.add.text(ball.x, ball.y, BALL_NUMBERS[ball.label] ?? '', {
                fontSize: '8px',
                color: '#000000',
                fontStyle: 'bold',
              }).setOrigin(0.5)

              // Atualizar posição do número junto com a bola
              scene.events.on('update', () => {
                if (bg.visible) {
                  num.setPosition(bg.x, bg.y)
                  num.setVisible(true)
                } else {
                  num.setVisible(false)
                }
              })
            })

            // Bola branca
            const cg = scene.add.graphics()
            cg.fillStyle(0xffffff)
            cg.fillCircle(0, 0, BALL_R)
            cg.setPosition(initialState.cueBall.x, initialState.cueBall.y)
            cueBallGraphic.current = cg

            const aimLine = scene.add.graphics()
            const cueStick = scene.add.graphics()

            scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
              pointer = { x: p.x, y: p.y }
            })

            scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
              if (!isMyTurnRef.current || isShootingRef.current) return
              isShootingRef.current = true
              socket.emit('shot', { roomId, px: p.x, py: p.y })
            })

            scene.events.on('update', () => {
              aimLine.clear()
              cueStick.clear()

              if (!isMyTurnRef.current || isShootingRef.current || !cueBallGraphic.current) return

              const cx = cueBallGraphic.current.x
              const cy = cueBallGraphic.current.y
              const dx = cx - pointer.x
              const dy = cy - pointer.y
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < 5) return

              const nx = dx / dist
              const ny = dy / dist

              // Taco
              const tacoDist = 20 + Math.min(dist * 0.3, 60)
              cueStick.lineStyle(7, 0xd4a96a)
              cueStick.beginPath()
              cueStick.moveTo(cx - nx * tacoDist, cy - ny * tacoDist)
              cueStick.lineTo(cx - nx * (tacoDist + 130), cy - ny * (tacoDist + 130))
              cueStick.strokePath()

              // Linha de mira
              let hitX = cx + nx * 300
              let hitY = cy + ny * 300
              let hitBall: any = null
              let minD = 9999

              ballGraphics.current.forEach((bg) => {
                if (!bg.visible) return
                const bx = bg.x
                const by = bg.y
                const tx = bx - cx
                const ty = by - cy
                const proj = tx * nx + ty * ny
                if (proj <= 0) return
                const closestX = cx + nx * proj
                const closestY = cy + ny * proj
                const perp = Math.sqrt((bx - closestX) ** 2 + (by - closestY) ** 2)
                if (perp < BALL_R * 2 && proj < minD) {
                  minD = proj
                  const overlap = Math.sqrt((BALL_R * 2) ** 2 - perp ** 2)
                  hitX = cx + nx * (proj - overlap)
                  hitY = cy + ny * (proj - overlap)
                  hitBall = { x: bx, y: by }
                }
              })

              aimLine.lineStyle(1.5, 0xffffff, 0.5)
              aimLine.beginPath()
              aimLine.moveTo(cx, cy)
              aimLine.lineTo(hitX, hitY)
              aimLine.strokePath()
              aimLine.lineStyle(1, 0xffffff, 0.25)
              aimLine.strokeCircle(hitX, hitY, BALL_R)

              if (hitBall) {
                const bDx = hitBall.x - hitX
                const bDy = hitBall.y - hitY
                const bD = Math.sqrt(bDx ** 2 + bDy ** 2)
                if (bD > 0) {
                  aimLine.lineStyle(1.5, 0xffff00, 0.5)
                  aimLine.beginPath()
                  aimLine.moveTo(hitBall.x, hitBall.y)
                  aimLine.lineTo(hitBall.x + (bDx / bD) * 120, hitBall.y + (bDy / bD) * 120)
                  aimLine.strokePath()
                }
              }
            })
          },
          update() {},
        },
      }
      new Phaser.Game(config)
    }
    setup()
  }

  function getBallColor(label: string) {
    const idx = parseInt(label.split('_')[1])
    return BALL_COLORS_CSS[idx] ?? '#ffffff'
  }

  function getBallNumber(label: string) {
    return BALL_NUMBERS[label] ?? '?'
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 py-6">
      <h1 className="text-white text-3xl font-bold mb-4">🎱 Bilhar Online</h1>

      {status === 'menu' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-400 text-center">Jogue contra outro jogador e aposte R$ 20</p>
          <button onClick={joinQueue}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-10 rounded-xl text-lg transition">
            🎮 Jogar por R$ 20
          </button>
        </div>
      )}

      {status === 'waiting' && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-white text-xl animate-pulse">⏳ Procurando oponente...</div>
          <p className="text-gray-500 text-sm">Abre outra aba e clica em Jogar para testar</p>
        </div>
      )}

      {status === 'playing' && !gameOver && (
        <div className="flex flex-col items-center gap-3">
          <div className={`text-base font-bold px-4 py-1 rounded-full ${isMyTurn ? 'bg-green-600 text-white' : 'bg-red-900 text-red-200'}`}>
            {isMyTurn ? '🎯 Sua vez!' : '⏳ Vez do oponente...'}
          </div>

          <div className="flex items-start gap-3">
            {/* Suas bolas */}
            <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-2 w-16 min-h-48">
              <span className="text-green-400 text-xs font-bold mb-1">Você</span>
              {myPocketedBalls.map((b, i) => (
                <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border border-gray-600"
                  style={{ backgroundColor: getBallColor(b.label), color: b.label === 'ball_4' ? '#fff' : '#000' }}>
                  {getBallNumber(b.label)}
                </div>
              ))}
            </div>

            <div ref={gameRef} className="rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-900" />

            {/* Bolas do oponente */}
            <div className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-2 w-16 min-h-48">
              <span className="text-red-400 text-xs font-bold mb-1">Rival</span>
              {opponentPocketedBalls.map((b, i) => (
                <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border border-gray-600"
                  style={{ backgroundColor: getBallColor(b.label), color: b.label === 'ball_4' ? '#fff' : '#000' }}>
                  {getBallNumber(b.label)}
                </div>
              ))}
            </div>
          </div>
          <p className="text-gray-600 text-xs">Sala: {roomId}</p>
        </div>
      )}

      {gameOver && (
        <div className="flex flex-col items-center gap-6">
          <div className={`text-6xl ${gameOver.won ? 'animate-bounce' : ''}`}>
            {gameOver.won ? '🏆' : '😢'}
          </div>
          <h2 className={`text-4xl font-bold ${gameOver.won ? 'text-yellow-400' : 'text-red-400'}`}>
            {gameOver.won ? 'Você venceu!' : 'Você perdeu!'}
          </h2>
          <p className="text-gray-400 text-center">
            {gameOver.reason === 'black_early'
              ? gameOver.won ? 'O oponente encaçapou a bola 8 antes da hora!' : 'Você encaçapou a bola 8 antes da hora!'
              : gameOver.reason === 'black_win'
              ? gameOver.won ? 'Você encaçapou todas as bolas — campeão!' : 'O oponente encaçapou todas as bolas!'
              : ''}
          </p>
          <button
            onClick={() => {
              setGameOver(null)
              setStatus('menu')
              setMyPocketedBalls([])
              setOpponentPocketedBalls([])
              ballGraphics.current.clear()
              cueBallGraphic.current = null
              sceneRef.current = null
            }}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition">
            🎮 Jogar novamente
          </button>
        </div>
      )}

      {status !== 'playing' && <div ref={gameRef} className="hidden" />}
    </main>
  )
}