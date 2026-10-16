export interface PatientVitals {
  heartRate: number; // bpm
  bloodPressureSys: number; // mmHg
  bloodPressureDia: number; // mmHg
  oxygenSaturation: number; // %
  bodyTemperature: number; // Fahrenheit
  respiratoryRate: number; // breaths/min
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
}
