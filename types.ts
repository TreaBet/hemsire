

export type Role = number; // 1 (Kıdemli), 2 (Orta), 3 (Yeni/Çömez)
export type Specialty = string; // Changed from union to string for dynamic support

export interface Staff {
  id: string;
  name: string;
  role: number; // 1: Sorumlu/Kıdemli, 2: Tecrübeli, 3: Yeni Başlayan
  unit: string; // Branş: 'Genel Cerrahi', 'KBB' vb.
  specialty?: Specialty; // 'none', 'Transplantasyon', 'Yara Bakım' vb.
  room: string; // Salon No / Oda No
  quotaService: number; // Aylık Toplam Nöbet Hedefi
  weekendLimit: number; // Haftasonu Limiti
  offDays: number[]; // İzinli Günler
  requestedDays: number[]; // Nöbet İsteği
  isActive: boolean; // Listeye dahil mi?
}

export interface UnitConstraint {
    unit: string; // Can be a Unit name OR a Specialty name
    allowedDays: number[]; // 0=Pazar, 1=Pzt, ..., 6=Cmt
}

export interface RoleConfig {
  role: number;
  quotaService: number;
  weekendLimit: number;
}

export interface Service {
  id: string;
  name: string;
  minDailyCount: number; 
  maxDailyCount: number;
  allowedUnits?: string[]; // Sadece bu branşlar buraya yazılabilir (Boşsa herkes)
}

export interface ShiftAssignment {
  serviceId: string;
  staffId: string;
  staffName: string;
  role: number;
  unit: string;
}

export interface DaySchedule {
  day: number;
  assignments: ShiftAssignment[];
  isWeekend: boolean;
}

export interface Stats {
    staffId: string;
    totalShifts: number;
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
  unitConstraints: UnitConstraint[];
  dailyTotalTarget: number; // GÜNLÜK TOPLAM NÖBETÇİ HEDEFİ
}