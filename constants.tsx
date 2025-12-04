import React from 'react';
import { Users, Calendar, Settings, ShieldCheck, Download, Trash2, Plus, UserPlus, FileSpreadsheet, AlertTriangle, CheckSquare, Heart, Upload, FileDown, Info, Stethoscope, DoorOpen } from 'lucide-react';

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
    Room: <DoorOpen className="w-4 h-4" />
};

// Kullanıcı isteği üzerine varsayılan personel listesi BOŞALTILDI.
// "Sıfırla" dendiğinde artık boş liste gelecek.
export const MOCK_STAFF = [] as const;

export const MOCK_SERVICES = [
  { id: 's1', name: 'Genel Cerrahi Nöbeti', minDailyCount: 2, maxDailyCount: 2, allowedRoles: [1, 2, 3], allowedUnits: ['Genel Cerrahi'], preferredGroup: 'Farketmez', isEmergency: false },
  { id: 's2', name: 'KBB Nöbeti', minDailyCount: 2, maxDailyCount: 2, allowedRoles: [1, 2, 3], allowedUnits: ['KBB'], preferredGroup: 'Farketmez', isEmergency: false },
  { id: 's3', name: 'Beyin/Ortopedi Nöbeti', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], allowedUnits: ['Beyin ve Ortopedi'], preferredGroup: 'Farketmez', isEmergency: false },
  { id: 's4', name: 'Plastik Nöbeti', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], allowedUnits: ['Plastik'], preferredGroup: 'Farketmez', isEmergency: false },
] as const;