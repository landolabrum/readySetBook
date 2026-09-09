import React, { Dispatch, SetStateAction, useEffect, useState, useMemo } from "react";
import styles from "./AdapTable.scss";
import AdapTableContent, { TableFunctionProps } from "../components/AdaptTableContent/views/AdapTableContent";
import AdapTableHeader from "../components/AdapTableHeader/AdapTableHeader";
import AdapTableFooter from "../components/AdapTableFooter/AdapTableFooter";
import { IFormControlVariant } from "../models/IVariant";
import { dateFormat } from "@webstack/helpers/userExperienceFormats";

const DEFAULT_LIMIT = 10;

export type TableOptions = {
  hide?: "footer" | "header" | ['th', 'header'] | ["header"] | ["footer", "header"] | ["header", "footer"] | "entries" | 'th';
  index?: number;
  cellHeight?: number;
  tableTitle?: string | React.ReactElement;
  title?: string;
  hideColumns?: string[];
  hoverable?: boolean;
  placeholder?: string;
  position?: string;
  renderCell?: (key: string, item: any, rowIndex: number) => React.ReactNode;
  /** When true, table data is already paginated externally; footer still shows full range using total/page/limit, but rows are not client-sliced again. */
  externalPagination?: boolean;
};

interface TableProps extends TableFunctionProps {
  total?: number;
  limit?: number;
  loading?: boolean;
  onRowClick?: (e: any) => void;
  /** Now supports single string or multi-variant tokens ("vertical mini") or string[] */
  variant?: IFormControlVariant | string | string[];
  options?: TableOptions;
  page?: number;
  setPage?: (e: any) => void;
  setLimit?: Dispatch<SetStateAction<number>>;
  style?: { [key: string]: string };
  onSelect?: (e: any) => void;

  /** Enable drag-reorder. If provided, rows become draggable. */
  onDrag?: (payload: {
    row: any;
    drag: number;     // +down / -up
    from: number;     // original index (in current tableData)
    to: number;       // new index (in current tableData)
    data: any[];      // new ordered data (non-mutated original)
  }) => void;
}

function normalizeVariantTokens(variant?: IFormControlVariant | string | string[]): string[] {
  if (!variant) return [];
  if (Array.isArray(variant)) return variant.filter(Boolean).map(String);
  return String(variant).split(/\s+/).filter(Boolean);
}

const AdapTable = ({
  total,
  data,
  filters,
  filterBy,
  loading,
  search,
  variant,
  limit,
  options,
  onRowClick,
  setSearch,
  setFilter,
  setLimit,
  page,
  setPage,
  style,
  onSelect,
  onDrag,
}: TableProps) => {
  const [limit_, setLimit_] = useState<number>(DEFAULT_LIMIT);
  const [visibleData, setVisibleData] = useState<any>([]);

  const externalPagination = options?.externalPagination;

  const effectiveLimit = externalPagination && typeof limit === "number" ? limit : limit_;

  const baseStartIndex = page ? (page - 1) * effectiveLimit : 1;
  const startIndex = externalPagination
    ? (page ? (page - 1) * effectiveLimit : 0)
    : baseStartIndex;
  const totalPages: number =
    total !== undefined ? Math.ceil(Number(total) / Number(effectiveLimit || DEFAULT_LIMIT)) : 0;
  const endIndex = total
    ? startIndex + effectiveLimit < total
      ? startIndex + effectiveLimit
      : total
    : data?.length;

  const hideHeader = options?.hide?.includes("header") || options?.hide === "header";

  const variantTokens = useMemo(() => normalizeVariantTokens(variant), [variant]);
  const hasMini = variantTokens.includes("mini");

  function sortByKey(key: any, isAscend: boolean) {
    function sorter(keyA: any, keyB: any) {
      function charFinder(key: any) {
        if (typeof key === "string") return key.replace(/[^a-zA-Z0-9]/g, "");
        const cell = key?.props?.cell;
        if (cell === "member") key = key.props.data.name;
        if (cell === "currency-crypto") key = key.props.data.amount;
        if (cell === "date") key = dateFormat(key.props.data);
        return key;
      }
      keyA = charFinder(keyA);
      keyB = charFinder(keyB);
      try {
        keyA.toLowerCase();
        keyB.toLowerCase();
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
      } catch {
        return 0;
      }
    }
    // Mutates incoming data in existing codebase – preserving behavior:
    data?.sort((a: any, b: any) => (isAscend ? sorter(a[key], b[key]) : sorter(b[key], a[key])));
    setVisibleData(data?.slice(startIndex, endIndex));
  }

  const handlePageChange = (newPage: number) => {
    if (!setPage) return;
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleVisible = () => {
    if (!data) return;
    if (externalPagination) {
      setVisibleData(data);
    } else {
      const vd = Object.entries(data).length > 0 && data?.slice(startIndex, endIndex);
      setVisibleData(vd);
    }
  };

  useEffect(() => {
    handleVisible();
    if (!externalPagination && limit) {
      setLimit_(limit);
    }
  }, [data, limit, options, externalPagination, startIndex, endIndex]);

  // Build classNames with multiple variants
  const adaptableClass = [
    "adaptable",
    ...variantTokens.map(v => `adaptable-${v}`),
    hasMini ? "adaptable-mini" : ""
  ].filter(Boolean).join(" ");

  return (
    <>
      <style jsx>{styles}</style>
      <div id="adaptable" style={style} className={adaptableClass}>
        {!hideHeader && (
          <AdapTableHeader
            data={visibleData}
            filters={filters}
            filterBy={filterBy}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            loading={loading}
            tableHeaderTraits={options}
          />
        )}

        <AdapTableContent
          renderCell={options?.renderCell}
          hideHeader={hideHeader}
          data={data}
          setSort={(key, isAscend) => sortByKey(key, isAscend)}
          loading={loading}
          onRowClick={onRowClick}
          search={search}
          startIndex={startIndex}
          variant={variant}
          onSelect={onSelect}
          options={options}
          onDrag={onDrag}
        />

        {setPage && page && setLimit && totalPages && (
          <AdapTableFooter
            handlePageChange={handlePageChange}
            page={page}
            limit={effectiveLimit}
            setPage={setPage}
            setLimit={setLimit}
            startIndex={startIndex}
            endIndex={endIndex}
            totalPages={totalPages}
            total={total ? total : visibleData.length}
          />
        )}
      </div>
    </>
  );
};

export default AdapTable;
