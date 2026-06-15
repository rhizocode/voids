/**
 * Paginated table view of recommendations with approval controls. Adds a
 * selection checkbox column (for bulk actions), a status badge, and per-row
 * Approve/Reject/Ignore/New buttons to the standard movie columns.
 */
import { useMemo } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { RecommendedMovie, RecommendedMovieStatus } from '@voids/shared';
import { Button } from './ui';
import { StatusBadge, StatusControls } from './StatusControls';

const PAGE_SIZE = 50;

export function RecommendedTable({
  data,
  selected,
  onToggleSelect,
  onSetStatus,
  mutationPending,
}: {
  data: RecommendedMovie[];
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  onSetStatus: (id: number, status: RecommendedMovieStatus) => void;
  mutationPending: boolean;
}) {
  const columns = useMemo<ColumnDef<RecommendedMovie>[]>(
    () => [
      {
        id: 'select',
        header: '',
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.title}`}
            checked={selected.has(row.original.id)}
            onChange={() => onToggleSelect(row.original.id)}
          />
        ),
      },
      { header: 'Title', accessorKey: 'title' },
      { header: 'Year', accessorFn: (m) => m.year ?? '—', id: 'year' },
      { header: 'TMDB', accessorFn: (m) => m.tmdbId ?? '—', id: 'tmdbId' },
      { header: 'Collection', accessorFn: (m) => m.collectionTitle ?? '—', id: 'collection' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <StatusControls
            movie={row.original}
            disabled={mutationPending}
            onSetStatus={(s) => onSetStatus(row.original.id, s)}
          />
        ),
      },
    ],
    [selected, onToggleSelect, onSetStatus, mutationPending],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-slate-300">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 font-medium">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {pageIndex + 1} of {pageCount} · {data.length} movies
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{data.length} movies</p>
      )}
    </div>
  );
}
