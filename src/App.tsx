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
} from 'lucide-react';
import { Patient, PatientVitals, PredictionResult, RiskLevel } from './types';

// Default initial test cases if backend is starting
const INITIAL_DEMO_PATIENTS: Patient[] = [
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

  // Active selected patient
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

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
        console.log('Using local fallback demo data:', err);
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
      // Client-side fallback rule engine in case backend is interrupted
      const localResult = localRuleEngine(patientToPredict, vitalsToPredict);
      setPrediction(localResult);
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback heuristic scoring
  const localRuleEngine = (patient: Patient, vitals: PatientVitals): PredictionResult => {
    let score = 15;
    const flags: string[] = [];
    const complications: string[] = [];

    if (vitals.heartRate > 120) {
      score += 35;
      flags.push(`Severe Tachycardia (${vitals.heartRate} bpm)`);
    } else if (vitals.heartRate > 100) {
      score += 20;
      flags.push(`Tachycardia (${vitals.heartRate} bpm)`);
    } else if (vitals.heartRate < 50) {
      score += 25;
      flags.push(`Bradycardia (${vitals.heartRate} bpm)`);
    }

    if (vitals.bloodPressureSys < 90) {
      score += 40;
      flags.push(`Hypotension (${vitals.bloodPressureSys} mmHg)`);
      complications.push('Internal Hemorrhage / Hypovolemia');
    }

    if (vitals.oxygenSaturation < 90) {
      score += 40;
      flags.push(`Hypoxia (SpO2 ${vitals.oxygenSaturation}%)`);
      complications.push('Atelectasis / Respiratory Distress');
    } else if (vitals.oxygenSaturation < 94) {
      score += 15;
      flags.push(`Suboptimal Oxygenation (${vitals.oxygenSaturation}%)`);
    }

    if (vitals.bodyTemperature >= 101.5) {
      score += 35;
      flags.push(`High Fever (${vitals.bodyTemperature}°F)`);
      complications.push('Surgical Site Infection / Early Sepsis');
    } else if (vitals.bodyTemperature >= 100.4) {
      score += 15;
      flags.push(`Low-grade Fever (${vitals.bodyTemperature}°F)`);
    }

    if (vitals.respiratoryRate > 24) {
      score += 25;
      flags.push(`Tachypnea (${vitals.respiratoryRate} bpm)`);
    } else if (vitals.respiratoryRate < 10) {
      score += 35;
      flags.push(`Respiratory Depression (${vitals.respiratoryRate} bpm)`);
      complications.push('Opioid-Induced Hypoventilation');
    }

    const finalScore = Math.min(99, Math.max(5, score));
    let level: RiskLevel = 'LOW';
    if (finalScore >= 70 || vitals.bloodPressureSys < 85 || vitals.oxygenSaturation < 90) {
      level = 'CRITICAL';
    } else if (finalScore >= 45) {
      level = 'HIGH';
    } else if (finalScore >= 25) {
      level = 'MODERATE';
    }

    return {
      patientId: patient.id,
      timestamp: new Date().toISOString(),
      riskLevel: level,
      riskScore: finalScore,
      primaryComplications:
        complications.length > 0 ? complications : ['Normal Post-Surgical Recovery'],
      clinicalSummary: `Evaluated vitals for ${patient.name}. ${flags.length > 0 ? 'Active deviations identified: ' + flags.join(', ') : 'Vitals are within expected baseline range.'}`,
      flags,
      recommendedActions:
        level === 'CRITICAL'
          ? ['Alert surgeon immediately', 'Initiate emergency protocol', 'Repeat vitals in 5 mins']
          : level === 'HIGH'
            ? ['Notify charge nurse / resident', 'Check surgical dressing', 'Supplemental oxygen']
            : ['Continue standard 4-hour vitals schedule', 'Encourage deep breathing exercises'],
      modelUsed: 'clinical-heuristics-engine',
    };
  };

  // Live biometric stream toggle
  useEffect(() => {
    if (isLiveStreaming) {
      liveTimerRef.current = setInterval(() => {
        setCurrentVitals((prev) => {
          // Add subtle natural physiological drift
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

  // Handle direct slider / input changes
  const updateVitalField = (field: keyof PatientVitals, val: number) => {
    const updated = { ...currentVitals, [field]: val };
    setCurrentVitals(updated);
  };

  // Quick Preset buttons for demo testing
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
        bloodPressureSys: 132,
        bloodPressureDia: 82,
        oxygenSaturation: 93,
        bodyTemperature: 102.1,
        respiratoryRate: 24,
        painScore: 5,
      };
    } else if (preset === 'bleed') {
      presetVitals = {
        heartRate: 130,
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
        oxygenSaturation: 87,
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

  // Risk styling helpers
  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'LOW':
        return {
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
          badge: 'bg-emerald-600 text-white',
          border: 'border-emerald-500',
          bar: 'bg-emerald-500',
          iconColor: 'text-emerald-600',
        };
      case 'MODERATE':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          badge: 'bg-amber-500 text-white',
          border: 'border-amber-500',
          bar: 'bg-amber-500',
          iconColor: 'text-amber-600',
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-300',
          badge: 'bg-orange-600 text-white',
          border: 'border-orange-500',
          bar: 'bg-orange-600',
          iconColor: 'text-orange-600',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-50 text-rose-900 border-rose-300',
          badge: 'bg-rose-600 text-white animate-pulse',
          border: 'border-rose-600',
          bar: 'bg-rose-600',
          iconColor: 'text-rose-600',
        };
      default:
        return {
          bg: 'bg-gray-50 text-gray-900 border-gray-200',
          badge: 'bg-gray-600 text-white',
          border: 'border-gray-400',
          bar: 'bg-gray-400',
          iconColor: 'text-gray-600',
        };
    }
  };

  const riskTheme = getRiskColor(prediction?.riskLevel || 'LOW');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Post-Op Complication Predictor
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  1st Year College Project
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI Electronic Health Record & Real-time Biometric Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live stream switch */}
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isLiveStreaming
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Simulates real-time telemetry updates every 3 seconds"
            >
              {isLiveStreaming ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                  <span>Stop Biometric Stream</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-1" />
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-slate-600 text-slate-600" />
                  <span>Start Live Stream</span>
                </>
              )}
            </button>

            {/* Quick Info & Guide */}
            <button
              onClick={() => setShowProjectInfo(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="Project Documentation & Vital Guidelines"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Print/Export */}
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1.5 text-xs text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
              title="Print Summary Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Database & Patient EHR (4 cols on lg) */}
        <section className="lg:col-span-4 space-y-4">
          {/* Patient Selector Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                  Patients
                </h2>
                <p className="text-xs text-slate-500">
                  {patients.length} active patients loaded
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
                <button
                  onClick={handleResetDatabase}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                  title="Reset patient list to defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Patients list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {patients.map((p) => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/70 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 border border-slate-200">
                          {p.id}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.age}y • {p.gender[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1 max-w-[210px]">
                        {p.surgeryType}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {p.hoursPostOp}h post-op
                        </span>
                        <span>•</span>
                        <span>HR: {p.vitals.heartRate}</span>
                        <span>•</span>
                        <span>SpO2: {p.vitals.oxygenSaturation}%</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Electronic Health Record (EHR) Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-indigo-50 text-indigo-700">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-slate-800">Selected Patient EHR</h3>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {activePatient.id}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Patient Name</span>
                  <span className="font-semibold text-slate-800 text-sm">{activePatient.name}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Age & Gender</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {activePatient.age} yrs • {activePatient.gender}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px] mb-0.5">Surgical Procedure</span>
                <span className="font-medium text-slate-900">{activePatient.surgeryType}</span>
                <div className="flex items-center gap-1.5 mt-1 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Elapsed Recovery: </span>
                  <strong className="text-slate-800">{activePatient.hoursPostOp} hours</strong>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px] mb-0.5">
                  Pre-Existing Conditions & Risk Factors
                </span>
                <p className="text-slate-700 font-normal leading-relaxed">
                  {activePatient.medicalHistory}
                </p>
              </div>
            </div>

            {/* Quick Testing Presets */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 block mb-2 uppercase tracking-wider">
                Simulate Clinical Scenarios
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyPreset('normal')}
                  className="px-2 py-1.5 text-xs text-left bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
                >
                  🟢 Normal Recovery
                </button>
                <button
                  onClick={() => applyPreset('sepsis')}
                  className="px-2 py-1.5 text-xs text-left bg-orange-50 text-orange-800 hover:bg-orange-100 rounded-md border border-orange-200 transition-colors"
                >
                  🟠 Sepsis / Infection
                </button>
                <button
                  onClick={() => applyPreset('bleed')}
                  className="px-2 py-1.5 text-xs text-left bg-rose-50 text-rose-800 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors"
                >
                  🔴 Internal Bleed (Shock)
                </button>
                <button
                  onClick={() => applyPreset('hypoxia')}
                  className="px-2 py-1.5 text-xs text-left bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                >
                  🔵 Respiratory Hypoxia
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Center / Right Columns: Biometrics & AI Prediction Result (8 cols on lg) */}
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
                      <span className="text-xs flex items-center gap-1 text-slate-600 bg-white/70 px-2 py-0.5 rounded-full">
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
              <div className="bg-white/90 backdrop-blur-xs px-4 py-2 rounded-xl border border-slate-200/60 shadow-2xs text-right min-w-[150px]">
                <div className="text-[11px] text-slate-500 font-medium">Estimated Probability</div>
                <div className="text-2xl font-black text-slate-900">
                  {prediction?.riskScore || 0}%
                </div>
                {/* Visual bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${riskTheme.bar} transition-all duration-500`}
                    style={{ width: `${prediction?.riskScore || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Suspected Complications Tags */}
            {prediction && prediction.primaryComplications.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Suspected Conditions:</span>
                {prediction.primaryComplications.map((comp, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 shadow-2xs"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Biometrics Monitor & Interactive Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-rose-50 text-rose-600">
                  <Heart className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Real-Time Biometric Vitals
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Adjust values below or toggle live stream to test risk sensitivity
                  </p>
                </div>
              </div>

              <button
                onClick={() => runPrediction(activePatient, currentVitals)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Analyze Vitals</span>
              </button>
            </div>

            {/* Vitals Grid - 6 Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* 1. Heart Rate */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.heartRate > 100 || currentVitals.heartRate < 55
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Heart Rate
                  </span>
                  <span className="text-[10px] text-slate-400">60-100</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.heartRate}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">bpm</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={currentVitals.heartRate}
                  onChange={(e) => updateVitalField('heartRate', parseInt(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* 2. Blood Pressure */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.bloodPressureSys < 90 || currentVitals.bloodPressureSys > 150
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Activity className="w-3.5 h-3.5 text-blue-500" /> Blood Pressure
                  </span>
                  <span className="text-[10px] text-slate-400">120/80</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.bloodPressureSys}/{currentVitals.bloodPressureDia}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">mmHg</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="190"
                  value={currentVitals.bloodPressureSys}
                  onChange={(e) => updateVitalField('bloodPressureSys', parseInt(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* 3. SpO2 Oxygen */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.oxygenSaturation < 93
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Wind className="w-3.5 h-3.5 text-cyan-500" /> SpO2 O₂ Saturation
                  </span>
                  <span className="text-[10px] text-slate-400">≥95%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.oxygenSaturation}%
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      currentVitals.oxygenSaturation >= 95
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {currentVitals.oxygenSaturation >= 95 ? 'Normal' : 'Low'}
                  </span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="100"
                  value={currentVitals.oxygenSaturation}
                  onChange={(e) => updateVitalField('oxygenSaturation', parseInt(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* 4. Body Temperature */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.bodyTemperature >= 100.4 || currentVitals.bodyTemperature < 96.5
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Temperature
                  </span>
                  <span className="text-[10px] text-slate-400">97.8-99.1</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.bodyTemperature.toFixed(1)}°F
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({(((currentVitals.bodyTemperature - 32) * 5) / 9).toFixed(1)}°C)
                  </span>
                </div>
                <input
                  type="range"
                  min="95.0"
                  max="104.0"
                  step="0.1"
                  value={currentVitals.bodyTemperature}
                  onChange={(e) => updateVitalField('bodyTemperature', parseFloat(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* 5. Respiratory Rate */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.respiratoryRate > 22 || currentVitals.respiratoryRate < 10
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Respiration
                  </span>
                  <span className="text-[10px] text-slate-400">12-20</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.respiratoryRate}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">breaths/min</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="36"
                  value={currentVitals.respiratoryRate}
                  onChange={(e) => updateVitalField('respiratoryRate', parseInt(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* 6. Pain Score */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  currentVitals.painScore >= 7
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-purple-500" /> Pain Level
                  </span>
                  <span className="text-[10px] text-slate-400">0 - 10</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {currentVitals.painScore} / 10
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      currentVitals.painScore <= 3
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentVitals.painScore <= 6
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {currentVitals.painScore <= 3
                      ? 'Mild'
                      : currentVitals.painScore <= 6
                        ? 'Moderate'
                        : 'Severe'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={currentVitals.painScore}
                  onChange={(e) => updateVitalField('painScore', parseInt(e.target.value))}
                  className="w-full mt-2 accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* AI Clinical Summary & Actionable Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Clinical Explanation */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                  Clinical Reasoning
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  Engine: {prediction?.modelUsed || 'Gemini 3.8 Flash'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[90px]">
                {prediction?.clinicalSummary || 'Awaiting analysis...'}
              </p>

              {/* Flags identified */}
              {prediction?.flags && prediction.flags.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Detected Physiological Deviations:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {prediction.flags.map((flag, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommended Clinical Next Steps */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                Recommended Actions
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {prediction?.recommendedActions && prediction.recommendedActions.length > 0 ? (
                  prediction.recommendedActions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100"
                    >
                      <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Patient to Test Database</h3>
                <p className="text-xs text-slate-500">
                  Quickly add a patient record to evaluate complications
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewPatient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Patient ID</label>
                  <input
                    type="text"
                    required
                    value={newPatient.id}
                    onChange={(e) => setNewPatient({ ...newPatient, id: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    placeholder="PT-106"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                    placeholder="e.g. Maria Rossi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    required
                    value={newPatient.age}
                    onChange={(e) =>
                      setNewPatient({ ...newPatient, age: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) =>
                      setNewPatient({
                        ...newPatient,
                        gender: e.target.value as 'Male' | 'Female' | 'Other',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Surgical Procedure</label>
                <input
                  type="text"
                  required
                  value={newPatient.surgeryType}
                  onChange={(e) => setNewPatient({ ...newPatient, surgeryType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  placeholder="e.g. Laparoscopic Colectomy"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Hours Post-Operation
                </label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  required
                  value={newPatient.hoursPostOp}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, hoursPostOp: parseInt(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Medical History & Comorbidities
                </label>
                <textarea
                  rows={2}
                  value={newPatient.medicalHistory}
                  onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  placeholder="e.g. Type 2 Diabetes, Smoker, COPD"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-teal-50 text-teal-700">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Student Project Guide & Clinical Vitals Reference
                </h3>
              </div>
              <button
                onClick={() => setShowProjectInfo(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
                <h4 className="font-bold text-teal-900 mb-1">Project Purpose</h4>
                <p className="leading-relaxed text-teal-800">
                  Built as a clean and simplistic demonstration of post-operative risk
                  stratification. Uses basic electronic health record (EHR) data combined with
                  biometric vitals to flag early post-surgical complications (e.g., Sepsis,
                  Hemorrhage, Respiratory Depression, and Atelectasis).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Normal Post-Op Vital Benchmarks</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded border border-slate-200 bg-slate-50">
                    <strong className="block text-slate-800">Heart Rate (HR):</strong>
                    <span>60 – 100 bpm</span>
                    <span className="block text-slate-400 mt-0.5">Warning: &gt;100 (Tachycardia)</span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 bg-slate-50">
                    <strong className="block text-slate-800">Blood Pressure (BP):</strong>
                    <span>100-130 / 60-85 mmHg</span>
                    <span className="block text-slate-400 mt-0.5">
                      Warning: &lt;90 Sys (Hypotension)
                    </span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 bg-slate-50">
                    <strong className="block text-slate-800">SpO2 Oxygen:</strong>
                    <span>95% – 100%</span>
                    <span className="block text-slate-400 mt-0.5">Warning: &lt;92% (Hypoxia)</span>
                  </div>
                  <div className="p-2 rounded border border-slate-200 bg-slate-50">
                    <strong className="block text-slate-800">Temperature:</strong>
                    <span>97.8°F – 99.1°F</span>
                    <span className="block text-slate-400 mt-0.5">Warning: ≥101.5°F (Fever)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Architecture</h4>
                <p className="text-slate-600 leading-relaxed">
                  • <strong>Backend:</strong> Express server with an in-memory sample database and
                  Gemini 3.8 Flash inference with deterministic clinical rule fallback.
                  <br />• <strong>Frontend:</strong> Clean React with Tailwind CSS, real-time
                  telemetry simulator, and interactive vital test sliders.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowProjectInfo(false)}
                  className="px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-500">
        <span>Post-Surgical Complication Predictor • Minimalist Clinical Telemetry Dashboard</span>
        <span className="mx-2">•</span>
        <span>Simulated EHR Database & Biometric Stream</span>
      </footer>
    </div>
  );
}
