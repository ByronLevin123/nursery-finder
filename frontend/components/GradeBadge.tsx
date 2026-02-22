const GRADE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Outstanding': {
    bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300',
    label: 'Outstanding'
  },
  'Good': {
    bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300',
    label: 'Good'
  },
  'Requires Improvement': {
    bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300',
    label: 'Requires Improvement'
  },
  'Inadequate': {
    bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300',
    label: 'Inadequate'
  },
}

interface Props {
  grade: string | null
  size?: 'sm' | 'md' | 'lg'
}

export default function GradeBadge({ grade, size = 'md' }: Props) {
  const style = grade ? GRADE_STYLES[grade] : null
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' :
                    size === 'lg' ? 'text-base px-4 py-2' :
                    'text-sm px-3 py-1'

  if (!style) {
    return (
      <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} bg-gray-100 text-gray-600 border-gray-300`}>
        Not yet inspected
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  )
}
