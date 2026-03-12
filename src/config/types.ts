export interface PipelineConfig {
  name: string;
  github: { owner: string; repo: string };
  fields: Field[];
  stages: Stage[];
  owners?: string[];
  calculations: Calculation[];
  reports: Report[];
  staleness?: { days: number; action: 'label' | 'comment'; message: string };
}

export interface Field {
  name: string;
  type: 'string' | 'number' | 'date' | 'enum';
  required: boolean;
  options?: string[];
}

export interface Stage {
  name: string;       // e.g. "Qualified"
  label: string;      // e.g. "stage:qualified"
  probability?: number; // for weighted calculations
}

export interface Calculation {
  name: string;       // e.g. "weighted_pipeline"
  description: string;
  formula: string;    // e.g. "value * probability"
  aggregate: 'sum' | 'average' | 'count' | 'percent';
}

export interface Report {
  name: string;
  calculations: string[]; // calculation names to include
  filters?: { stage?: string; owner?: string };
}
