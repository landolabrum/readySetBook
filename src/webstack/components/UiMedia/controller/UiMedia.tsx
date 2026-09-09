import { useEffect, useRef, useState } from 'react';
import styles from './UiMedia.scss';
import ImageControl, { IImageMediaType, IImageVariant } from '../ImageControl/ImageControl';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import useWindow from '@webstack/hooks/window/useWindow';

export interface IMedia {
  src: string;
  alt?: string;
  variant?: IImageVariant;
  onLoad?: (e: any) => void;
  onClick?: (e: any) => void;
  type?: IImageMediaType;
  loadingText?: string;
  rotate?: number;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string | React.ReactNode;
  preload?: 'auto' | 'metadata' | 'none';
  width?: number;
  height?: number;
  playbackSpeed?: number;
  children?: any;
  style?: any;
  headers?: Record<string, string>; // <-- added
  resetOnSrcChange?: boolean;
}

const UiMedia: React.FC<IMedia> = ({
  src,
  variant,
  type = 'image',
  alt,
  style,
  loadingText,
  rotate,
  onLoad,
  autoplay,
  controls,
  loop,
  muted,
  poster,
  preload = 'auto',
  width,
  height,
  playbackSpeed = 1,
  children,
  headers,
  onClick,
  resetOnSrcChange = false,
}) => {
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isBackground = variant === 'background';
  const [isPlaying, setIsPlaying] = useState(!!autoplay || isBackground);
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);

  // HLS if the URL path ends in .m3u8 — query strings included
  // (`/stream/hls.m3u8?id=cam` must match, `endsWith` alone misses it).
  const isHlsSrc = type === 'video' && /\.m3u8(\?|$)/.test(src);

  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLIFrameElement | null>(null);
  const window = useWindow();
  const blobUrlRef = useRef<string | null>(null);
  const handleClick = (e: any) => {
    onClick?.(e)
  }
  const handleReload = () => {
    setHasError(false);
    setIsLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    if (!resetOnSrcChange) return;
    setHasError(false);
    setIsLoading(true);
    setReloadTrigger((prev) => prev + 1);
  }, [resetOnSrcChange, src]);



  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.(e);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const togglePlay = () => {
    if (isBackground) return; // background media should not be manually toggled
    if (type === 'video' && mediaRef.current) {
      const videoEl = mediaRef.current as HTMLVideoElement;
      if (videoEl.paused) {
        videoEl.play().catch((err) => {
          console.warn('UiMedia play failed:', err);
          setHasError(true);
        });
        setIsPlaying(true);
      } else {
        videoEl.pause();
        setIsPlaying(false);
      }
    }
  };

  // Handle fetching image when headers are provided
  useEffect(() => {
    if (type !== 'image') return;
    let aborted = false;
    const controller = new AbortController();

    const loadWithHeaders = async () => {
      if (!headers) {
        setResolvedSrc(src);
        return;
      }
      try {
        setIsLoading(true);
        setHasError(false);
        // cleanup previous blob
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        const resp = await fetch(src, {
          method: 'GET',
          headers: { ...headers },
          signal: controller.signal,
        });
        if (!resp.ok) {
          throw new Error(`Status ${resp.status}`);
        }
        const blob = await resp.blob();
        if (aborted) return;
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setResolvedSrc(objectUrl);
        setIsLoading(false);
      } catch (err) {
        if (aborted) return;
        console.warn('UiMedia image fetch failed:', err);
        setHasError(true);
        setIsLoading(false);
      }
    };

    loadWithHeaders();

    return () => {
      aborted = true;
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [headers, reloadTrigger, type, src]);

  // HLS playback: Safari plays m3u8 natively; everywhere else attach hls.js.
  // The <video> must NOT also carry the m3u8 as its src attribute — React
  // re-applying it clobbers hls.js's MediaSource and the element ends up
  // with "no supported sources".
  useEffect(() => {
    if (!isHlsSrc || !mediaRef.current) return;

    const video = mediaRef.current as HTMLVideoElement;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let hls: any = null;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls({ liveDurationInfinity: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay || isBackground) {
          video.play().catch(() => undefined);
        }
      });
      hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setHasError(true);
      });
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src, isHlsSrc, reloadTrigger]);


  useEffect(() => {
    if (mediaRef.current) {
      if (rotate) {
        mediaRef.current.style.transform = `rotate(${rotate}deg)`;
      } else {
        mediaRef.current.style.transform = '';
      }
      if (height) {
        mediaRef.current.style.height = `${height}px`;
      }
      if (variant) {
        mediaRef.current.classList.add(`ui-media--${variant}`);
        if (variant === 'background') {
          const shadowHeight = window.height - mediaRef.current.offsetHeight;
          if (shadowHeight > 0) {
            mediaRef.current.style.boxShadow = `0 0 ${shadowHeight}px ${shadowHeight * 0.5}px var(--gray-80-o)`;
          }
        }
      }
    }
  }, [rotate, height, variant, window.height, resolvedSrc, reloadTrigger]);

  useEffect(() => {
    if (type === 'iframe' && mediaRef.current) {
      const iframe = mediaRef.current as HTMLIFrameElement;
      iframe.style.visibility = isLoading ? 'hidden' : 'visible';
    }
  }, [isLoading, type]);
  const wrapText = (text: string, maxWidth: number, fontSize: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length * (fontSize * 0.6) < maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const stringPoster = typeof poster === 'string' ? poster : '';
  const containerWidth = mediaRef.current?.parentElement?.offsetWidth || 1000;
  const fontSize = Math.max(24, Math.min(72, containerWidth / 20));
  const lines = wrapText(alt || 'Product', containerWidth * 0.9, fontSize);
  const totalHeight = lines.length * fontSize * 1.2;
  const startY = (500 - totalHeight) / 2 + fontSize;
  return (
    <>
      <style jsx>{styles}</style>
      <ImageControl
        onClick={handleClick}
        variant={variant}
        isPlaying={isPlaying}
        mediaType={type}
        onComplete={() => setIsLoading(false)}
        onPlayPauseClick={togglePlay}
        showPlayPause={type === 'video' && !isBackground}
      >
        {isLoading && !hasError && <div className="loading">{loadingText || 'Loading...'}</div>}

        {hasError && <div
          className="ui-media__error"
        // style={{ color: '#f90', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}
        >
          <span>{loadingText ? `${loadingText}, Failed` : 'Loading failed'}</span>
          <UiIcon icon="fa-arrows-rotate" onClick={handleReload} />
        </div>}

        {!hasError && type === 'video' && (
          <video
            ref={mediaRef as React.Ref<HTMLVideoElement>}
            src={isHlsSrc ? undefined : src}
            autoPlay={isBackground ? true : autoplay}
            controls={isBackground ? false : controls ?? false}
            loop={isBackground ? true : loop}
            muted={isBackground ? true : muted}
            poster={stringPoster}
            preload={preload}
            width={width}
            height={height}
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}
            onCanPlayThrough={() => setIsLoading(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              // setIsLoading(false);
              // setHasError(true);
            }}
            key={reloadTrigger}
            className="ui-media"
          />
        )}

        {!hasError && type === 'iframe' && (
          <div
            className={`ui-media__iframe-wrapper ${variant === 'background' ? 'ui-media__iframe-wrapper--background' : ''
              }`}
          >
            <iframe
              ref={mediaRef as React.Ref<HTMLIFrameElement>}
              src={src}
              width={width || '100%'}
              height={height || 360}
              title={alt || 'iframe'}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              key={reloadTrigger}
              className="ui-media__iframe"
              style={style || { border: 'none', visibility: isLoading ? 'hidden' : 'visible' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {isLoading && <div className="loading">{loadingText || 'Loading iframe...'}</div>}
          </div>
        )}

        {!hasError && type === 'image' && (
          variant === 'knockout' ? (
            <svg
              className="ui-media ui-media--knockout"
              viewBox="0 0 1000 500"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <mask id={`mask-${resolvedSrc}`} x="0" y="0" width="100%" height="100%">
                  <rect className="rect" width="100%" height="100%" />
                  {lines.map((line, i) => (
                    <text
                      key={i}
                      x="50%"
                      y={startY + i * fontSize * 1.2}
                      fontSize={fontSize}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {line}
                    </text>
                  ))}
                </mask>
              </defs>
              <image
                href={resolvedSrc}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid slice"
              />
              <rect width="100%" height="100%" mask={`url(#mask-${resolvedSrc})`} />
            </svg>
          ) : (
            <img
              ref={mediaRef as React.Ref<HTMLImageElement>}
              src={resolvedSrc}
              alt={alt}
              onLoad={handleImageLoad}
              onError={handleImageError}
              key={reloadTrigger}
              width={width}
              height={height}
              className="ui-media"
            // style={style}
            />
          )
        )}

        {children && (
          <div className={`ui-media__children ${variant ? `ui-media__children--${variant}` : ''}`}>
            {children}
          </div>
        )}
      </ImageControl>
    </>
  );
};

export default UiMedia;
