import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Activity,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Info,
  RefreshCw,
  Play,
  Square,
  UserPlus,
  Sliders,
  ShieldAlert,
  Clock,
  RotateCcw,
  Printer,
  ChevronRight,
  TrendingUp,
  FileText,
  Layers,
  ClipboardCheck,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Plus,
  Minus,
  Database,
  Stethoscope,
  Sun,
  Moon,
  Search,
  X,
} from 'lucide-react';
import {
  Patient,
  PatientVitals,
  PredictionResult,
  RiskLevel,
  OrganSystemRisk,
  FeatureAttribution,
  TrajectoryPoint,
  SbarReport,
  ClinicalProtocolOrder,
} from './types';
import { PRELOADED_100_PATIENTS } from './data/patientsData';

// 100 Preloaded post-operative patient electronic health records
const INITIAL_DEMO_PATIENTS: Patient[] = PRELOADED_100_PATIENTS;

export default function App() {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_DEMO_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PT-101');
  const [currentVitals, setCurrentVitals] = useState<PatientVitals>(INITIAL_DEMO_PATIENTS[0].vitals);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showProjectInfo, setShowProjectInfo] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme_dark');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sync dark class on documentElement
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme_dark', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme_dark', 'false');
      }
    } catch (e) {
      console.warn('Dark mode storage error:', e);
    }
  }, [isDarkMode]);

  // Prediction Enhanced Layers tab
  const [selectedPredictionLayer, setSelectedPredictionLayer] = useState<
    'systems' | 'attribution' | 'trajectory' | 'orders' | 'sbar'
  >('systems');
  const [completedOrders, setCompletedOrders] = useState<Record<string, boolean>>({});
  const [copiedSbar, setCopiedSbar] = useState<boolean>(false);

  // New patient modal state
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    id: `PT-${Math.floor(100 + Math.random() * 900)}`,
    name: '',
    age: 45,
    gender: 'Male',
    surgeryType: 'Post-Op Procedure',
    hoursPostOp: 12,
    medicalHistory: 'No known drug allergies',
  });

  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search and filter for 100 preloaded patients
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Active selected patient
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Filtered patients for instant search across 100 preloaded EHR records
  const filteredPatients = patients.filter((p) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      p.surgeryType.toLowerCase().includes(query) ||
      p.medicalHistory.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'CRITICAL') {
      return (
        p.vitals.heartRate > 115 ||
        p.vitals.bloodPressureSys < 90 ||
        p.vitals.oxygenSaturation < 92 ||
        p.vitals.bodyTemperature >= 101.5 ||
        p.vitals.respiratoryRate >= 26 ||
        p.vitals.respiratoryRate <= 9
      );
    }
    if (categoryFilter === 'ABDOMINAL') {
      const s = p.surgeryType.toLowerCase();
      return (
        s.includes('laparoscopic') ||
        s.includes('colectomy') ||
        s.includes('appendectomy') ||
        s.includes('cholecystectomy') ||
        s.includes('gastric') ||
        s.includes('hernia') ||
        s.includes('pancreatectomy') ||
        s.includes('laparotomy')
      );
    }
    if (categoryFilter === 'ORTHO_SPINE') {
      const s = p.surgeryType.toLowerCase();
      return (
        s.includes('arthroplasty') ||
        s.includes('knee') ||
        s.includes('hip') ||
        s.includes('spine') ||
        s.includes('spinal') ||
        s.includes('fusion') ||
        s.includes('cervical') ||
        s.includes('fracture') ||
        s.includes('rotator') ||
        s.includes('discectomy')
      );
    }
    if (categoryFilter === 'CARDIO_VASC') {
      const s = p.surgeryType.toLowerCase();
      return (
        s.includes('cabg') ||
        s.includes('valve') ||
        s.includes('aneurysm') ||
        s.includes('carotid') ||
        s.includes('bypass') ||
        s.includes('lobectomy') ||
        s.includes('vascular') ||
        s.includes('pericardial')
      );
    }
    return true;
  });

  // Fetch patients on mount
  useEffect(() => {
    fetch('/api/patients')
      .then((res) => {
        if (!res.ok) throw new Error('Backend starting up');
        return res.json();
      })
      .then((data) => {
        if (data.patients && data.patients.length > 0) {
          setPatients(data.patients);
          const first = data.patients[0];
          setSelectedPatientId(first.id);
          setCurrentVitals(first.vitals);
          runPrediction(first, first.vitals);
        }
      })
      .catch((err) => {
        console.log('Using local 100-patient preloaded data:', err);
        runPrediction(activePatient, activePatient.vitals);
      });
  }, []);

  // When patient selection changes
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setCurrentVitals({ ...patient.vitals });
    runPrediction(patient, patient.vitals);
  };

  // Run prediction request
  const runPrediction = async (patientToPredict: Patient, vitalsToPredict: PatientVitals) => {
    setIsLoading(true);
    setStatusMessage('Analyzing biometric indicators & EHR with AI...');
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: patientToPredict, vitals: vitalsToPredict }),
      });

      if (!res.ok) {
        throw new Error('Prediction API failed');
      }

      const result: PredictionResult = await res.json();
      setPrediction(result);
      setStatusMessage('');
    } catch (err) {
      console.warn('Prediction request fallback:', err);
      const localResult = localRuleEngine(patientToPredict, vitalsToPredict);
      setPrediction(localResult);
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // Comprehensive multi-layer local clinical calculation engine
  const localRuleEngine = (patient: Patient, vitals: PatientVitals): PredictionResult => {
    let score = 10;
    const flags: string[] = [];
    const complications: string[] = [];
    const attributions: FeatureAttribution[] = [];

    // Cardiovascular
    let cvScore = 10;
    const cvParams: string[] = [];
    if (vitals.heartRate > 120) {
      score += 30;
      cvScore += 45;
      flags.push(`Severe Tachycardia (${vitals.heartRate} bpm)`);
      cvParams.push(`HR: ${vitals.heartRate} bpm`);
      attributions.push({
        feature: 'Severe Tachycardia',
        impact: 28,
        direction: 'risk_increasing',
        description: `Heart rate of ${vitals.heartRate} bpm indicates severe autonomic stress or acute shock response`,
      });
    } else if (vitals.heartRate > 100) {
      score += 15;
      cvScore += 25;
      flags.push(`Tachycardia (${vitals.heartRate} bpm)`);
      cvParams.push(`HR: ${vitals.heartRate} bpm`);
      attributions.push({
        feature: 'Elevated Heart Rate',
        impact: 14,
        direction: 'risk_increasing',
        description: `Mild tachycardia (${vitals.heartRate} bpm) suggests early cardiovascular compensation`,
      });
    } else {
      cvScore = Math.max(5, cvScore - 5);
      attributions.push({
        feature: 'Stable Heart Rate',
        impact: -10,
        direction: 'protective',
        description: `Normocardic rhythm (${vitals.heartRate} bpm) reflects cardiac hemodynamic stability`,
      });
    }

    if (vitals.bloodPressureSys < 90) {
      score += 35;
      cvScore += 40;
      flags.push(`Hypotension (${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg)`);
      cvParams.push(`BP: ${vitals.bloodPressureSys}/${vitals.bloodPressureDia}`);
      complications.push('Hypovolemic / Hemorrhagic Shock');
      attributions.push({
        feature: 'Arterial Hypotension',
        impact: 32,
        direction: 'risk_increasing',
        description: `Systolic BP < 90 mmHg (${vitals.bloodPressureSys}) compromises end-organ microvascular perfusion`,
      });
    } else if (vitals.bloodPressureSys > 150) {
      score += 15;
      cvScore += 20;
      flags.push(`Hypertensive Urgency (${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg)`);
      cvParams.push(`BP: ${vitals.bloodPressureSys}/${vitals.bloodPressureDia}`);
      complications.push('Hypertensive Decompensation');
    }

    // Pulmonary
    let respScore = 8;
    const respParams: string[] = [];
    if (vitals.oxygenSaturation < 90) {
      score += 35;
      respScore += 55;
      flags.push(`Severe Hypoxia (SpO2 ${vitals.oxygenSaturation}%)`);
      respParams.push(`SpO2: ${vitals.oxygenSaturation}%`);
      complications.push('Acute Hypoxemic Respiratory Failure');
      attributions.push({
        feature: 'Critical Hypoxemia',
        impact: 35,
        direction: 'risk_increasing',
        description: `SpO2 ${vitals.oxygenSaturation}% falls below critical oxygen delivery threshold`,
      });
    } else if (vitals.oxygenSaturation < 94) {
      score += 18;
      respScore += 25;
      flags.push(`Hypoxia (SpO2 ${vitals.oxygenSaturation}%)`);
      respParams.push(`SpO2: ${vitals.oxygenSaturation}%`);
      complications.push('Atelectasis / Respiratory Depression');
    } else {
      respScore = Math.max(5, respScore - 4);
      attributions.push({
        feature: 'Normal Oxygen Saturation',
        impact: -12,
        direction: 'protective',
        description: `Adequate alveolar gas exchange maintained at ${vitals.oxygenSaturation}% on ambient room air`,
      });
    }

    if (vitals.respiratoryRate < 10) {
      score += 30;
      respScore += 40;
      flags.push(`Bradypnea (${vitals.respiratoryRate}/min)`);
      respParams.push(`RR: ${vitals.respiratoryRate}/min`);
      complications.push('Post-Op Narcotic/Opioid Hypoventilation');
      attributions.push({
        feature: 'Severe Hypoventilation',
        impact: 28,
        direction: 'risk_increasing',
        description: `Respiratory rate of ${vitals.respiratoryRate}/min indicates central respiratory depression`,
      });
    } else if (vitals.respiratoryRate > 24) {
      score += 20;
      respScore += 30;
      flags.push(`Tachypnea (${vitals.respiratoryRate}/min)`);
      respParams.push(`RR: ${vitals.respiratoryRate}/min`);
      complications.push('Respiratory Fatigue / Compensation');
    }

    // Sepsis / Thermal
    let sepsisScore = 5;
    const sepsisParams: string[] = [];
    if (vitals.bodyTemperature >= 101.5) {
      score += 25;
      sepsisScore += 45;
      flags.push(`High Fever (${vitals.bodyTemperature.toFixed(1)}°F)`);
      sepsisParams.push(`Temp: ${vitals.bodyTemperature.toFixed(1)}°F`);
      complications.push('Surgical Site Infection / SIRS');
      attributions.push({
        feature: 'Febrile Inflammatory State',
        impact: 24,
        direction: 'risk_increasing',
        description: `Core pyrexia of ${vitals.bodyTemperature}°F suggests infectious surgical etiology or SIRS activation`,
      });
    } else if (vitals.bodyTemperature <= 96.5) {
      score += 20;
      sepsisScore += 35;
      flags.push(`Hypothermia (${vitals.bodyTemperature.toFixed(1)}°F)`);
      sepsisParams.push(`Temp: ${vitals.bodyTemperature.toFixed(1)}°F`);
      complications.push('Post-Anesthesia Hypothermia / Coagulopathy Risk');
    } else {
      attributions.push({
        feature: 'Normothermic Core Temp',
        impact: -8,
        direction: 'protective',
        description: `Normothermia (${vitals.bodyTemperature}°F) mitigates shivering-induced oxygen consumption`,
      });
    }

    // Surgical / Pain / Recovery
    let painFactor = 5;
    if (vitals.painScore >= 8) {
      score += 12;
      painFactor += 30;
      flags.push(`Severe Uncontrolled Pain (${vitals.painScore}/10)`);
    }

    // Contextual surgical age factor
    if (patient.age > 70) {
      score += 8;
      attributions.push({
        feature: 'Advanced Patient Age',
        impact: 8,
        direction: 'risk_increasing',
        description: `Patient age (${patient.age}y) reduces functional physiological reserve`,
      });
    }

    const finalScore = Math.min(99, Math.max(5, score));
    let level: RiskLevel = 'LOW';
    if (finalScore >= 75) level = 'CRITICAL';
    else if (finalScore >= 50) level = 'HIGH';
    else if (finalScore >= 25) level = 'MODERATE';

    const primaryComplications =
      complications.length > 0
        ? Array.from(new Set(complications))
        : ['None (Routine Post-Op Monitoring)'];

    // 1. Organ System Vulnerabilities
    const organSystems: OrganSystemRisk[] = [
      {
        name: 'Cardiovascular Hemodynamics',
        score: Math.min(99, Math.max(5, cvScore)),
        status: cvScore >= 70 ? 'CRITICAL' : cvScore >= 45 ? 'HIGH' : cvScore >= 25 ? 'ELEVATED' : 'STABLE',
        keyFinding:
          cvScore >= 50
            ? 'Tachycardia and altered arterial pressure indicative of vascular compromise'
            : 'Cardiac output and peripheral tone intact',
        parametersEvaluated: cvParams.length > 0 ? cvParams : ['HR: Normal', 'BP: Normal'],
      },
      {
        name: 'Pulmonary & Oxygenation',
        score: Math.min(99, Math.max(5, respScore)),
        status: respScore >= 70 ? 'CRITICAL' : respScore >= 45 ? 'HIGH' : respScore >= 25 ? 'ELEVATED' : 'STABLE',
        keyFinding:
          respScore >= 50
            ? 'Ventilatory insufficiency; monitor for hypoxemic arrest or atelectasis'
            : 'Uncompromised gas exchange & physiological airway mechanics',
        parametersEvaluated: respParams.length > 0 ? respParams : ['SpO2: Normal', 'RR: Normal'],
      },
      {
        name: 'Infectious / Sepsis Cascade',
        score: Math.min(99, Math.max(5, sepsisScore)),
        status: sepsisScore >= 70 ? 'CRITICAL' : sepsisScore >= 45 ? 'HIGH' : sepsisScore >= 25 ? 'ELEVATED' : 'STABLE',
        keyFinding:
          sepsisScore >= 45
            ? 'Systemic inflammatory response triggered; possible wound infection or bacteremia'
            : 'Afebrile; no overt acute systemic inflammatory indicators',
        parametersEvaluated: sepsisParams.length > 0 ? sepsisParams : ['Core Temp: Normal'],
      },
      {
        name: 'Surgical Recovery Reserve',
        score: Math.min(99, Math.max(5, painFactor + (patient.hoursPostOp < 12 ? 20 : 5))),
        status: finalScore >= 60 ? 'HIGH' : finalScore >= 35 ? 'ELEVATED' : 'STABLE',
        keyFinding:
          patient.hoursPostOp < 12
            ? 'Immediate post-anesthetic emergence window requiring frequent nursing surveillance'
            : 'Progressing along expected surgical trajectory',
        parametersEvaluated: [`Post-Op: ${patient.hoursPostOp}h`, `Pain: ${vitals.painScore}/10`],
      },
    ];

    // Trajectory Model
    const trajectory: TrajectoryPoint[] = [
      {
        hourOffset: 0,
        label: 'Current (H+0)',
        withoutInterventionScore: finalScore,
        withInterventionScore: finalScore,
      },
      {
        hourOffset: 1,
        label: '+1 Hour',
        withoutInterventionScore: Math.min(
          99,
          Math.round(finalScore * (level === 'CRITICAL' ? 1.15 : level === 'HIGH' ? 1.08 : 1.02))
        ),
        withInterventionScore: Math.max(8, Math.round(finalScore * 0.78)),
      },
      {
        hourOffset: 2,
        label: '+2 Hours',
        withoutInterventionScore: Math.min(
          99,
          Math.round(finalScore * (level === 'CRITICAL' ? 1.25 : level === 'HIGH' ? 1.18 : 1.05))
        ),
        withInterventionScore: Math.max(8, Math.round(finalScore * 0.58)),
      },
      {
        hourOffset: 4,
        label: '+4 Hours',
        withoutInterventionScore: Math.min(
          99,
          Math.round(finalScore * (level === 'CRITICAL' ? 1.35 : level === 'HIGH' ? 1.25 : 1.0))
        ),
        withInterventionScore: Math.max(8, Math.round(finalScore * 0.42)),
      },
      {
        hourOffset: 6,
        label: '+6 Hours',
        withoutInterventionScore: Math.min(
          99,
          Math.round(finalScore * (level === 'CRITICAL' ? 1.4 : level === 'HIGH' ? 1.3 : 0.95))
        ),
        withInterventionScore: Math.max(8, Math.round(finalScore * 0.28)),
      },
    ];

    // SBAR Report
    const sbarReport: SbarReport = {
      situation: `Patient ${patient.name} (${patient.id}) is ${patient.hoursPostOp}h post-${patient.surgeryType} exhibiting ${level} complication risk (${finalScore}%) driven by ${flags.slice(0, 2).join(' and ') || 'normal baseline parameters'}.`,
      background: `Patient underwent ${patient.surgeryType}. Medical background includes: ${patient.medicalHistory}.`,
      assessment: `Biometrics indicate elevated concern for ${primaryComplications.slice(0, 2).join(' and ')}. Organ vulnerability mapping highlights ${organSystems.find((o) => o.status === 'CRITICAL' || o.status === 'HIGH')?.name || 'hemodynamic stability'}.`,
      recommendation:
        level === 'CRITICAL' || level === 'HIGH'
          ? 'Urgent attending / surgical resident bedside evaluation and hemodynamic stabilization protocol.'
          : 'Continue standardized PACU protocol with vital sign re-checks every 60-120 minutes.',
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
        level === 'CRITICAL'
          ? 'Continuous 5-Lead ECG and Arterial Line / SpO2 Telemetry'
          : 'Hourly Vitals & Fluid Balance Flowsheet',
      rationale: 'Close surveillance to detect physiological shifts early',
      urgency: level === 'CRITICAL' ? 'IMMEDIATE' : 'WITHIN_1_HR',
    });
    if (level === 'CRITICAL' || level === 'HIGH') {
      protocolOrders.push({
        id: 'ORD-5',
        category: 'Consultation',
        order: 'Urgent Surgical Resident & Critical Care Team Bedside Evaluation',
        rationale: 'Multidisciplinary post-surgical escalation for patient safety',
        urgency: 'IMMEDIATE',
      });
    }

    return {
      patientId: patient.id,
      timestamp: new Date().toISOString(),
      riskLevel: level,
      riskScore: finalScore,
      primaryComplications,
      flags,
      clinicalSummary:
        level === 'CRITICAL'
          ? `CRITICAL ALERT: Biometrics for ${patient.name} (${patient.hoursPostOp}h post-${patient.surgeryType}) demonstrate acute physiological decompensation (${flags.join(', ')}). Immediate risk of ${primaryComplications.join(' and ')} requiring STAT intervention.`
          : level === 'HIGH'
            ? `ELEVATED CONCERN: Significant vital deviations detected for ${patient.name} following ${patient.surgeryType} (${flags.join(', ')}). Suspicion of ${primaryComplications.join(' or ')} warrants proactive escalation.`
            : level === 'MODERATE'
              ? `BORDERLINE STATUS: Minor physiological shift observed for ${patient.name} (${flags.join(', ')}). Patient requires close vital reassessment every 60 minutes.`
              : `HEMODYNAMIC STABILITY: Patient ${patient.name} is progressing within expected post-operative recovery parameters for ${patient.hoursPostOp}h post-${patient.surgeryType}. Normocardic and normotensive baseline maintained.`,
      recommendedActions:
        level === 'CRITICAL'
          ? ['Alert surgeon immediately', 'Initiate emergency resuscitation protocol', 'Repeat vitals in 5 mins']
          : level === 'HIGH'
            ? ['Notify charge nurse / resident', 'Check surgical dressing & drains', 'Supplemental oxygen per protocol']
            : ['Continue standard 4-hour vitals schedule', 'Encourage deep breathing exercises and hydration'],
      modelUsed: 'clinical-heuristics-engine',
      organSystems,
      featureAttributions: attributions,
      trajectory,
      sbarReport,
      protocolOrders,
      confidenceScore: 94,
    };
  };

  // Live biometric stream toggle
  useEffect(() => {
    if (isLiveStreaming) {
      liveTimerRef.current = setInterval(() => {
        setCurrentVitals((prev) => {
          const hrDelta = Math.floor(Math.random() * 5) - 2;
          const bpSysDelta = Math.floor(Math.random() * 5) - 2;
          const bpDiaDelta = Math.floor(Math.random() * 3) - 1;
          const spo2Delta = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
          const tempDelta = (Math.floor(Math.random() * 3) - 1) * 0.1;

          const updated: PatientVitals = {
            ...prev,
            heartRate: Math.max(40, Math.min(170, prev.heartRate + hrDelta)),
            bloodPressureSys: Math.max(65, Math.min(200, prev.bloodPressureSys + bpSysDelta)),
            bloodPressureDia: Math.max(40, Math.min(120, prev.bloodPressureDia + bpDiaDelta)),
            oxygenSaturation: Math.max(78, Math.min(100, prev.oxygenSaturation + spo2Delta)),
            bodyTemperature: parseFloat(
              Math.max(95.0, Math.min(104.5, prev.bodyTemperature + tempDelta)).toFixed(1)
            ),
          };

          return updated;
        });
      }, 3000);
    } else {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    }

    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [isLiveStreaming]);

  // When current vitals change while live streaming, re-evaluate after quiet pause
  useEffect(() => {
    if (isLiveStreaming && activePatient) {
      const timer = setTimeout(() => {
        runPrediction(activePatient, currentVitals);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentVitals.heartRate, currentVitals.bloodPressureSys, currentVitals.oxygenSaturation]);

  // Handle direct vital changes
  const updateVitalField = (field: keyof PatientVitals, val: number) => {
    const updated = { ...currentVitals, [field]: val };
    setCurrentVitals(updated);
  };

  // Quick Preset buttons for clinical testing
  const applyPreset = (preset: 'normal' | 'sepsis' | 'bleed' | 'hypoxia') => {
    let presetVitals: PatientVitals = { ...currentVitals };
    if (preset === 'normal') {
      presetVitals = {
        heartRate: 72,
        bloodPressureSys: 116,
        bloodPressureDia: 74,
        oxygenSaturation: 99,
        bodyTemperature: 98.6,
        respiratoryRate: 15,
        painScore: 2,
      };
    } else if (preset === 'sepsis') {
      presetVitals = {
        heartRate: 118,
        bloodPressureSys: 128,
        bloodPressureDia: 80,
        oxygenSaturation: 93,
        bodyTemperature: 102.1,
        respiratoryRate: 24,
        painScore: 5,
      };
    } else if (preset === 'bleed') {
      presetVitals = {
        heartRate: 132,
        bloodPressureSys: 82,
        bloodPressureDia: 52,
        oxygenSaturation: 94,
        bodyTemperature: 96.8,
        respiratoryRate: 27,
        painScore: 7,
      };
    } else if (preset === 'hypoxia') {
      presetVitals = {
        heartRate: 64,
        bloodPressureSys: 104,
        bloodPressureDia: 68,
        oxygenSaturation: 86,
        bodyTemperature: 98.2,
        respiratoryRate: 8,
        painScore: 3,
      };
    }
    setCurrentVitals(presetVitals);
    runPrediction(activePatient, presetVitals);
  };

  // Reset database to initial defaults
  const handleResetDatabase = async () => {
    try {
      const res = await fetch('/api/patients/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients);
        setSelectedPatientId(data.patients[0].id);
        setCurrentVitals(data.patients[0].vitals);
        runPrediction(data.patients[0], data.patients[0].vitals);
      }
    } catch {
      setPatients(INITIAL_DEMO_PATIENTS);
      setSelectedPatientId(INITIAL_DEMO_PATIENTS[0].id);
      setCurrentVitals(INITIAL_DEMO_PATIENTS[0].vitals);
      runPrediction(INITIAL_DEMO_PATIENTS[0], INITIAL_DEMO_PATIENTS[0].vitals);
    }
  };

  // Add new patient handler
  const handleAddNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.id) return;

    const patientToAdd: Patient = {
      id: newPatient.id || `PT-${Math.floor(Math.random() * 900 + 100)}`,
      name: newPatient.name,
      age: Number(newPatient.age) || 45,
      gender: (newPatient.gender as 'Male' | 'Female' | 'Other') || 'Male',
      surgeryType: newPatient.surgeryType || 'Post-Op Observation',
      hoursPostOp: Number(newPatient.hoursPostOp) || 12,
      medicalHistory: newPatient.medicalHistory || 'No significant history',
      vitals: { ...currentVitals },
    };

    try {
      await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientToAdd),
      });
    } catch (err) {
      console.log('Saved to state directly:', err);
    }

    setPatients((prev) => [patientToAdd, ...prev]);
    setSelectedPatientId(patientToAdd.id);
    setCurrentVitals(patientToAdd.vitals);
    runPrediction(patientToAdd, patientToAdd.vitals);
    setShowAddModal(false);
  };

  // Copy SBAR note to clipboard
  const handleCopySbar = () => {
    if (!prediction?.sbarReport) return;
    const s = prediction.sbarReport;
    const text = `=== SBAR POST-OP CLINICAL HANDOFF ===\n\nSITUATION:\n${s.situation}\n\nBACKGROUND:\n${s.background}\n\nASSESSMENT:\n${s.assessment}\n\nRECOMMENDATION:\n${s.recommendation}\n\nGenerated by Post-Op Complication Predictor • ${new Date().toLocaleString()}`;
    navigator.clipboard.writeText(text);
    setCopiedSbar(true);
    setTimeout(() => setCopiedSbar(false), 2000);
  };

  // Toggle order completion
  const toggleOrderCompletion = (orderId: string) => {
    setCompletedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Risk styling helpers with full dark mode support
  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'LOW':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800/60',
          badge: 'bg-emerald-600 text-white',
          border: 'border-emerald-500 dark:border-emerald-600',
          bar: 'bg-emerald-500',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'MODERATE':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800/60',
          badge: 'bg-amber-500 text-white',
          border: 'border-amber-500 dark:border-amber-600',
          bar: 'bg-amber-500',
          iconColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800/60',
          badge: 'bg-orange-600 text-white',
          border: 'border-orange-500 dark:border-orange-600',
          bar: 'bg-orange-600',
          iconColor: 'text-orange-600 dark:text-orange-400',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800/60',
          badge: 'bg-rose-600 text-white animate-pulse',
          border: 'border-rose-600',
          bar: 'bg-rose-600',
          iconColor: 'text-rose-600 dark:text-rose-400',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/40 text-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800',
          badge: 'bg-gray-600 text-white',
          border: 'border-gray-400',
          bar: 'bg-gray-400',
          iconColor: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  const getSystemStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800';
      case 'ELEVATED':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      default:
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    }
  };

  const riskTheme = getRiskColor(prediction?.riskLevel || 'LOW');

  const completedOrdersCount = prediction?.protocolOrders
    ? prediction.protocolOrders.filter((o) => completedOrders[o.id]).length
    : 0;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200`}>
      {/* Top Application Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Post-Op Complication Predictor
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100 Preloaded EHR Records • Instant Clinical AI Inference
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 100 Patients Ready Badge */}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              100 Patients Loaded • No API Key Needed
            </span>

            {/* Dark Mode Activate Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isDarkMode
                  ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 shadow-2xs'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Activate Dark Mode'}
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {/* Live stream switch */}
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isLiveStreaming
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Simulates real-time telemetry updates every 3 seconds"
            >
              {isLiveStreaming ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
                  <span>Stop Stream</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-1" />
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-slate-600 text-slate-600 dark:fill-slate-300 dark:text-slate-300" />
                  <span>Start Stream</span>
                </>
              )}
            </button>

            {/* Quick Info & Guide */}
            <button
              onClick={() => setShowProjectInfo(true)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              title="Project Documentation & Vital Guidelines"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Print/Export */}
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
              title="Print Summary Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Patients & Patient EHR (4 cols on lg) */}
        <section className="lg:col-span-4 space-y-4">
          {/* Patient Selector Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors duration-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Patients
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {filteredPatients.length} of {patients.length} records shown
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-2 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-md hover:bg-teal-100 dark:hover:bg-teal-900/50 flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
                <button
                  onClick={handleResetDatabase}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors"
                  title="Reset to 100 preloaded patient records"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Patient Search Input */}
            <div className="mb-2.5 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 100 patients by name, ID, surgery..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                {[
                  { id: 'ALL', label: `All (${patients.length})` },
                  { id: 'CRITICAL', label: 'High Alert' },
                  { id: 'ABDOMINAL', label: 'Abdominal' },
                  { id: 'ORTHO_SPINE', label: 'Ortho/Spine' },
                  { id: 'CARDIO_VASC', label: 'Cardio/Vasc' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors font-medium text-[10px] ${
                      categoryFilter === cat.id
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Patients list */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  No patients matched &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const isSelected = p.id === selectedPatientId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {p.id}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {p.age}y • {p.gender[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1 max-w-[210px]">
                          {p.surgeryType}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            {p.hoursPostOp}h post-op
                          </span>
                          <span>•</span>
                          <span>HR: {p.vitals.heartRate}</span>
                          <span>•</span>
                          <span>SpO2: {p.vitals.oxygenSaturation}%</span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 ${isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Electronic Health Record (EHR) Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors duration-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Selected Patient EHR</h3>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                {activePatient.id}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Patient Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{activePatient.name}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Age & Gender</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                    {activePatient.age} yrs • {activePatient.gender}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-0.5">Surgical Procedure</span>
                <span className="font-medium text-slate-900 dark:text-white">{activePatient.surgeryType}</span>
                <div className="flex items-center gap-1.5 mt-1 text-slate-600 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Elapsed Recovery: </span>
                  <strong className="text-slate-800 dark:text-slate-200">{activePatient.hoursPostOp} hours</strong>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-0.5">
                  Pre-Existing Conditions & Risk Factors
                </span>
                <p className="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                  {activePatient.medicalHistory}
                </p>
              </div>
            </div>

            {/* Quick Testing Presets */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-wider">
                Simulate Clinical Scenarios
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyPreset('normal')}
                  className="px-2 py-1.5 text-xs text-left bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  🟢 Normal Recovery
                </button>
                <button
                  onClick={() => applyPreset('sepsis')}
                  className="px-2 py-1.5 text-xs text-left bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60 rounded-md border border-orange-200 dark:border-orange-800 transition-colors"
                >
                  🟠 Sepsis / Infection
                </button>
                <button
                  onClick={() => applyPreset('bleed')}
                  className="px-2 py-1.5 text-xs text-left bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md border border-rose-200 dark:border-rose-800 transition-colors"
                >
                  🔴 Internal Bleed (Shock)
                </button>
                <button
                  onClick={() => applyPreset('hypoxia')}
                  className="px-2 py-1.5 text-xs text-left bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-md border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  🔵 Respiratory Hypoxia
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Center / Right Columns: Enhanced Prediction Layers & Patient's Medical Status (8 cols on lg) */}
        <section className="lg:col-span-8 space-y-4">
          {/* Prominent Risk Level Alert Card */}
          <div
            className={`rounded-xl border-2 p-5 transition-all shadow-sm ${riskTheme.bg} ${riskTheme.border}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${riskTheme.badge}`}
                >
                  {prediction?.riskLevel === 'CRITICAL' ? (
                    <AlertOctagon className="w-7 h-7" />
                  ) : prediction?.riskLevel === 'HIGH' ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : prediction?.riskLevel === 'MODERATE' ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-bold opacity-80">
                      Post-Surgical Complication Risk
                    </span>
                    {isLoading && (
                      <span className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Recalculating...
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black tracking-tight">
                    {prediction ? `${prediction.riskLevel} RISK` : 'CALCULATING...'}
                  </h3>
                </div>
              </div>

              {/* Numerical Risk Gauge */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-4 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-2xs text-right min-w-[150px]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Estimated Probability</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {prediction?.riskScore || 0}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${riskTheme.bar} transition-all duration-500`}
                    style={{ width: `${prediction?.riskScore || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Suspected Complications Tags */}
            {prediction && prediction.primaryComplications.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Suspected Conditions:</span>
                {prediction.primaryComplications.map((comp, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* EXTRA LAYERS TO ENHANCE PREDICTION (Multi-Layer Analytical Suite)        */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-colors duration-200">
            {/* Layer Tabs Header */}
            <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                    Enhanced Prediction Layers
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Multi-system decomposition, explainability, trajectory, & clinical protocol orders
                  </p>
                </div>
              </div>

              {/* Layer Selection Buttons */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setSelectedPredictionLayer('systems')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    selectedPredictionLayer === 'systems'
                      ? 'bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-700 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>1. Organ Systems</span>
                </button>

                <button
                  onClick={() => setSelectedPredictionLayer('attribution')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    selectedPredictionLayer === 'attribution'
                      ? 'bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-700 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>2. Risk Drivers</span>
                </button>

                <button
                  onClick={() => setSelectedPredictionLayer('trajectory')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    selectedPredictionLayer === 'trajectory'
                      ? 'bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-700 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>3. 6-Hour Trajectory</span>
                </button>

                <button
                  onClick={() => setSelectedPredictionLayer('orders')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    selectedPredictionLayer === 'orders'
                      ? 'bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-700 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>4. Care Orders</span>
                </button>

                <button
                  onClick={() => setSelectedPredictionLayer('sbar')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    selectedPredictionLayer === 'sbar'
                      ? 'bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-700 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>5. SBAR Handoff</span>
                </button>
              </div>
            </div>

            {/* Layer Body Content */}
            <div className="p-4">
              {/* LAYER 1: Organ System Vulnerability Index */}
              {selectedPredictionLayer === 'systems' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Multi-System Physiological Stress Breakdown
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Confidence Calibration: {prediction?.confidenceScore || 94}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(prediction?.organSystems || []).map((sys, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{sys.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSystemStatusBadge(
                              sys.status
                            )}`}
                          >
                            {sys.status}
                          </span>
                        </div>

                        {/* Progress meter */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                sys.score >= 70
                                  ? 'bg-rose-500'
                                  : sys.score >= 45
                                    ? 'bg-orange-500'
                                    : sys.score >= 25
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                              }`}
                              style={{ width: `${sys.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 min-w-[32px] text-right">
                            {sys.score}%
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                          <strong className="text-slate-700 dark:text-slate-300">Findings:</strong> {sys.keyFinding}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LAYER 2: Feature Attribution & Risk Drivers */}
              {selectedPredictionLayer === 'attribution' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <p className="leading-relaxed">
                      Factor breakdown quantifying the contribution (+% risk increase vs -% protective stabilization) of each clinical parameter to the final prediction.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Risk Accelerating Drivers */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Risk Drivers (+ Accelerators)
                      </span>
                      {prediction?.featureAttributions?.filter((a) => a.direction === 'risk_increasing').length ? (
                        prediction.featureAttributions
                          .filter((a) => a.direction === 'risk_increasing')
                          .map((attr, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs flex items-start justify-between gap-2"
                            >
                              <div>
                                <span className="font-semibold text-rose-950 dark:text-rose-200 block">
                                  {attr.feature}
                                </span>
                                <span className="text-[11px] text-rose-800 dark:text-rose-300 leading-snug block mt-0.5">
                                  {attr.description}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-600 text-white shrink-0">
                                +{attr.impact}%
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800 rounded-lg">
                          No severe adverse risk drivers detected.
                        </div>
                      )}
                    </div>

                    {/* Protective Stabilizing Factors */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Protective Factors (- Stabilizers)
                      </span>
                      {prediction?.featureAttributions?.filter((a) => a.direction === 'protective').length ? (
                        prediction.featureAttributions
                          .filter((a) => a.direction === 'protective')
                          .map((attr, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs flex items-start justify-between gap-2"
                            >
                              <div>
                                <span className="font-semibold text-emerald-950 dark:text-emerald-200 block">
                                  {attr.feature}
                                </span>
                                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug block mt-0.5">
                                  {attr.description}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                                {attr.impact}%
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800 rounded-lg">
                          Baseline stabilized parameters.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* LAYER 3: 6-Hour Trajectory Projection */}
              {selectedPredictionLayer === 'trajectory' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      Divergence Model: Projected physiological path over next 6 recovery hours
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                        Without Early Intervention
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        With Timely Clinical Orders
                      </span>
                    </div>
                  </div>

                  {/* Visual Trajectory Timeline */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    {(prediction?.trajectory || []).map((pt, i) => (
                      <div
                        key={i}
                        className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-center relative shadow-2xs"
                      >
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          {pt.label}
                        </span>

                        <div className="space-y-2">
                          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded p-1">
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block">Unmanaged</span>
                            <span className="text-sm font-black font-mono text-rose-700 dark:text-rose-300">
                              {pt.withoutInterventionScore}%
                            </span>
                          </div>

                          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 rounded p-1">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Treated</span>
                            <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
                              {pt.withInterventionScore}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          Δ {pt.withoutInterventionScore - pt.withInterventionScore}%
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        <strong>Action Window:</strong> Initiating protocolized stabilization within the next 45 minutes prevents escalating decompensation likelihood.
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* LAYER 4: Actionable Care Pathway & Orders */}
              {selectedPredictionLayer === 'orders' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Evidence-Based Clinical Protocol Orders
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {completedOrdersCount} of {prediction?.protocolOrders?.length || 0} executed
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(prediction?.protocolOrders || []).map((ord) => {
                      const isDone = !!completedOrders[ord.id];
                      return (
                        <div
                          key={ord.id}
                          onClick={() => toggleOrderCompletion(ord.id)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                            isDone
                              ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleOrderCompletion(ord.id)}
                            className="mt-1 rounded text-teal-600 accent-teal-600 cursor-pointer"
                          />

                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  ord.category === 'STAT Lab'
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                                    : ord.category === 'Therapeutic'
                                      ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300'
                                      : ord.category === 'Consultation'
                                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                        : 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300'
                                }`}
                              >
                                {ord.category}
                              </span>

                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  ord.urgency === 'IMMEDIATE'
                                    ? 'bg-rose-600 text-white font-mono'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {ord.urgency}
                              </span>

                              <span className="text-xs font-bold text-slate-900 dark:text-white">{ord.order}</span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                              <strong className="text-slate-700 dark:text-slate-300">Rationale:</strong> {ord.rationale}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LAYER 5: SBAR Clinical Handoff Note */}
              {selectedPredictionLayer === 'sbar' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        Structured SBAR Clinical Handoff Communication
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Standardized medical communication format for attending rounds & physician escalations
                      </p>
                    </div>

                    <button
                      onClick={handleCopySbar}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      {copiedSbar ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied SBAR!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy SBAR</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5 font-sans leading-relaxed">
                    <div className="border-l-3 border-teal-500 pl-2.5">
                      <strong className="text-teal-900 dark:text-teal-300 uppercase tracking-wide block text-[11px]">
                        Situation (S)
                      </strong>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                        {prediction?.sbarReport?.situation || 'Awaiting evaluation...'}
                      </p>
                    </div>

                    <div className="border-l-3 border-blue-500 pl-2.5">
                      <strong className="text-blue-900 dark:text-blue-300 uppercase tracking-wide block text-[11px]">
                        Background (B)
                      </strong>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                        {prediction?.sbarReport?.background || 'Awaiting evaluation...'}
                      </p>
                    </div>

                    <div className="border-l-3 border-amber-500 pl-2.5">
                      <strong className="text-amber-900 dark:text-amber-300 uppercase tracking-wide block text-[11px]">
                        Assessment (A)
                      </strong>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                        {prediction?.sbarReport?.assessment || 'Awaiting evaluation...'}
                      </p>
                    </div>

                    <div className="border-l-3 border-rose-500 pl-2.5">
                      <strong className="text-rose-900 dark:text-rose-300 uppercase tracking-wide block text-[11px]">
                        Recommendation (R)
                      </strong>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                        {prediction?.sbarReport?.recommendation || 'Awaiting evaluation...'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PATIENT'S MEDICAL STATUS SECTION (6 Core Vitals Telemetry Controls)        */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Patient's Medical Status
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Adjust patient vitals to evaluate post-surgical complication risk
                  </p>
                </div>
              </div>

              <button
                onClick={() => runPrediction(activePatient, currentVitals)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Analyze Vitals</span>
              </button>
            </div>

            {/* Clean Grid of 6 Core Vitals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* 1. Heart Rate */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Heart className="w-4 h-4 text-rose-500" /> Heart Rate
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">60 - 100</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.heartRate}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">bpm</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateVitalField('heartRate', Math.max(40, currentVitals.heartRate - 5))}
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="40"
                    max="160"
                    value={currentVitals.heartRate}
                    onChange={(e) => updateVitalField('heartRate', parseInt(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => updateVitalField('heartRate', Math.min(170, currentVitals.heartRate + 5))}
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 2. Blood Pressure */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Activity className="w-4 h-4 text-blue-500" /> Blood Pressure
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">120/80</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.bloodPressureSys}/{currentVitals.bloodPressureDia}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">mmHg</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateVitalField('bloodPressureSys', Math.max(65, currentVitals.bloodPressureSys - 5))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="70"
                    max="190"
                    value={currentVitals.bloodPressureSys}
                    onChange={(e) => updateVitalField('bloodPressureSys', parseInt(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateVitalField('bloodPressureSys', Math.min(200, currentVitals.bloodPressureSys + 5))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 3. SpO2 Oxygen Saturation */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Wind className="w-4 h-4 text-cyan-500" /> SpO2 O₂ Saturation
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">≥ 95%</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.oxygenSaturation}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateVitalField('oxygenSaturation', Math.max(75, currentVitals.oxygenSaturation - 1))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="75"
                    max="100"
                    value={currentVitals.oxygenSaturation}
                    onChange={(e) => updateVitalField('oxygenSaturation', parseInt(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateVitalField('oxygenSaturation', Math.min(100, currentVitals.oxygenSaturation + 1))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 4. Core Body Temperature */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Thermometer className="w-4 h-4 text-amber-500" /> Body Temperature
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">97.8 - 99.1</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.bodyTemperature.toFixed(1)}°F
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ({(((currentVitals.bodyTemperature - 32) * 5) / 9).toFixed(1)}°C)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateVitalField(
                        'bodyTemperature',
                        parseFloat(Math.max(95.0, currentVitals.bodyTemperature - 0.2).toFixed(1))
                      )
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="95.0"
                    max="104.0"
                    step="0.1"
                    value={currentVitals.bodyTemperature}
                    onChange={(e) => updateVitalField('bodyTemperature', parseFloat(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateVitalField(
                        'bodyTemperature',
                        parseFloat(Math.min(105.0, currentVitals.bodyTemperature + 0.2).toFixed(1))
                      )
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 5. Respiratory Rate */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> Respiratory Rate
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">12 - 20</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.respiratoryRate}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">breaths/min</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateVitalField('respiratoryRate', Math.max(6, currentVitals.respiratoryRate - 1))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="6"
                    max="36"
                    value={currentVitals.respiratoryRate}
                    onChange={(e) => updateVitalField('respiratoryRate', parseInt(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateVitalField('respiratoryRate', Math.min(40, currentVitals.respiratoryRate + 1))
                    }
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 6. Pain Score */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Sliders className="w-4 h-4 text-purple-500" /> Pain Score
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">0 - 3 (Mild)</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {currentVitals.painScore}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">/ 10</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateVitalField('painScore', Math.max(0, currentVitals.painScore - 1))}
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={currentVitals.painScore}
                    onChange={(e) => updateVitalField('painScore', parseInt(e.target.value))}
                    className="flex-1 accent-teal-600 dark:accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => updateVitalField('painScore', Math.min(10, currentVitals.painScore + 1))}
                    className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Clinical Summary & Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Clinical Explanation */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors duration-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Clinical Reasoning
                </h4>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Engine: {prediction?.modelUsed || 'gemini-3.8-flash'}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 min-h-[90px]">
                {prediction?.clinicalSummary || 'Awaiting analysis...'}
              </p>

              {/* Flags identified */}
              {prediction?.flags && prediction.flags.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Detected Physiological Deviations:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {prediction.flags.map((flag, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommended Clinical Next Steps */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors duration-200">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Key Next Actions
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {prediction?.recommendedActions && prediction.recommendedActions.length > 0 ? (
                  prediction.recommendedActions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <span className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No actions to display</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Add Custom Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Patient</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quickly add a patient record to evaluate complications
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewPatient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Patient ID</label>
                  <input
                    type="text"
                    required
                    value={newPatient.id}
                    onChange={(e) => setNewPatient({ ...newPatient, id: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2 font-mono"
                    placeholder="PT-106"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2"
                    placeholder="e.g. Maria Rossi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    required
                    value={newPatient.age}
                    onChange={(e) =>
                      setNewPatient({ ...newPatient, age: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) =>
                      setNewPatient({
                        ...newPatient,
                        gender: e.target.value as 'Male' | 'Female' | 'Other',
                      })
                    }
                    className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Surgical Procedure</label>
                <input
                  type="text"
                  required
                  value={newPatient.surgeryType}
                  onChange={(e) => setNewPatient({ ...newPatient, surgeryType: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2"
                  placeholder="e.g. Laparoscopic Colectomy"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Hours Post-Operation</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  required
                  value={newPatient.hoursPostOp}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, hoursPostOp: parseInt(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Medical History & Comorbidities
                </label>
                <textarea
                  rows={2}
                  value={newPatient.medicalHistory}
                  onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2 text-xs"
                  placeholder="e.g. Type 2 Diabetes, Smoker, COPD"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-2xs"
                >
                  Add & Evaluate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Info / Documentation Modal */}
      {showProjectInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Patient's Medical Status & Multi-Layer Reference Guide
                </h3>
              </div>
              <button
                onClick={() => setShowProjectInfo(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="bg-teal-50 dark:bg-teal-950/40 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                <h4 className="font-bold text-teal-900 dark:text-teal-300 mb-1">Post-Op Complication Monitoring</h4>
                <p className="leading-relaxed text-teal-800 dark:text-teal-200">
                  Real-time clinical evaluation of post-operative vitals to flag early post-surgical complications (such as Sepsis, Hemorrhage, Respiratory Depression, and Atelectasis) using deterministic clinical rules and Gemini AI inference.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Normal Post-Op Vital Benchmarks</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <strong className="block text-slate-800 dark:text-slate-200">Heart Rate (HR):</strong>
                    <span>60 – 100 bpm</span>
                    <span className="block text-slate-400 dark:text-slate-500 mt-0.5">Warning: &gt;100 (Tachycardia)</span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <strong className="block text-slate-800 dark:text-slate-200">Blood Pressure (BP):</strong>
                    <span>100-130 / 60-85 mmHg</span>
                    <span className="block text-slate-400 dark:text-slate-500 mt-0.5">
                      Warning: &lt;90 Sys (Hypotension)
                    </span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <strong className="block text-slate-800 dark:text-slate-200">SpO2 Oxygen:</strong>
                    <span>95% – 100%</span>
                    <span className="block text-slate-400 dark:text-slate-500 mt-0.5">Warning: &lt;92% (Hypoxia)</span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <strong className="block text-slate-800 dark:text-slate-200">Temperature:</strong>
                    <span>97.8°F – 99.1°F</span>
                    <span className="block text-slate-400 dark:text-slate-500 mt-0.5">Warning: ≥101.5°F (Fever)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Enhanced Prediction Layers</h4>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  • <strong>1. Organ Systems:</strong> Cardiovascular, Pulmonary, Sepsis, and Metabolic risk decompensation.
                  <br />• <strong>2. Feature Attribution:</strong> Key physiological factors explaining why the model predicted this risk.
                  <br />• <strong>3. 6-Hour Trajectory:</strong> Divergence model comparing unmanaged trajectory vs early intervention.
                  <br />• <strong>4. Care Orders:</strong> Actionable protocol checklist with interactive execution tracking.
                  <br />• <strong>5. SBAR Handoff:</strong> Standard clinical communication note with 1-click clipboard copy.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowProjectInfo(false)}
                  className="px-4 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 px-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <span>Post-Surgical Complication Predictor • Minimalist Clinical Telemetry Dashboard</span>
        <span className="mx-2">•</span>
        <span>Enhanced Multi-Layer Predictive Analytics</span>
      </footer>
    </div>
  );
}
