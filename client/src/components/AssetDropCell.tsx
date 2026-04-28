/**
 * AssetDropCell
 * A table cell that accepts drag-and-drop or click-to-browse for image/video assets.
 * Stores the file in browser memory and shows a thumbnail preview.
 * On publish, the parent will upload the file to Meta and get back an image_hash or video_id.
 */

import { useCallback, useRef, useState } from 'react';
import { Upload, X, Film, ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AssetFile {
  file: File;
  previewUrl: string;       // object URL for preview
  type: 'image' | 'video';
  name: string;
  size: number;             // bytes
  duration?: number;        // seconds, for video
}

interface Props {
  value: AssetFile | null;
  /** Also accepts a plain URL/hash string (typed manually) */
  textValue?: string;
  onFileChange: (asset: AssetFile | null) => void;
  onTextChange?: (val: string) => void;
  placeholder?: string;
  accept?: string;
  className?: string;
  disabled?: boolean;
}

const MAX_IMAGE_MB = 30;
const MAX_VIDEO_MB = 4096;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetDropCell({
  value,
  textValue = '',
  onFileChange,
  onTextChange,
  placeholder = 'Drop file or paste URL / hash',
  accept = 'image/*,video/*',
  className,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        setError('Only image and video files are supported.');
        return;
      }

      const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > maxMB * 1024 * 1024) {
        setError(`File too large (max ${maxMB} MB).`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);

      if (isVideo) {
        // Get video duration
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.src = previewUrl;
        vid.onloadedmetadata = () => {
          onFileChange({
            file,
            previewUrl,
            type: 'video',
            name: file.name,
            size: file.size,
            duration: Math.round(vid.duration),
          });
        };
      } else {
        onFileChange({
          file,
          previewUrl,
          type: 'image',
          name: file.name,
          size: file.size,
        });
      }
    },
    [onFileChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, processFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    setError(null);
  };

  // If a file is loaded, show preview
  if (value) {
    return (
      <div
        className={cn(
          'relative flex items-center gap-2 rounded px-2 py-1 bg-white/5 border border-white/10 group min-w-[140px]',
          className
        )}
      >
        {value.type === 'image' ? (
          <img
            src={value.previewUrl}
            alt={value.name}
            className="h-8 w-8 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded bg-indigo-900/60 flex items-center justify-center flex-shrink-0">
            <Film className="w-4 h-4 text-indigo-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-foreground truncate leading-tight">{value.name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {formatBytes(value.size)}
            {value.type === 'video' && value.duration !== undefined && ` · ${value.duration}s`}
          </p>
        </div>
        {!disabled && (
          <button
            onClick={clear}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {/* Video processing notice */}
        {value.type === 'video' && (
          <div className="absolute -top-5 left-0 hidden group-hover:flex items-center gap-1 bg-amber-900/90 text-amber-200 text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10">
            <AlertCircle className="w-3 h-3" />
            Video uploads require processing time after publish
          </div>
        )}
      </div>
    );
  }

  // No file — show drop zone / text input
  return (
    <div className={cn('flex flex-col gap-1 min-w-[140px]', className)}>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1.5 border border-dashed transition-colors cursor-pointer text-[11px]',
          isDragOver
            ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300'
            : 'border-white/15 hover:border-white/30 text-muted-foreground hover:text-foreground',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <Upload className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">Drop or browse</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {/* Text fallback for URL / hash */}
      {onTextChange && (
        <input
          type="text"
          value={textValue}
          onChange={e => onTextChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="cell-input text-[11px] px-2 py-1"
        />
      )}
      {error && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
