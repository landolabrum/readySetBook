export type MediaSegment = {
  url:          string;
  title?:       string;
  kind?:        'video' | 'iframe' | 'image' | string;
  duration?:    number;   // seconds this segment plays before advancing
  preload?:     number;   // seconds before switch to start preloading next
  width?:       number;   // px
  height?:      number;   // px
  aspectPreset?: string;
  poster?:      string;
  autoplay?:    boolean;
  loop?:        boolean;
  muted?:       boolean;
  playing?:     boolean;
  volume?:      number;   // 0–1
};
