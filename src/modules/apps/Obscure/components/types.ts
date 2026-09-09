export type StatusTile = {
  label: string;
  status: string;
  meta?: string;
  busy?: boolean;
};

export type SourceRow = {
  source: string;
  kind: string;
  input: string;
  visible: boolean;
  locked: boolean;
  order: number | string;
  sceneItemId: number;
  sourceUuid?: string;
};
