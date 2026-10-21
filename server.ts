import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

import { PRELOADED_100_PATIENTS } from './src/data/patientsData.ts';

// Check if a real Gemini API key is configured
const hasValidGeminiKey = Boolean(
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
  process.env.GEMINI_API_KEY.trim() !== ''
);

// Initialize Gemini Client safely only if a valid key is provided
const ai = hasValidGeminiKey
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

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

export interface OrganSystemRisk {
  name: string;
  system: 'Cardiovascular' | 'Pulmonary' | 'Infectious / Sepsis' | 'Metabolic & Tissue';
  score: number;
  status: 'STABLE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  keyFinding: string;
  contributingParameters: string[];
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

// 100 Preloaded patients database
const DEFAULT_PATIENTS: Patient[] = PRELOADED_100_PATIENTS;

let patientsDatabase: Patient[] = JSON.parse(JSON.stringify(DEFAULT_PATIENTS));

// Multi-layered heuristic calculation for clinical verification & fallback
function calculateHeuristicRisk(
  vitals: PatientVitals,
  hoursPostOp: number,
  age: number,
  patientName: string = 'Patient',
  surgeryType: string = 'Procedure'
) {
  let score = 0;
  const flags: string[] = [];
  const suspectedComplications: string[] = [];
  const attributions: FeatureAttribution[] = [];

  // 1. Cardiovascular Analysis
  let cvScore = 10;
  const cvParams: string[] = [];
  if (vitals.heartRate > 120) {
    score += 30;
    cvScore += 45;
    flags.push(`Severe Tachycardia (${vitals.heartRate} bpm)`);
    cvParams.push(`Heart Rate: ${vitals.heartRate} bpm`);
    attributions.push({
      feature: 'Tachycardia',
      impact: 28,
      direction: 'risk_increasing',
      description: `Elevated heart rate (${vitals.heartRate} bpm) reflects sympathetic overdrive or compensatory response`,
    });
  } else if (vitals.heartRate > 100) {
    score += 18;
    cvScore += 25;
    flags.push(`Moderate Tachycardia (${vitals.heartRate} bpm)`);
    cvParams.push(`Heart Rate: ${vitals.heartRate} bpm`);
    attributions.push({
      feature: 'Mild Tachycardia',
      impact: 16,
      direction: 'risk_increasing',
      description: `Borderline tachycardia (${vitals.heartRate} bpm) suggests early physiological distress`,
    });
  } else if (vitals.heartRate < 50) {
    score += 25;
    cvScore += 35;
    flags.push(`Bradycardia (${vitals.heartRate} bpm)`);
    cvParams.push(`Heart Rate: ${vitals.heartRate} bpm`);
    attributions.push({
      feature: 'Bradycardia',
      impact: 22,
      direction: 'risk_increasing',
      description: `Low heart rate (${vitals.heartRate} bpm) may indicate conduction block or medication effect`,
    });
  } else {
    attributions.push({
      feature: 'Heart Rate Normal',
      impact: -8,
      direction: 'protective',
      description: `Eucardic heart rate (${vitals.heartRate} bpm) maintains adequate stroke volume`,
    });
  }

  // Blood Pressure Systolic & Diastolic
  if (vitals.bloodPressureSys < 90) {
    score += 35;
    cvScore += 45;
    flags.push(`Severe Hypotension (${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg)`);
    suspectedComplications.push('Internal Hemorrhage / Hypovolemic Shock');
    cvParams.push(`BP: ${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg`);
    attributions.push({
      feature: 'Hypotension',
      impact: 32,
      direction: 'risk_increasing',
      description: `Systolic pressure < 90 mmHg strongly suggests hypoperfusion or active post-op bleeding`,
    });
  } else if (vitals.bloodPressureSys > 160) {
    score += 20;
    cvScore += 30;
    flags.push(`Significant Hypertension (${vitals.bloodPressureSys} mmHg)`);
    suspectedComplications.push('Cardiovascular Stress / Hypertensive Crisis');
    cvParams.push(`BP: ${vitals.bloodPressureSys} mmHg`);
    attributions.push({
      feature: 'Hypertension',
      impact: 18,
      direction: 'risk_increasing',
      description: `High systolic pressure (${vitals.bloodPressureSys} mmHg) increases surgical suture tension`,
    });
  } else {
    attributions.push({
      feature: 'Blood Pressure Controlled',
      impact: -10,
      direction: 'protective',
      description: `Normotensive arterial pressure (${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg)`,
    });
  }

  // 2. Pulmonary Analysis
  let pulmonaryScore = 10;
  const pulmonaryParams: string[] = [];
  if (vitals.oxygenSaturation < 90) {
    score += 35;
    pulmonaryScore += 50;
    flags.push(`Critical Hypoxemia (SpO2 ${vitals.oxygenSaturation}%)`);
    suspectedComplications.push('Respiratory Depression / Atelectasis / Hypoxia');
    pulmonaryParams.push(`SpO2: ${vitals.oxygenSaturation}%`);
    attributions.push({
      feature: 'Hypoxemia',
      impact: 30,
      direction: 'risk_increasing',
      description: `SpO2 < 90% signals impaired alveolar ventilation or post-op atelectasis`,
    });
  } else if (vitals.oxygenSaturation < 94) {
    score += 15;
    pulmonaryScore += 25;
    flags.push(`Mild Hypoxia (SpO2 ${vitals.oxygenSaturation}%)`);
    pulmonaryParams.push(`SpO2: ${vitals.oxygenSaturation}%`);
  } else {
    attributions.push({
      feature: 'Normal Oxygen Saturation',
      impact: -12,
      direction: 'protective',
      description: `Optimal oxygen saturation (SpO2 ${vitals.oxygenSaturation}%)`,
    });
  }

  if (vitals.respiratoryRate > 24) {
    score += 25;
    pulmonaryScore += 30;
    flags.push(`Tachypnea (${vitals.respiratoryRate} breaths/min)`);
    pulmonaryParams.push(`Respiration: ${vitals.respiratoryRate}/min`);
    attributions.push({
      feature: 'Tachypnea',
      impact: 20,
      direction: 'risk_increasing',
      description: `Rapid breathing (${vitals.respiratoryRate}/min) indicates work of breathing or metabolic acidosis`,
    });
  } else if (vitals.respiratoryRate < 10) {
    score += 30;
    pulmonaryScore += 45;
    flags.push(`Severe Bradypnea (${vitals.respiratoryRate} breaths/min)`);
    suspectedComplications.push('Opioid-Induced Respiratory Depression');
    pulmonaryParams.push(`Respiration: ${vitals.respiratoryRate}/min`);
    attributions.push({
      feature: 'Bradypnea',
      impact: 28,
      direction: 'risk_increasing',
      description: `Depressed respiratory rate (${vitals.respiratoryRate}/min) poses hypercapnia risk`,
    });
  }

  // 3. Infectious / SIRS Analysis
  let sepsisScore = 8;
  const sepsisParams: string[] = [];
  if (vitals.bodyTemperature >= 101.5) {
    score += 30;
    sepsisScore += 45;
    flags.push(`High Fever (${vitals.bodyTemperature}°F)`);
    suspectedComplications.push('Surgical Site Infection / Early Sepsis');
    sepsisParams.push(`Temp: ${vitals.bodyTemperature}°F`);
    attributions.push({
      feature: 'Fever',
      impact: 26,
      direction: 'risk_increasing',
      description: `Elevated temperature (${vitals.bodyTemperature}°F) points to acute systemic inflammatory response`,
    });
  } else if (vitals.bodyTemperature >= 100.4) {
    score += 15;
    sepsisScore += 20;
    flags.push(`Low-Grade Fever (${vitals.bodyTemperature}°F)`);
    sepsisParams.push(`Temp: ${vitals.bodyTemperature}°F`);
  } else if (vitals.bodyTemperature < 96.5) {
    score += 25;
    sepsisScore += 35;
    flags.push(`Hypothermia (${vitals.bodyTemperature}°F)`);
    suspectedComplications.push('Septic Shock / Thermal Dysregulation');
    sepsisParams.push(`Temp: ${vitals.bodyTemperature}°F`);
  }

  // 4. Metabolic & Perfusion Analysis (using Shock Index & Pain)
  let metabolicScore = 10;
  const metabolicParams: string[] = [];
  const shockIndex = vitals.heartRate / Math.max(1, vitals.bloodPressureSys);
  if (shockIndex > 1.2) {
    score += 30;
    metabolicScore += 45;
    flags.push(`Critical Shock Index (${shockIndex.toFixed(2)})`);
    suspectedComplications.push('Hemodynamic Decompensation / Acute Shock');
    metabolicParams.push(`Shock Index: ${shockIndex.toFixed(2)}`);
    attributions.push({
      feature: 'Elevated Shock Index',
      impact: 26,
      direction: 'risk_increasing',
      description: `Shock index > 1.0 confirms occult tissue hypoperfusion`,
    });
  } else if (shockIndex > 0.9) {
    score += 15;
    metabolicScore += 20;
    metabolicParams.push(`Shock Index: ${shockIndex.toFixed(2)}`);
  }

  if (vitals.painScore >= 8) {
    score += 10;
    metabolicScore += 15;
    flags.push(`Severe Pain (${vitals.painScore}/10)`);
    metabolicParams.push(`Pain: ${vitals.painScore}/10`);
    attributions.push({
      feature: 'Uncontrolled Post-Op Pain',
      impact: 12,
      direction: 'risk_increasing',
      description: `Severe pain (${vitals.painScore}/10) exacerbates hemodynamic instability`,
    });
  }

  if (age > 65) {
    score += 8;
    attributions.push({
      feature: 'Age > 65',
      impact: 8,
      direction: 'risk_increasing',
      description: 'Geriatric baseline reduces cardiovascular compliance under anesthetic stress',
    });
  }

  const finalRiskPercentage = Math.min(99, Math.max(6, score));

  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (finalRiskPercentage >= 70 || vitals.bloodPressureSys < 85 || vitals.oxygenSaturation < 90) {
    riskLevel = 'CRITICAL';
  } else if (finalRiskPercentage >= 45) {
    riskLevel = 'HIGH';
  } else if (finalRiskPercentage >= 25) {
    riskLevel = 'MODERATE';
  }

  if (suspectedComplications.length === 0) {
    if (riskLevel === 'LOW') {
      suspectedComplications.push('Normal Post-Surgical Recovery');
    } else {
      suspectedComplications.push('Non-specific Post-Operative Stress');
    }
  }

  // Organ systems risk array
  const organSystems: OrganSystemRisk[] = [
    {
      name: 'Cardiovascular & Hemodynamics',
      system: 'Cardiovascular',
      score: Math.min(98, Math.max(8, cvScore)),
      status: cvScore >= 70 ? 'CRITICAL' : cvScore >= 45 ? 'HIGH' : cvScore >= 25 ? 'ELEVATED' : 'STABLE',
      keyFinding: cvParams.length > 0 ? cvParams.join(', ') : 'Normal heart rate and stable arterial pressure',
      contributingParameters: cvParams,
    },
    {
      name: 'Pulmonary & Gas Exchange',
      system: 'Pulmonary',
      score: Math.min(98, Math.max(8, pulmonaryScore)),
      status: pulmonaryScore >= 70 ? 'CRITICAL' : pulmonaryScore >= 45 ? 'HIGH' : pulmonaryScore >= 25 ? 'ELEVATED' : 'STABLE',
      keyFinding: pulmonaryParams.length > 0 ? pulmonaryParams.join(', ') : 'Adequate room air / oxygenated saturation',
      contributingParameters: pulmonaryParams,
    },
    {
      name: 'Systemic Inflammatory & Sepsis',
      system: 'Infectious / Sepsis',
      score: Math.min(98, Math.max(6, sepsisScore)),
      status: sepsisScore >= 70 ? 'CRITICAL' : sepsisScore >= 45 ? 'HIGH' : sepsisScore >= 25 ? 'ELEVATED' : 'STABLE',
      keyFinding: sepsisParams.length > 0 ? sepsisParams.join(', ') : 'Normothermic, no inflammatory markers',
      contributingParameters: sepsisParams,
    },
    {
      name: 'Metabolic & Tissue Perfusion',
      system: 'Metabolic & Tissue',
      score: Math.min(98, Math.max(8, metabolicScore)),
      status: metabolicScore >= 70 ? 'CRITICAL' : metabolicScore >= 45 ? 'HIGH' : metabolicScore >= 25 ? 'ELEVATED' : 'STABLE',
      keyFinding: metabolicParams.length > 0 ? metabolicParams.join(', ') : 'Adequate peripheral perfusion and controlled pain',
      contributingParameters: metabolicParams,
    },
  ];

  // 6-Hour Trajectory Projection
  const trajectory: TrajectoryPoint[] = [
    {
      hourOffset: 0,
      label: 'Now (H+0)',
      withoutInterventionScore: finalRiskPercentage,
      withInterventionScore: finalRiskPercentage,
    },
    {
      hourOffset: 1,
      label: '+1 Hour',
      withoutInterventionScore: Math.min(
        99,
        Math.round(finalRiskPercentage * (riskLevel === 'CRITICAL' ? 1.15 : riskLevel === 'HIGH' ? 1.1 : 1.02))
      ),
      withInterventionScore: Math.max(10, Math.round(finalRiskPercentage * 0.78)),
    },
    {
      hourOffset: 2,
      label: '+2 Hours',
      withoutInterventionScore: Math.min(
        99,
        Math.round(finalRiskPercentage * (riskLevel === 'CRITICAL' ? 1.25 : riskLevel === 'HIGH' ? 1.18 : 1.05))
      ),
      withInterventionScore: Math.max(8, Math.round(finalRiskPercentage * 0.58)),
    },
    {
      hourOffset: 4,
      label: '+4 Hours',
      withoutInterventionScore: Math.min(
        99,
        Math.round(finalRiskPercentage * (riskLevel === 'CRITICAL' ? 1.35 : riskLevel === 'HIGH' ? 1.25 : 1.0))
      ),
      withInterventionScore: Math.max(8, Math.round(finalRiskPercentage * 0.42)),
    },
    {
      hourOffset: 6,
      label: '+6 Hours',
      withoutInterventionScore: Math.min(
        99,
        Math.round(finalRiskPercentage * (riskLevel === 'CRITICAL' ? 1.4 : riskLevel === 'HIGH' ? 1.3 : 0.95))
      ),
      withInterventionScore: Math.max(8, Math.round(finalRiskPercentage * 0.28)),
    },
  ];

  // Structured SBAR Report
  const sbarReport: SbarReport = {
    situation: `Patient ${patientName} is ${hoursPostOp}h post-${surgeryType} displaying ${riskLevel} complication risk (${finalRiskPercentage}%) driven by ${flags.slice(0, 2).join(' and ') || 'normal baseline parameters'}.`,
    background: `${patientName} underwent ${surgeryType}. Past history: ${vitals.painScore > 6 ? 'Significant pain reported' : 'Under standard observation'}.`,
    assessment: `Clinical indicators demonstrate high concern for ${suspectedComplications.slice(0, 2).join(' and ')}. Organ vulnerability highlights ${organSystems.find((o) => o.status === 'CRITICAL' || o.status === 'HIGH')?.name || 'hemodynamic stability'}.`,
    recommendation:
      riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
        ? 'Immediate bedside physician evaluation, STAT diagnostic vitals re-check, and hemodynamic stabilization protocol.'
        : 'Continue standardized PACU protocol with frequent vital re-checks every 60-120 minutes.',
  };

  // Protocol Orders
  const protocolOrders: ClinicalProtocolOrder[] = [];
  if (vitals.bodyTemperature >= 101.0) {
    protocolOrders.push({
      id: 'ORD-1',
      category: 'STAT Lab',
      order: 'STAT Blood Cultures x2 & Complete Blood Count (CBC)',
      rationale: 'Assess dynamic cellular response and progression of suspected surgical site infection',
      urgency: 'IMMEDIATE',
    });
  }
  if (vitals.bloodPressureSys < 90) {
    protocolOrders.push({
      id: 'ORD-2',
      category: 'Therapeutic',
      order: 'Initiate 500 mL IV Crystalloid Bolus over 30 mins',
      rationale: 'Volume resuscitation for suspected hypovolemia or surgical blood loss',
      urgency: 'IMMEDIATE',
    });
  }
  if (vitals.oxygenSaturation < 93 || vitals.respiratoryRate < 10) {
    protocolOrders.push({
      id: 'ORD-3',
      category: 'Therapeutic',
      order: 'Titrate Supplemental O2 via Nasal Cannula to maintain SpO2 >= 95%',
      rationale: 'Correct arterial hypoxemia and prevent alveolar hypoventilation',
      urgency: 'IMMEDIATE',
    });
  }
  protocolOrders.push({
    id: 'ORD-4',
    category: 'Monitoring',
    order:
      riskLevel === 'CRITICAL'
        ? 'Continuous 5-Lead ECG and Arterial Line / SpO2 Telemetry'
        : 'Hourly Vitals & Fluid Balance Flowsheet',
    rationale: 'Close surveillance to detect physiological shifts early',
    urgency: riskLevel === 'CRITICAL' ? 'IMMEDIATE' : 'WITHIN_1_HR',
  });
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    protocolOrders.push({
      id: 'ORD-5',
      category: 'Consultation',
      order: 'Urgent Surgical Resident & Critical Care Team Bedside Evaluation',
      rationale: 'Multidisciplinary post-surgical escalation for patient safety',
      urgency: 'IMMEDIATE',
    });
  }

