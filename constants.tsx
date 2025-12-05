
import React from 'react';
import { Users, Calendar, Settings, ShieldCheck, Download, Trash2, Plus, UserPlus, FileSpreadsheet, AlertTriangle, CheckSquare, Heart, Upload, FileDown, Info, Stethoscope, DoorOpen, Star, Layout, Save, FileJson } from 'lucide-react';
import { UnitConstraint, Preset, Staff, Service } from './types';

export const ICONS = {
    Users: <Users className="w-5 h-5" />,
    Calendar: <Calendar className="w-5 h-5" />,
    Settings: <Settings className="w-5 h-5" />,
    Shield: <ShieldCheck className="w-5 h-5" />,
    Download: <Download className="w-5 h-5" />,
    Upload: <Upload className="w-4 h-4" />,
    Template: <FileDown className="w-4 h-4" />,
    Trash: <Trash2 className="w-4 h-4" />,
    Plus: <Plus className="w-4 h-4" />,
    UserPlus: <UserPlus className="w-5 h-5" />,
    Excel: <FileSpreadsheet className="w-5 h-5" />,
    Alert: <AlertTriangle className="w-5 h-5" />,
    Check: <CheckSquare className="w-4 h-4" />,
    Heart: <Heart className="w-4 h-4" />,
    Info: <Info className="w-5 h-5" />,
    Unit: <Stethoscope className="w-4 h-4" />,
    Room: <DoorOpen className="w-4 h-4" />,
    Star: <Star className="w-4 h-4" />,
    Preset: <Layout className="w-4 h-4" />,
    Save: <Save className="w-4 h-4" />,
    FileJson: <FileJson className="w-4 h-4" />
};

export const MOCK_STAFF = [] as const;

export const MOCK_SERVICES = [
  // Genel Cerrahi: Min 2, Max 2.
  { 
      id: 's1', 
      name: 'Genel Cerrahi Nöbeti', 
      minDailyCount: 2, 
      maxDailyCount: 2, 
      allowedUnits: ['Genel Cerrahi']
  },
  { id: 's2', name: 'KBB Nöbeti', minDailyCount: 2, maxDailyCount: 2, allowedUnits: ['KBB'] },
  { id: 's3', name: 'Beyin/Ortopedi Nöbeti', minDailyCount: 1, maxDailyCount: 1, allowedUnits: ['Beyin ve Ortopedi'] },
  { id: 's4', name: 'Plastik Nöbeti', minDailyCount: 1, maxDailyCount: 1, allowedUnits: ['Plastik'] },
] as const;

export const DEFAULT_UNIT_CONSTRAINTS: UnitConstraint[] = [
    { unit: 'Transplantasyon', allowedDays: [6] }, // Özellik Adı: Transplantasyon -> Cmt
    { unit: 'Yara Bakım', allowedDays: [5] }       // Özellik Adı: Yara Bakım -> Cuma
];

// --- PRESETS ---
// Hardcoded presets removed. Users will manage their own presets via LocalStorage.
export const PRESET_OPTIONS: Preset[] = [];
