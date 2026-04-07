import Link from 'next/link'

export interface Crumb {
  name: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-indigo-600 hover:underline">
                  {item.name}
                </Link>
              ) : (
                <span className={isLast ? 'text-gray-700 font-medium' : ''}>{item.name}</span>
              )}
              {!isLast && <span className="text-gray-300">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
