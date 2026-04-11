'use client'

interface DataPoint {
  label: string
  values: number[] // one per nursery, 0-100
}

interface Props {
  axes: DataPoint[]
  nurseryNames: string[]
  colors?: string[]
  size?: number
}

const DEFAULT_COLORS = [
  'rgba(79, 70, 229, 0.7)',   // indigo
  'rgba(236, 72, 153, 0.7)',  // pink
  'rgba(16, 185, 129, 0.7)',  // emerald
  'rgba(245, 158, 11, 0.7)',  // amber
  'rgba(59, 130, 246, 0.7)',  // blue
]

const FILL_COLORS = [
  'rgba(79, 70, 229, 0.15)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(16, 185, 129, 0.15)',
  'rgba(245, 158, 11, 0.15)',
  'rgba(59, 130, 246, 0.15)',
]

export default function RadarChart({ axes, nurseryNames, colors = DEFAULT_COLORS, size = 280 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 40
  const numAxes = axes.length
  const angleStep = (2 * Math.PI) / numAxes

  function getPoint(axisIdx: number, value: number): [number, number] {
    const angle = axisIdx * angleStep - Math.PI / 2
    const r = (value / 100) * radius
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  function getLabelPoint(axisIdx: number): [number, number] {
    const angle = axisIdx * angleStep - Math.PI / 2
    const r = radius + 20
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  // Grid rings at 25, 50, 75, 100
  const rings = [25, 50, 75, 100]

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] sm:max-w-xs mx-auto">
        {/* Grid rings */}
        {rings.map((ringVal) => {
          const points = Array.from({ length: numAxes }, (_, i) => getPoint(i, ringVal).join(',')).join(' ')
          return (
            <polygon
              key={ringVal}
              points={points}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
          )
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const [x, y] = getPoint(i, 100)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
        })}

        {/* Data polygons */}
        {nurseryNames.map((name, nIdx) => {
          const points = axes
            .map((axis, aIdx) => {
              const val = axis.values[nIdx] ?? 0
              return getPoint(aIdx, val).join(',')
            })
            .join(' ')
          return (
            <g key={nIdx}>
              <polygon
                points={points}
                fill={FILL_COLORS[nIdx % FILL_COLORS.length]}
                stroke={colors[nIdx % colors.length]}
                strokeWidth={2}
              />
              {/* Data point dots with tooltips */}
              {axes.map((axis, aIdx) => {
                const val = axis.values[nIdx] ?? 0
                const [px, py] = getPoint(aIdx, val)
                return (
                  <circle
                    key={aIdx}
                    cx={px}
                    cy={py}
                    r={3}
                    fill={colors[nIdx % colors.length]}
                    stroke="white"
                    strokeWidth={1}
                  >
                    <title>{`${name} — ${axis.label}: ${Math.round(val)}/100`}</title>
                  </circle>
                )
              })}
            </g>
          )
        })}

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const [x, y] = getLabelPoint(i)
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-600"
            >
              {axis.label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-3">
        {nurseryNames.map((name, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}
