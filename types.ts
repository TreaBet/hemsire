
export type Role = number; // 1 (Kıdemli), 2 (Orta), 3 (Yeni/Çömez)
export type Group = 'A' | 'B' | 'C' | 'D' | 'Genel';

export interface Staff {
  id: string;
  name: string;
  role: number; // 1: Sorumlu/Kıdemli, 2: Tecrübeli, 3: Yeni Başlayan
  unit: string; // Branş: 'Genel Cerrahi', 'KBB', 'Plastik', 'Transplantasyon', 'Yara', vb.
  room: string; // Salon No / Oda No: Çakışma kontrolü için (Örn: "Salon 1")
  group: Group; // Nöbet Grubu (Opsiyonel, A/B/C/D)
  quotaService: number; // Aylık Toplam Nöbet Hedefi
  quotaEmergency: number; // Kullanılmıyor (Eski yapıdan kaldı, 0 geçilebilir)
  weekendLimit: number; // Haftasonu Limiti
  offDays: number[]; // İzinli Günler
  requestedDays: number[]; // Nöbet İsteği
  isActive: boolean; // Listeye dahil mi?
}

export interface RoleConfig {
  role: number;
  quotaService: number;
  quotaEmergency: number;
  weekendLimit: number;
}

export interface Service {
  id: string;
  name: string;
  minDailyCount: number; 
  maxDailyCount: number;
  allowedRoles: number[]; 
  priorityRoles?: number[];
  allowedUnits?: string[]; // Sadece bu branşlar buraya yazılabilir (Boşsa herkes)
  preferredGroup?: Group | 'Farketmez';
  isEmergency: boolean; 
}

export interface ShiftAssignment {
  serviceId: string;
  staffId: string;
  staffName: string;
  role: number;
  group: Group;
  unit: string;
  isEmergency: boolean;
}

export interface DaySchedule {
  day: number;
  assignments: ShiftAssignment[];
  isWeekend: boolean;
}

export interface Stats {
    staffId: string;
    totalShifts: number;
    serviceShifts: number;
    emergencyShifts: number;
    weekendShifts: number;
    saturdayShifts: number;
    sundayShifts: number;
}

export interface ScheduleResult {
  schedule: DaySchedule[];
  unfilledSlots: number;
  logs: string[]; 
  stats: Stats[];
}

export interface SchedulerConfig {
  year: number;
  month: number; 
  maxRetries: number;
  randomizeOrder: boolean; 
  preventEveryOtherDay: boolean; 
}
