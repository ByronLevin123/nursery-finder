'use client'

const gradients = [
  'from-blue-400 to-indigo-500',
  'from-green-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-rose-400 to-red-500',
]

function nameToGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
}

export default function NurseryPlaceholder({ name }: { name: string }) {
  const gradient = nameToGradient(name)
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className={`bg-gradient-to-br ${gradient} aspect-video rounded-lg flex items-center justify-center`}>
      <span className="text-white text-5xl font-bold opacity-80">{initial}</span>
    </div>
  )
}
