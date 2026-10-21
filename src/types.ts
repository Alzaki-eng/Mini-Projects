export interface PatientVitals {
  heartRate: number; // bpm (60-100)
  bloodPressureSys: number; // mmHg (90-120)
  bloodPressureDia: number; // mmHg (60-80)
  oxygenSaturation: number; // % (95-100)
  bodyTemperature: number; // Fahrenheit (97.8 - 99.1)
  respiratoryRate: number; // breaths/min (12-20)
  painScore: number; // 0 - 10
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  surgeryType: string;
  hoursPostOp: number;
  medicalHistory: string;
  vitals: PatientVitals;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface OrganSystemRisk {
  name: string;
  system?: 'Cardiovascular' | 'Pulmonary' | 'Infectious / Sepsis' | 'Metabolic & Tissue' | string;
  score: number; // 0 - 100
  status: 'STABLE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  keyFinding: string;
  contributingParameters?: string[];
  parametersEvaluated?: string[];
}

export interface FeatureAttribution {
  feature: string;
  impact: number;
  direction: 'risk_increasing' | 'protective';
  description: string;
}

export interface TrajectoryPoint {
  hourOffset: number;
  label: string;
  withoutInterventionScore: number;
  withInterventionScore: number;
}

export interface SbarReport {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface ClinicalProtocolOrder {
  id: string;
  category: 'STAT Lab' | 'Therapeutic' | 'Monitoring' | 'Consultation';
  order: string;
  rationale: string;
  urgency: 'IMMEDIATE' | 'WITHIN_1_HR' | 'ROUTINE';
}

export interface PredictionResult {
  patientId: string;
  timestamp: string;
  riskLevel: RiskLevel;
  riskScore: number;
  primaryComplications: string[];
  clinicalSummary: string;
  flags: string[];
  recommendedActions: string[];
  modelUsed: string;
  organSystems?: OrganSystemRisk[];
  featureAttributions?: FeatureAttribution[];
  trajectory?: TrajectoryPoint[];
  sbarReport?: SbarReport;
  protocolOrders?: ClinicalProtocolOrder[];
  confidenceScore?: number;
}
