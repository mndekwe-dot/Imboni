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

describe('DataTable loading', () => {
  const cols = [{ label: 'Student' }, { label: 'Class' }, { label: 'Status' }]

  it('keeps the real column headers on screen while the rows load', () => {
    render(<DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading />)
    expect(screen.getByRole('columnheader', { name: 'Student' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Class' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
  })

  it('fills the body with one skeleton row per page row, in the right number of columns', () => {
    const { container } = render(
      <DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading pageSize={6} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(6)
    expect(rows[0].querySelectorAll('td')).toHaveLength(3)
  })

  it('is not the empty state, which would claim there are no results', () => {
    render(<DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading
      emptyTitle="Nothing here" />)
    expect(screen.queryByText('Nothing here')).toBeNull()
    expect(screen.queryByText('No results')).toBeNull()
  })

  it('announces the wait to a screen reader, using the label it is given', () => {
    render(<DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading
      loadingLabel="Loading students…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading students…')
  })

  it('is marked busy, and shows no row count or page number yet', () => {
    const { container } = render(<DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading />)
    expect(container.querySelector('.dt-body')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.dt-count')).toBeNull()
    expect(screen.queryByText(/Page \d+ of/)).toBeNull()
  })

  it('gives a person column an avatar placeholder when asked', () => {
    const { container } = render(
      <DataTable title="All" data={[]} columns={cols} renderRow={renderRow} loading skeletonAvatar />)
    expect(container.querySelector('tbody tr td .skel-avatar')).toBeInTheDocument()
  })

  it('shows the real rows once loading ends', () => {
    const { rerender } = render(<DataTable title="All" data={[]} columns={columns} renderRow={renderRow} loading />)
    rerender(<DataTable title="All" data={makeData(2)} columns={columns} renderRow={renderRow} />)
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })
})

describe('DataTable server paging', () => {
  // The server holds 53 rows; this is page 2 of 25-row pages, so 25 rows arrive.
  const pageTwo = Array.from({ length: 25 }, (_, i) => ({ id: 26 + i, name: `Item ${26 + i}` }))

  it('shows the server\'s total, not the length of the page it was given', () => {
    render(<DataTable title="T" data={pageTwo} columns={columns} renderRow={renderRow}
      pageSize={25} total={53} page={2} onPageChange={() => {}} />)
    expect(screen.getByText('26-50 of 53')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('renders every row it was given and does not slice them again', () => {
    render(<DataTable title="T" data={pageTwo} columns={columns} renderRow={renderRow}
      pageSize={25} total={53} page={2} onPageChange={() => {}} />)
    expect(screen.getByText('Item 26')).toBeInTheDocument()
    expect(screen.getByText('Item 50')).toBeInTheDocument()
  })

  it('asks the caller for another page instead of changing it itself', () => {
    const onPageChange = vi.fn()
    render(<DataTable title="T" data={pageTwo} columns={columns} renderRow={renderRow}
      pageSize={25} total={53} page={2} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByLabelText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByLabelText('Previous'))
    expect(onPageChange).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByLabelText('Last page'))
    expect(onPageChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByLabelText('First page'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('stays on the page the caller says, even if the page of rows is short', () => {
    render(<DataTable title="T" data={makeData(3)} columns={columns} renderRow={renderRow}
      pageSize={25} total={53} page={3} onPageChange={() => {}} />)
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })

  it('disables the ends of the pager', () => {
    render(<DataTable title="T" data={pageTwo} columns={columns} renderRow={renderRow}
      pageSize={25} total={53} page={1} onPageChange={() => {}} />)
    expect(screen.getByLabelText('Previous')).toBeDisabled()
    expect(screen.getByLabelText('Next')).not.toBeDisabled()
  })

  it('is the empty state when the server has nothing', () => {
    render(<DataTable title="T" data={[]} columns={columns} renderRow={renderRow}
      total={0} page={1} onPageChange={() => {}} emptyTitle="Nobody" />)
    expect(screen.getByText('Nobody')).toBeInTheDocument()
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('leaves the old behaviour alone when no total is passed', () => {
    render(<DataTable title="T" data={makeData(20)} columns={columns} renderRow={renderRow} pageSize={8} />)
    expect(screen.getByText('1-8 of 20')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next'))
    expect(screen.getByText('9-16 of 20')).toBeInTheDocument()
  })
})
