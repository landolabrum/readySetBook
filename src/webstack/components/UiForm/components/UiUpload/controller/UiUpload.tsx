import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './UiUpload.scss';
import UiButton from '../../UiButton/UiButton';
import UiInput from '../../UiInput/controller/UiInput';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import ProductImage from '~/src/modules/ecommerce/Products/views/ProductDescription/views/ProductImage/ProductImage';
import UiMultiSelect from '../../UiMultiSelect/controller/UiMultiSelect';

type UploadRow = {
  id: string;           // stable id for deletes
  url: string;          // object URL or preloaded URL
  name: string;
  size: string;
  extension: string;
  dimensions?: string;
  kind: 'file' | 'url';
};

interface UiUploadProps {
  title: string;
  onFileUpload: (file: File, previewUrl?: string) => void;
  onFileRemove?: (idOrIndex: number | string) => void;
  onReorder?: (from: number, to: number) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  value?: Array<{ src: string; alt?: string; name?: string; type?: string }>;
  onUrlsChange?: (urls: string[]) => void;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const UiUpload: React.FC<UiUploadProps> = ({
  title,
  onFileUpload,
  accept = '*/*',
  multiple = false,
  maxFiles = 5,
  onFileRemove,
  value = [],
  label,
  onReorder,
  onUrlsChange,
}) => {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [urlItems, setUrlItems] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  // For duplicate detection in-session
  const pickedKeysRef = useRef<Set<string>>(new Set());
  const makeKey = (f: File) => `${f.name}__${f.size}`;

  const emitUrls = (next: string[]) => {
    setUrlItems(next);
    onUrlsChange?.(next);
  };

  const mergeRows = useMemo(() => {
    return (files: UploadRow[], urls: string[]): UploadRow[] => {
      const urlRows = urls.map((u) => ({
        id: `${u}-${uid()}`,
        url: u,
        name: u.split('/').pop() || 'URL',
        size: 'URL',
        extension: 'url',
        kind: 'url' as const,
      }));
      return [...files, ...urlRows];
    };
  }, []);

  // Hydrate from preloaded `value` once
  useEffect(() => {
    if (hydrated.current || !value?.length) return;
    const seen = new Set<string>();
    const initial: UploadRow[] = [];
    const initialUrls: string[] = [];
    for (const v of value) {
      if (!v?.src || seen.has(v.src)) continue;
      seen.add(v.src);
      const asUrl = (typeof v.type === 'string' && v.type.toLowerCase() === 'url') || /^https?:\/\//i.test(v.src);
      if (asUrl) {
        initialUrls.push(v.src);
        continue;
      }
      initial.push({
        id: uid(),
        url: v.src,
        name: v.name?.split('/').pop() ?? 'File',
        size: 'N/A',
        extension: v.type || 'image',
        kind: 'file',
      });
    }
    setRows(initial);
    if (initialUrls.length) emitUrls(initialUrls);
    hydrated.current = true;
  }, [value]);

  const openFileDialog = () => fileInputRef.current?.click();

  // Remove by index so parent can sync its own array
  const handleRemoveByIndex = (index: number) => {
    const combined = mergeRows(rows, urlItems);
    const row = combined[index];
    if (!row) return;
    if (row.kind === 'file') {
      setRows(prev => prev.filter((_, i) => i !== index));
      onFileRemove?.(index);
    } else {
      const urlIdx = index - rows.length;
      if (urlIdx >= 0) {
        const next = urlItems.filter((_, i) => i !== urlIdx);
        emitUrls(next);
      }
    }
  };

  const remainingSlots = (currentLen: number) => Math.max(0, maxFiles - currentLen);

  const ingestFiles = (filesList: FileList) => {
    const curLen = rows.length;
    const remaining = remainingSlots(curLen);
    if (remaining <= 0) {
      alert(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    const incoming = Array.from(filesList);
    const toUse = multiple ? incoming.slice(0, remaining) : incoming.slice(0, 1);

    toUse.forEach((file) => {
      const dupKey = makeKey(file);
      if (pickedKeysRef.current.has(dupKey)) return;
      pickedKeysRef.current.add(dupKey);

      const objectUrl = URL.createObjectURL(file);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      const size = `${(file.size / 1024).toFixed(1)} KB`;
      const id = uid();

      // Optimistically add a row; dimensions update when image loads
      setRows(prev => [...prev, { id, url: objectUrl, name: file.name, size, extension, kind: 'file' }]);

      // Only probe dimensions for image-like files
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          setRows(prev =>
            prev.map(r => (r.id === id ? { ...r, dimensions: `${img.width}×${img.height}px` } : r))
          );
        };
        img.src = objectUrl;
      }

      onFileUpload(file, objectUrl);
    });

    // reset input so same file name can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    ingestFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    ingestFiles(e.dataTransfer.files);
  };

  const combinedRows = useMemo(() => mergeRows(rows, urlItems), [rows, urlItems, mergeRows]);

  // Build table rows for AdapTable at render-time so delete handlers are always fresh
  const tableData = combinedRows.map((r, index) => ({
    src: <ProductImage image={r.url} options={{ alt: r.name, variant: 'upload' }} />,
    name: r.name,
    size: r.size,
    extension: r.extension,
    dimensions: r.dimensions ?? '',
    delete: (<>
      <style jsx>{styles}</style>
      <div className='ui-upload__delete' onKeyDown={(e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRemoveByIndex(index);
        }
      }}>
        <UiIcon
          color="red"
          icon="fa-trash-can"
          onClick={() => handleRemoveByIndex(index)}
        />

      </div>
    </>
    ),
  }));