  return {
    riskScore: finalRiskPercentage,
    riskLevel,
    flags,
    suspectedComplications,
    organSystems,
    featureAttributions: attributions,
    trajectory,
    sbarReport,
    protocolOrders,
    confidenceScore: 94,
  };
}

// REST API Endpoints

// 1. Get all demo patients
app.get('/api/patients', (req: Request, res: Response) => {
  res.json({ patients: patientsDatabase });
});

// 2. Add or update patient in testing database
app.post('/api/patients', (req: Request, res: Response) => {
  const patientData: Patient = req.body;
  if (!patientData || !patientData.id || !patientData.vitals) {
    res.status(400).json({ error: 'Patient ID and vitals are required' });
    return;
  }

  const existingIndex = patientsDatabase.findIndex((p) => p.id === patientData.id);
  if (existingIndex >= 0) {
    patientsDatabase[existingIndex] = { ...patientsDatabase[existingIndex], ...patientData };
  } else {
    patientsDatabase.push(patientData);
  }

  res.json({ success: true, patient: patientData, allPatients: patientsDatabase });
});

// 3. Reset demo database to defaults
app.post('/api/patients/reset', (req: Request, res: Response) => {
  patientsDatabase = JSON.parse(JSON.stringify(DEFAULT_PATIENTS));
  res.json({ success: true, patients: patientsDatabase });
});

