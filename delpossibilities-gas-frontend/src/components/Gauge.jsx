import { useState, useEffect } from 'react'
import { useReducedMotion } from 'motion/react'

const TICK_ANGLES = [180, 135, 90, 45, 0]
const CX = 110
const CY = 128
const R = 92

function polar(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) }
}

const RIM_START = polar(R, 180)
const RIM_END = polar(R, 0)
const RIM_PATH = `M ${RIM_START.x} ${RIM_START.y} A ${R} ${R} 0 0 1 ${RIM_END.x} ${RIM_END.y}`

// A hand-drawn pressure-gauge dial: the needle sweeps from Empty to Full once
// on mount. Purely illustrative (no live data behind it) — it's the visual
// signature for the brand's "you never run out" promise, not a data widget.
function Gauge({ label = 'NEVER RUN EMPTY', className = '' }) {
  const shouldReduceMotion = useReducedMotion()
  const [full, setFull] = useState(!!shouldReduceMotion)

  useEffect(() => {
    if (shouldReduceMotion) return
    const timer = setTimeout(() => setFull(true), 350)
    return () => clearTimeout(timer)
  }, [shouldReduceMotion])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 220 150" className="w-full max-w-[260px]" aria-hidden="true">
        <path d={RIM_PATH} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="10" strokeLinecap="round" />

        {TICK_ANGLES.map((angle) => {
          const inner = polar(R - 14, angle)
          const outer = polar(R + 3, angle)
          return (
            <line
              key={angle}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )
        })}

        <text
          x={polar(R + 22, 180).x}
          y={polar(R + 22, 180).y}
          textAnchor="middle"
          fill="rgba(255,255,255,0.5)"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="12"
          fontWeight="600"
        >
          E
        </text>
        <text
          x={polar(R + 22, 0).x}
          y={polar(R + 22, 0).y}
          textAnchor="middle"
          fill="rgba(255,255,255,0.5)"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="12"
          fontWeight="600"
        >
          F
        </text>

        <g
          style={{
            transform: `rotate(${full ? -16 : -166}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: shouldReduceMotion ? 'none' : 'transform 1.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <line x1={CX} y1={CY} x2={CX + R - 24} y2={CY} stroke="#d9531e" strokeWidth="4" strokeLinecap="round" />
        </g>

        <circle cx={CX} cy={CY} r="7" fill="#d9531e" />
        <circle cx={CX} cy={CY} r="3" fill="#0b1e33" />
      </svg>

      {label && <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{label}</p>}
    </div>
  )
}

export default Gauge