  const placeholder =
    combinedRows.length > 0
      ? `Add another file (${rows.length}/${maxFiles}) or paste URLs`
      : 'Upload file or paste URLs';

  const handleReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const combined = mergeRows(rows, urlItems);
    const maxIdx = combined.length - 1;
    if (from > maxIdx || to > maxIdx) return;

    // If both indices are in file rows
    if (from < rows.length && to < rows.length) {
      setRows(prev => {
        if (!prev.length || from >= prev.length || to >= prev.length) return prev;
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      onReorder?.(from, to);
      return;
    }

    // If both are URLs, reorder urlItems
    if (from >= rows.length && to >= rows.length) {
      const urlFrom = from - rows.length;
      const urlTo = to - rows.length;
      const prev = urlItems;
      if (!prev.length || urlFrom >= prev.length || urlTo >= prev.length) return;
      const next = prev.slice();
      const [moved] = next.splice(urlFrom, 1);
      next.splice(urlTo, 0, moved);
      emitUrls(next);
    }
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div
        className="ui-upload d-flex"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        aria-label={`${title} - drag & drop files here or use the button to browse`}
      >
        {combinedRows.length > 0 && (
          <AdapTable
            data={tableData}
            variant="mini"
            options={{ hide: ['footer', 'header'], hideColumns: [], title: 'Files' }}
            filters={[]}
            onDrag={({ from, to }) => handleReorder(from, to)}
          />
        )}
        <div className="ui-upload--actions">
          {/* hidden native input */}
          <UiInput
            innerRef={fileInputRef}
            type="file"
            accept={accept}
            variant="inherit"
            placeholder={placeholder}
            multiple={multiple}
            onChange={handleFileChange}
            aria-hidden="true"
          />

          {/* Clickable drop zone */}
          <label>
            {label}
          </label>
          <div
            className="fake"
            role="button"
            tabIndex={0}
            onClick={openFileDialog}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFileDialog();
              }
            }}
            title="Click to browse files or drag & drop here"
          >
            <div>{placeholder}</div>
            <UiIcon icon="fas-plus" />
          </div>

          <div className="ui-upload__urls">
            <label>File URLs</label>
            <UiMultiSelect
              name="image_urls"
              value={urlItems}
              placeholder="Paste file URLs, press Enter"
              onChange={(e) => emitUrls(Array.isArray(e?.target?.value) ? e.target.value : [])}
              allowDuplicates={false}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default UiUpload;
