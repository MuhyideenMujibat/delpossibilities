import { Search, X } from 'lucide-react'
import { STATUS_OPTIONS } from '../api'
import { useHostels } from '../hooks/useHostels'

const EMPTY_FILTERS = { search: '', status: 'all', hostel: 'all', from: '', to: '' }

export { EMPTY_FILTERS }

function OrderFilters({
  filters,
  onChange,
  searchPlaceholder = 'Search…',
  resultCount,
  totalCount,
  statusOptions = STATUS_OPTIONS,
  showHostelFilter = false,
}) {
  const { hostels } = useHostels()
  const isActive = filters.search || filters.status !== 'all' || (filters.hostel && filters.hostel !== 'all') || filters.from || filters.to

  const set = (patch) => onChange({ ...filters, ...patch })

  return (
    <div className="filter-bar">
      <div className="relative flex-1 sm:min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={searchPlaceholder}
          className="filter-field pl-9"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => set({ status: e.target.value })}
        className="filter-field sm:w-52"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showHostelFilter && (
        <select
          value={filters.hostel || 'all'}
          onChange={(e) => set({ hostel: e.target.value })}
          className="filter-field sm:w-52"
          aria-label="Filter by hostel"
        >
          <option value="all">All hostels</option>
          <option value="off_campus">Off-campus</option>
          {hostels.map((hostel) => (
            <option key={hostel.id} value={hostel.name}>
              {hostel.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
          className="filter-field sm:w-36"
          aria-label="From date"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
          className="filter-field sm:w-36"
          aria-label="To date"
        />
      </div>

      {isActive && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="btn-ghost">
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Clear
        </button>
      )}

      {typeof resultCount === 'number' && (
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          Showing {resultCount} of {totalCount}
        </span>
      )}
    </div>
  )
}

export default OrderFilters
