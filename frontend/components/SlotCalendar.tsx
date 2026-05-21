'use client'

import { useMemo, useState } from 'react'

interface Slot {
  id: string
  slot_date: string
  slot_time: string
  duration_min: number
  capacity: number
  booked: number
}

interface Props {
  slots: Slot[]
  onDeleteSlot?: (id: string) => void
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function SlotCalendar({ slots, onDeleteSlot }: Props) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const firstDayOfWeek = days[0].getDay() === 0 ? 6 : days[0].getDay() - 1

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {}
    for (const s of slots) {
      const d = s.slot_date.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(s)
    }
    return map
  }, [slots])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const monthLabel = viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(new Date())

  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] || []) : []

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">&larr;</button>
        <h3 className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
        <button onClick={nextMonth} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">&rarr;</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const dk = dateKey(day)
          const daySlots = slotsByDate[dk] || []
          const hasSlots = daySlots.length > 0
          const totalBooked = daySlots.reduce((s, sl) => s + sl.booked, 0)
          const totalCapacity = daySlots.reduce((s, sl) => s + sl.capacity, 0)
          const isToday = dk === todayKey
          const isSelected = dk === selectedDate

          return (
            <button
              key={dk}
              onClick={() => setSelectedDate(isSelected ? null : dk)}
              className={`relative p-1.5 rounded-lg text-center transition text-sm ${
                isSelected
                  ? 'bg-indigo-100 border-2 border-indigo-500'
                  : isToday
                    ? 'bg-blue-50 border border-blue-200'
                    : hasSlots
                      ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                      : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <span className={`block text-xs ${isToday ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                {day.getDate()}
              </span>
              {hasSlots && (
                <span className="block text-[10px] text-green-700 font-medium">
                  {daySlots.length} slot{daySlots.length > 1 ? 's' : ''}
                </span>
              )}
              {hasSlots && totalBooked > 0 && (
                <span className="block text-[10px] text-gray-500">
                  {totalBooked}/{totalCapacity}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </h4>
          {selectedSlots.length === 0 ? (
            <p className="text-sm text-gray-500">No slots on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium">{slot.slot_time}</p>
                    <p className="text-xs text-gray-500">
                      {slot.duration_min}min &middot; {slot.booked}/{slot.capacity} booked
                    </p>
                  </div>
                  {onDeleteSlot && (
                    <button
                      onClick={() => onDeleteSlot(slot.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
