import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'

function makeData(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))
}

const columns = [{ label: 'Name' }]
const renderRow = (item) => (
  <tr key={item.id}>
    <td>{item.name}</td>
  </tr>
)

describe('DataTable', () => {
  it('renders the title and rows for the first page', () => {
    render(<DataTable title="My Table" data={makeData(3)} columns={columns} renderRow={renderRow} pageSize={8} />)
    expect(screen.getByText('My Table')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 3')).toBeInTheDocument()
    expect(screen.getByText('3 rows')).toBeInTheDocument()
  })

  it('shows the empty state with title/description when data is empty', () => {
    render(
      <DataTable
        title="My Table"
        data={[]}
        columns={columns}
        renderRow={renderRow}
        emptyTitle="No items"
        emptyDesc="Nothing to show"
      />
    )
    expect(screen.getByText('No items')).toBeInTheDocument()
    expect(screen.getByText('Nothing to show')).toBeInTheDocument()
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('calls onClearFilters from the empty state button when provided', () => {
    const onClearFilters = vi.fn()
    render(
      <DataTable title="T" data={[]} columns={columns} renderRow={renderRow} onClearFilters={onClearFilters} />
    )
    fireEvent.click(screen.getByText('Clear Filters'))
    expect(onClearFilters).toHaveBeenCalled()
  })

  it('paginates: shows only pageSize rows per page and navigates to next page', () => {
    render(<DataTable title="T" data={makeData(10)} columns={columns} renderRow={renderRow} pageSize={4} />)

    // page 1: items 1-4
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 4')).toBeInTheDocument()
    expect(screen.queryByText('Item 5')).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Next'))

    expect(screen.getByText('Item 5')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('disables first/prev buttons on the first page and next/last on the last page', () => {
    render(<DataTable title="T" data={makeData(4)} columns={columns} renderRow={renderRow} pageSize={4} />)
    expect(screen.getByTitle('First page')).toBeDisabled()
    expect(screen.getByTitle('Previous')).toBeDisabled()
    expect(screen.getByTitle('Next')).toBeDisabled()
    expect(screen.getByTitle('Last page')).toBeDisabled()
  })

  it('resets to page 1 when data length changes', () => {
    const { rerender } = render(<DataTable title="T" data={makeData(10)} columns={columns} renderRow={renderRow} pageSize={4} />)
    fireEvent.click(screen.getByTitle('Next'))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    rerender(<DataTable title="T" data={makeData(2)} columns={columns} renderRow={renderRow} pageSize={4} />)
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })
})
