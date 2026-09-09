export type CardBindingSource = 'static' | 'event_info' | 'event_team' | 'gps' | 'computed';

export type CardBindingMode = 'record' | 'aggregate';

export type CardBindingSelectorType = 'leader' | 'vehicle_number' | 'team_id' | 'first_available';

export type CardBindingSelector = {
  type?: CardBindingSelectorType;
  value?: string;
};

export type CardBinding = {
  source?:   CardBindingSource;
  mode?:     CardBindingMode;
  key?:      string;
  selector?: CardBindingSelector;
  fallback?: string;
  prefix?:   string;
  suffix?:   string;
  decimals?: number;
};

export type CardBindingRosterRow = {
  id?:             string | number | null;
  team_name?:      string | null;
  vehicle_number?: string | number | null;
};

export type CardOverlayItem = {
  id:           string;
  title?:       string;
  value?:       string;
  subtitle?:    string;
  description?: string;
  imageUrl?:    string;
  background?:  string;
  textColor?:   string;
  accent?:      string;
  colSpan?:     number;
  rowSpan?:     number;
  binding?:     CardBinding;
};
