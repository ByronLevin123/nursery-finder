/**
 * Shared mock database query builder for tests.
 *
 * Usage:
 *   const tables = { nurseries: [{ urn: '123', name: 'Test' }] }
 *   const { db, getTable, setTable } = createMockDb(tables)
 *
 *   vi.mock('../src/db.js', () => ({ default: db }))
 */

let idCounter = 0

export function createMockDb(initialTables = {}) {
  // Deep-clone initial data so tests don't bleed into each other
  const tables = {}
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = [...rows]
  }

  function getTable(name) {
    if (!tables[name]) tables[name] = []
    return tables[name]
  }

  function setTable(name, rows) {
    tables[name] = [...rows]
  }

  function resetAll(newTables = {}) {
    for (const key of Object.keys(tables)) delete tables[key]
    for (const [name, rows] of Object.entries(newTables)) {
      tables[name] = [...rows]
    }
  }

  function makeQueryBuilder(table) {
    const state = {
      table,
      op: 'select',
      filters: [],
      orFilters: null,
      orderBy: null,
      limitVal: null,
      rangeFrom: null,
      rangeTo: null,
      insertRow: null,
      updateRow: null,
      upsertRow: null,
      deleteOp: false,
      selectCols: '*',
      selectAfterInsert: false,
      countMode: null,
      singleMode: false,
      maybeMode: false,
      textSearchCol: null,
      textSearchQuery: null,
    }

    function matchFilter(row, [col, op, val]) {
      const rv = row[col]
      switch (op) {
        case 'eq': return rv === val
        case 'neq': return rv !== val
        case 'gt': return rv > val
        case 'gte': return rv >= val
        case 'lt': return rv < val
        case 'lte': return rv <= val
        case 'like': return typeof rv === 'string' && new RegExp('^' + val.replace(/%/g, '.*').replace(/_/g, '.') + '$').test(rv)
        case 'ilike': return typeof rv === 'string' && new RegExp('^' + val.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i').test(rv)
        case 'in': return Array.isArray(val) && val.includes(rv)
        case 'is': return rv === val
        case 'not': return rv !== val
        default: return true
      }
    }

    function applyFilters(rows) {
      let result = rows.filter((r) => state.filters.every((f) => matchFilter(r, f)))
      if (state.orFilters && state.orFilters.length > 0) {
        result = result.filter((r) =>
          state.orFilters.some((f) => matchFilter(r, f))
        )
      }
      return result
    }

    function applyOrder(rows) {
      if (!state.orderBy) return rows
      const { col, asc } = state.orderBy
      return [...rows].sort((a, b) => {
        const av = a[col], bv = b[col]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }

    function applyRange(rows) {
      if (state.limitVal != null) return rows.slice(0, state.limitVal)
      if (state.rangeFrom != null) return rows.slice(state.rangeFrom, (state.rangeTo ?? rows.length - 1) + 1)
      return rows
    }

    const builder = {
      select(cols, opts) {
        if (state.op === 'insert' || state.op === 'upsert') state.selectAfterInsert = true
        else state.op = 'select'
        if (cols) state.selectCols = cols
        if (opts?.count) state.countMode = opts.count
        return builder
      },
      insert(rowOrRows) {
        state.op = 'insert'
        state.insertRow = rowOrRows
        return builder
      },
      update(row) {
        state.op = 'update'
        state.updateRow = row
        return builder
      },
      upsert(row) {
        state.op = 'upsert'
        state.upsertRow = row
        return builder
      },
      delete() {
        state.op = 'delete'
        return builder
      },
      eq(col, val) { state.filters.push([col, 'eq', val]); return builder },
      neq(col, val) { state.filters.push([col, 'neq', val]); return builder },
      gt(col, val) { state.filters.push([col, 'gt', val]); return builder },
      gte(col, val) { state.filters.push([col, 'gte', val]); return builder },
      lt(col, val) { state.filters.push([col, 'lt', val]); return builder },
      lte(col, val) { state.filters.push([col, 'lte', val]); return builder },
      like(col, val) { state.filters.push([col, 'like', val]); return builder },
      ilike(col, val) { state.filters.push([col, 'ilike', val]); return builder },
      in(col, vals) { state.filters.push([col, 'in', vals]); return builder },
      is(col, val) { state.filters.push([col, 'is', val]); return builder },
      not(col, op, val) { state.filters.push([col, 'not', val]); return builder },
      or(filter) {
        // Parse Supabase or-filter strings: "col.op.val,col.op.val"
        if (typeof filter === 'string') {
          const parts = filter.split(',')
          state.orFilters = parts.map((p) => {
            const dotIdx = p.indexOf('.')
            const col = p.slice(0, dotIdx)
            const rest = p.slice(dotIdx + 1)
            const dotIdx2 = rest.indexOf('.')
            const op = rest.slice(0, dotIdx2)
            const val = rest.slice(dotIdx2 + 1)
            return [col, op, val]
          })
        }
        return builder
      },
      filter(col, op, val) { state.filters.push([col, op, val]); return builder },
      order(col, opts) {
        state.orderBy = { col, asc: opts?.ascending !== false }
        return builder
      },
      limit(n) { state.limitVal = n; return builder },
      range(from, to) { state.rangeFrom = from; state.rangeTo = to; return builder },
      textSearch(col, query) { state.textSearchCol = col; state.textSearchQuery = query; return builder },

      single() { return builder._resolve(true, false) },
      maybeSingle() { return builder._resolve(true, true) },
      then(onFulfilled, onRejected) {
        return builder._resolve(false, false).then(onFulfilled, onRejected)
      },

      async _resolve(single, maybe) {
        const rows = getTable(state.table)

        if (state.op === 'insert') {
          const toInsert = Array.isArray(state.insertRow) ? state.insertRow : [state.insertRow]
          const inserted = toInsert.map((r) => ({
            id: r.id || `mock-${++idCounter}`,
            created_at: new Date().toISOString(),
            ...r,
          }))
          rows.push(...inserted)
          if (single) return { data: inserted[0], error: null }
          return { data: inserted, error: null }
        }

        if (state.op === 'upsert') {
          const row = { id: state.upsertRow.id || `mock-${++idCounter}`, ...state.upsertRow }
          const idx = rows.findIndex((r) => r.id === row.id)
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row }
          else rows.push(row)
          if (single) return { data: row, error: null }
          return { data: [row], error: null }
        }

        if (state.op === 'update') {
          const matching = applyFilters(rows)
          const updated = matching.map((r) => {
            const merged = { ...r, ...state.updateRow }
            const idx = rows.indexOf(r)
            if (idx >= 0) rows[idx] = merged
            return merged
          })
          if (single) return { data: updated[0] ?? null, error: null }
          return { data: updated, error: null }
        }

        if (state.op === 'delete') {
          const matching = applyFilters(rows)
          for (const r of matching) {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          }
          return { data: matching, error: null }
        }

        // select
        let result = applyFilters(rows)
        result = applyOrder(result)
        const total = result.length
        result = applyRange(result)

        if (single) {
          if (result.length === 0 && !maybe) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          }
          return { data: result[0] ?? null, error: null }
        }
        return { data: result, error: null, count: state.countMode ? total : undefined }
      },
    }

    return builder
  }

  const rpcHandlers = {}

  const db = {
    from: (table) => makeQueryBuilder(table),
    rpc: async (name, params) => {
      if (rpcHandlers[name]) return rpcHandlers[name](params)
      return { data: [], error: null }
    },
  }

  return { db, getTable, setTable, resetAll, rpcHandlers }
}
