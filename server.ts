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

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface PatientVitals {
  heartRate: number; // bpm (60-100)
  bloodPressureSys: number; // mmHg (90-120)
  bloodPressureDia: number; // mmHg (60-80)
  oxygenSaturation: number; // % (95-100)
  bodyTemperature: number; // Fahrenheit (97.5 - 99.0)
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

// Small, simple database for testing and demo purposes
const DEFAULT_PATIENTS: Patient[] = [
  {
    id: 'PT-101',
    name: 'James Wilson',
    age: 42,
    gender: 'Male',
    surgeryType: 'Laparoscopic Appendectomy',
    hoursPostOp: 14,
    medicalHistory: 'Non-smoker, no chronic conditions, mild allergies',
    vitals: {
      heartRate: 74,
      bloodPressureSys: 118,
      bloodPressureDia: 76,
      oxygenSaturation: 98,
      bodyTemperature: 98.4,
      respiratoryRate: 16,
      painScore: 3,
    },
  },
  {
    id: 'PT-102',
    name: 'Eleanor Davis',
    age: 68,
    gender: 'Female',
    surgeryType: 'Total Knee Replacement (Arthroplasty)',
    hoursPostOp: 36,
    medicalHistory: 'Type 2 Diabetes, Mild Osteoarthritis',
    vitals: {
      heartRate: 114,
      bloodPressureSys: 138,
      bloodPressureDia: 88,
      oxygenSaturation: 93,
      bodyTemperature: 101.8,
      respiratoryRate: 23,
      painScore: 6,
    },
  },
  {
    id: 'PT-103',
    name: 'Robert Martinez',
    age: 55,
    gender: 'Male',
    surgeryType: 'Partial Hepatectomy / Abdominal Resection',
    hoursPostOp: 8,
    medicalHistory: 'Hypertension, Prior gastrointestinal ulcer',
    vitals: {
      heartRate: 126,
      bloodPressureSys: 84,
      bloodPressureDia: 54,
      oxygenSaturation: 94,
      bodyTemperature: 97.1,
      respiratoryRate: 26,
      painScore: 7,
    },
  },
  {
    id: 'PT-104',
    name: 'Sarah Chen',
    age: 31,
    gender: 'Female',
    surgeryType: 'General Laparoscopic Cholecystectomy',
    hoursPostOp: 4,
    medicalHistory: 'Asthma, high sensitivity to opioid analgesics',
    vitals: {
      heartRate: 62,
      bloodPressureSys: 102,
      bloodPressureDia: 64,
      oxygenSaturation: 89,
      bodyTemperature: 98.1,
      respiratoryRate: 9,
      painScore: 4,
    },
  },
  {
    id: 'PT-105',
    name: 'Arthur Pendelton',
    age: 73,
    gender: 'Male',
    surgeryType: 'Open Inguinal Hernia Repair',
    hoursPostOp: 22,
    medicalHistory: 'Coronary Artery Disease, Hypertension',
    vitals: {
      heartRate: 104,
      bloodPressureSys: 146,
      bloodPressureDia: 92,
      oxygenSaturation: 96,
      bodyTemperature: 99.6,
      respiratoryRate: 19,
      painScore: 5,
    },
  },
];

let patientsDatabase: Patient[] = JSON.parse(JSON.stringify(DEFAULT_PATIENTS));

// Straightforward rule-based calculation for clinical verification & fallback
function calculateHeuristicRisk(vitals: PatientVitals, hoursPostOp: number, age: number) {
  let score = 0;
  const flags: string[] = [];
  const suspectedComplications: string[] = [];

  // Heart Rate
  if (vitals.heartRate > 120) {
    score += 30;
    flags.push(`Severe Tachycardia (${vitals.heartRate} bpm)`);
  } else if (vitals.heartRate > 100) {
    score += 18;
    flags.push(`Moderate Tachycardia (${vitals.heartRate} bpm)`);
  } else if (vitals.heartRate < 50) {
    score += 25;
    flags.push(`Bradycardia (${vitals.heartRate} bpm)`);
  }

  // Blood Pressure Systolic
  if (vitals.bloodPressureSys < 90) {
    score += 35;
    flags.push(`Severe Hypotension (${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg)`);
    suspectedComplications.push('Internal Hemorrhage / Hypovolemic Shock');
  } else if (vitals.bloodPressureSys > 160) {
    score += 20;
    flags.push(`Significant Hypertension (${vitals.bloodPressureSys} mmHg)`);
    suspectedComplications.push('Cardiovascular Stress / Hypertensive Crisis');
  }

  // Oxygen Saturation SpO2
  if (vitals.oxygenSaturation < 90) {
    score += 35;
    flags.push(`Critical Hypoxemia (SpO2 ${vitals.oxygenSaturation}%)`);
    suspectedComplications.push('Respiratory Depression / Atelectasis / Pulmonary Embolism');
  } else if (vitals.oxygenSaturation < 94) {
    score += 15;
    flags.push(`Mild Hypoxia (SpO2 ${vitals.oxygenSaturation}%)`);
  }

  // Body Temperature
  if (vitals.bodyTemperature >= 101.5) {
    score += 30;
    flags.push(`High Fever (${vitals.bodyTemperature}°F)`);
    suspectedComplications.push('Surgical Site Infection / Early Sepsis');
  } else if (vitals.bodyTemperature >= 100.4) {
    score += 15;
    flags.push(`Low-Grade Fever (${vitals.bodyTemperature}°F)`);
  } else if (vitals.bodyTemperature < 96.5) {
    score += 25;
    flags.push(`Hypothermia (${vitals.bodyTemperature}°F)`);
    suspectedComplications.push('Septic Shock / Thermal Dysregulation');
  }

  // Respiratory Rate
  if (vitals.respiratoryRate > 24) {
    score += 25;
    flags.push(`Tachypnea (${vitals.respiratoryRate} breaths/min)`);
  } else if (vitals.respiratoryRate < 10) {
    score += 30;
    flags.push(`Severe Bradypnea (${vitals.respiratoryRate} breaths/min)`);
    suspectedComplications.push('Post-Anesthesia Opioid-Induced Respiratory Depression');
  }

  // Pain Score
  if (vitals.painScore >= 8) {
    score += 10;
    flags.push(`Uncontrolled Pain (${vitals.painScore}/10)`);
  }

  // Age factor
  if (age > 65) {
    score += 5;
  }

  const finalRiskPercentage = Math.min(99, Math.max(5, score));

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
      suspectedComplications.push('Non-specific Physiological Stress');
    }
  }

  return {
    riskScore: finalRiskPercentage,
    riskLevel,
    flags,
    suspectedComplications,
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
    const heuristic = calculateHeuristicRisk(vitals, patient.hoursPostOp, patient.age);

    let aiReasoning = '';
    let recommendations: string[] = [];
    let detectedRisks: string[] = heuristic.suspectedComplications;
    let finalRiskLevel = heuristic.riskLevel;
    let finalRiskScore = heuristic.riskScore;

    // Call Gemini 3.8 Flash for clinical reasoning
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `
You are an AI Clinical Assistant assisting a first-year medical/nursing student evaluating post-surgical patients.
Analyze the following post-surgical patient electronic health record and real-time biometric vitals:

Patient ID: ${patient.id}
Name: ${patient.name}
Age: ${patient.age} (${patient.gender})
Procedure: ${patient.surgeryType}
Hours Post-Operation: ${patient.hoursPostOp} hrs
Past Medical History: ${patient.medicalHistory}

CURRENT REAL-TIME BIOMETRICS:
- Heart Rate: ${vitals.heartRate} bpm (Normal: 60-100)
- Blood Pressure: ${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg (Normal: 90-120 / 60-80)
- SpO2 Oxygen Saturation: ${vitals.oxygenSaturation}% (Normal: >=95%)
- Body Temperature: ${vitals.bodyTemperature}°F (Normal: 97.8 - 99.1°F)
- Respiratory Rate: ${vitals.respiratoryRate} breaths/min (Normal: 12-20)
- Reported Pain Score: ${vitals.painScore}/10

Baseline Clinical Heuristic Calculated:
- Calculated Risk: ${heuristic.riskScore}% (${heuristic.riskLevel})
- Vital Flags: ${heuristic.flags.join(', ') || 'None'}

Please return a valid JSON object strictly matching this schema:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "riskScore": number (5 to 99),
  "primaryComplications": ["array of specific complications e.g. Sepsis, Hemorrhage, Respiratory Depression, DVT, Surgical Site Infection, or Normal Recovery"],
  "clinicalSummary": "2-3 short, clear sentences explaining why the patient is at this risk level, written clearly for a first-year student to understand",
  "keyVitalFlags": ["1-3 brief vital flags that influenced the decision"],
  "recommendedActions": ["3-4 clear, bullet-point actions for the care team, e.g. Notify surgeon, supplemental oxygen, check wound, IV fluid bolus, repeat vitals in 15 mins"]
}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

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
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, using clinical fallback engine:', geminiError);
      }
    }

    // If Gemini was not used or did not produce reasoning, generate friendly student-level fallback
    if (!aiReasoning) {
      if (finalRiskLevel === 'LOW') {
        aiReasoning = `Patient's biometrics are within expected parameters for ${patient.hoursPostOp} hours following ${patient.surgeryType}. Vital signs show hemodynamic stability with adequate oxygenation.`;
        recommendations = [
          'Continue standard routine post-operative monitoring every 4 hours.',
          'Encourage incentive spirometry and early gentle mobilization.',
          'Maintain adequate oral/IV hydration and oral pain control as prescribed.',
        ];
      } else if (finalRiskLevel === 'MODERATE') {
        aiReasoning = `Patient demonstrates mild physiological variation (${heuristic.flags.join(', ')}). While not immediately critical, these deviations warrant closer observation to prevent secondary complications.`;
        recommendations = [
          'Increase vital sign checks to every 60 minutes.',
          'Review surgical site dressing for swelling, drainage, or bleeding.',
          'Ensure patient has adequate analgesia and adequate hydration.',
          'Re-assess pain score and respiratory comfort.',
        ];
      } else if (finalRiskLevel === 'HIGH') {
        aiReasoning = `Significant vital abnormalities detected (${heuristic.flags.join(', ')}), indicating substantial risk of post-surgical complications such as ${heuristic.suspectedComplications.join(' or ')}.`;
        recommendations = [
          'Promptly notify the surgical resident or attending physician.',
          'Obtain stat arterial blood gas (ABG) and complete blood count (CBC).',
          'Initiate supplemental oxygen or adjust IV fluid rate per protocol.',
          'Continuous cardiac and pulse oximetry monitoring.',
        ];
      } else {
        aiReasoning = `CRITICAL ALERT: Life-threatening biometric deviation detected (${heuristic.flags.join(', ')}). Immediate intervention required for suspected ${heuristic.suspectedComplications.join(' and ')}.`;
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
      modelUsed: process.env.GEMINI_API_KEY ? 'gemini-3.8-flash' : 'clinical-heuristics-engine',
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
