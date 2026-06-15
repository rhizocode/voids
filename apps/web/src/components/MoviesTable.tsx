/**
 * A paginated TanStack Table for browsing a movie list. Pagination keeps the
 * page responsive for large libraries (e.g. 1329 owned movies) by only
 * rendering one page of rows at a time. Columns are configurable so the
 * Libraries and Recommended pages can show different fields.
 */
import { useMemo } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Movie } from '@voids/shared';
import { Button } from './ui';

const PAGE_SIZE = 50;

export function MoviesTable<T extends Movie>({ data }: { data: T[] }) {
  const columns = useMemo<ColumnDef<T>[]>(
    () => [
      { header: 'Title', accessorKey: 'title' },
      { header: 'Year', accessorFn: (m) => m.year ?? '—', id: 'year' },
      { header: 'TMDB', accessorFn: (m) => m.tmdbId ?? '—', id: 'tmdbId' },
      { header: 'IMDB', accessorFn: (m) => m.imdbId ?? '—', id: 'imdbId' },
      { header: 'Collection', accessorFn: (m) => m.collectionTitle ?? '—', id: 'collection' },
    ],
    [],
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
                  <td key={cell.id} className="px-3 py-2">
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