// 4. AI-Assisted Prediction of Post-Surgical Complications
app.post('/api/predict', async (req: Request, res: Response) => {
  try {
    const { patient, vitals } = req.body as { patient: Patient; vitals: PatientVitals };

    if (!patient || !vitals) {
      res.status(400).json({ error: 'Patient information and vitals are required' });
      return;
    }

    // Calculate baseline rule-based clinical score
    const heuristic = calculateHeuristicRisk(
      vitals,
      patient.hoursPostOp,
      patient.age,
      patient.name,
      patient.surgeryType
    );

    let aiReasoning = '';
    let recommendations: string[] = [];
    let detectedRisks: string[] = heuristic.suspectedComplications;
    let finalRiskLevel = heuristic.riskLevel;
    let finalRiskScore = heuristic.riskScore;

    let modelUsed = 'clinical-heuristics-engine';

    // Call Gemini 3.8 Flash for clinical reasoning ONLY if a valid API key is present
    if (ai && hasValidGeminiKey) {
      try {
        const prompt = `
You are an AI Clinical Decision Support Specialist evaluating a post-surgical patient.
Analyze the following post-surgical electronic health record and patient vitals:

Patient ID: ${patient.id}
Name: ${patient.name}
Age: ${patient.age} (${patient.gender})
Procedure: ${patient.surgeryType}
Hours Post-Operation: ${patient.hoursPostOp} hrs
Past Medical History: ${patient.medicalHistory}

CURRENT VITALS:
- Heart Rate: ${vitals.heartRate} bpm (Normal: 60-100)
- Blood Pressure: ${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg (Normal: 90-120 / 60-80)
- SpO2 Oxygen Saturation: ${vitals.oxygenSaturation}% (Normal: >=95%)
- Body Temperature: ${vitals.bodyTemperature}°F (Normal: 97.8 - 99.1°F)
- Respiratory Rate: ${vitals.respiratoryRate} breaths/min (Normal: 12-20)
- Pain Score: ${vitals.painScore}/10 (Normal: 0-3)

Calculated Baseline Heuristic:
- Risk: ${heuristic.riskScore}% (${heuristic.riskLevel})
- Flags: ${heuristic.flags.join(', ') || 'None'}

Please return a valid JSON object strictly matching this schema:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "riskScore": number (5 to 99),
  "primaryComplications": ["array of specific complications e.g. Sepsis, Hemorrhage, Respiratory Depression, DVT, Surgical Site Infection, or Normal Recovery"],
  "clinicalSummary": "2-3 short, clear sentences explaining why the patient is at this risk level with clinical rationale",
  "keyVitalFlags": ["1-3 brief flags"],
  "recommendedActions": ["3-4 clear, bullet-point actions for the care team"]
}
`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        // 3.5 second timeout safeguard so request never hangs
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI inference timeout')), 3500)
        );

        const response: any = await Promise.race([responsePromise, timeoutPromise]);
        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.riskLevel) finalRiskLevel = parsed.riskLevel;
          if (typeof parsed.riskScore === 'number') finalRiskScore = parsed.riskScore;
          if (Array.isArray(parsed.primaryComplications) && parsed.primaryComplications.length > 0) {
            detectedRisks = parsed.primaryComplications;
          }
          if (parsed.clinicalSummary) aiReasoning = parsed.clinicalSummary;
          if (Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length > 0) {
            recommendations = parsed.recommendedActions;
          }
          modelUsed = 'gemini-3.8-flash';
        }
      } catch (geminiError) {
        console.warn('Gemini API skipped or timed out, using instant clinical heuristics:', geminiError);
      }
    }

    if (!aiReasoning) {
      if (finalRiskLevel === 'LOW') {
        aiReasoning = `Patient's vitals are within expected parameters for ${patient.hoursPostOp} hours following ${patient.surgeryType}. Vital signs show hemodynamic stability with adequate oxygenation.`;
        recommendations = [
          'Continue standard routine post-operative monitoring every 4 hours.',
          'Encourage incentive spirometry and early gentle mobilization.',
          'Maintain adequate oral/IV hydration and oral pain control as prescribed.',
        ];
      } else if (finalRiskLevel === 'MODERATE') {
        aiReasoning = `Patient demonstrates mild physiological deviation (${heuristic.flags.join(', ')}). While not immediately critical, these findings warrant closer observation to prevent secondary complications.`;
        recommendations = [
          'Increase vital sign checks to every 60 minutes.',
          'Review surgical site dressing for swelling, drainage, or bleeding.',
          'Ensure patient has adequate analgesia and adequate hydration.',
          'Re-assess pain score and respiratory comfort.',
        ];
      } else if (finalRiskLevel === 'HIGH') {
        aiReasoning = `Significant clinical abnormalities detected (${heuristic.flags.join(', ')}), indicating substantial risk of post-surgical complications such as ${heuristic.suspectedComplications.join(' or ')}.`;
        recommendations = [
          'Promptly notify the surgical resident or attending physician.',
          'Obtain stat arterial blood gas (ABG) and complete blood count (CBC).',
          'Initiate supplemental oxygen or adjust IV fluid rate per protocol.',
          'Continuous cardiac and pulse oximetry monitoring.',
        ];
      } else {
        aiReasoning = `CRITICAL ALERT: Severe vital deviation detected (${heuristic.flags.join(', ')}). Immediate intervention required for suspected ${heuristic.suspectedComplications.join(' and ')}.`;
        recommendations = [
          'IMMEDIATE: Call Rapid Response Team (RRT) and alert attending surgeon.',
          'Verify airway, breathing, circulation (ABCs); secure high-flow oxygen.',
          'Prepare for rapid IV fluid resuscitation or blood cross-match if hemorrhage suspected.',
          'Repeat vitals every 5 minutes until emergency team takes over.',
        ];
      }
    }

    res.json({
      patientId: patient.id,
      timestamp: new Date().toISOString(),
      riskLevel: finalRiskLevel,
      riskScore: finalRiskScore,
      primaryComplications: detectedRisks,
      clinicalSummary: aiReasoning,
      flags: heuristic.flags,
      recommendedActions: recommendations,
      modelUsed,
      organSystems: heuristic.organSystems,
      featureAttributions: heuristic.featureAttributions,
      trajectory: heuristic.trajectory,
      sbarReport: heuristic.sbarReport,
      protocolOrders: heuristic.protocolOrders,
      confidenceScore: heuristic.confidenceScore,
    });
  } catch (error) {
    console.error('Prediction endpoint error:', error);
    res.status(500).json({ error: 'Failed to process complication prediction' });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
