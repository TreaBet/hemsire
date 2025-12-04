
import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment } from '../types';

interface CandidateOptions {
    desperate?: boolean;
    restrictRole?: number;
    excludeRole?: number;
}

export class Scheduler {
  private staff: Staff[];
  private services: Service[];
  private config: SchedulerConfig;
  private daysInMonth: number;
  private logs: string[] = [];
  
  // Cache
  private roommatesMap: Map<string, string[]> = new Map(); // StaffID -> RoommateIDs

  constructor(staff: Staff[], services: Service[], config: SchedulerConfig) {
    this.staff = staff.filter(s => s.isActive !== false); 
    this.services = services;
    this.config = config;
    this.daysInMonth = new Date(config.year, config.month + 1, 0).getDate();
    
    this.analyzeRoommates();
  }

  private analyzeRoommates() {
      // Group staff by Room
      const roomGroups = new Map<string, string[]>();
      this.staff.forEach(s => {
          // Eğer oda no boşsa (Aracı vb.), kimseyle çakışmaz.
          if (!s.room || s.room.trim() === '') return;
          
          if (!roomGroups.has(s.room)) roomGroups.set(s.room, []);
          roomGroups.get(s.room)!.push(s.id);
      });

      // Map each staff to their roommates
      this.staff.forEach(s => {
          if (s.room && s.room.trim() !== '') {
              const roommates = roomGroups.get(s.room)!.filter(id => id !== s.id);
              this.roommatesMap.set(s.id, roommates);
          } else {
              this.roommatesMap.set(s.id, []);
          }
      });
  }

  private isWeekend(day: number): boolean {
    const date = new Date(this.config.year, this.config.month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; 
  }

  private getDayOfWeek(day: number): number {
    return new Date(this.config.year, this.config.month, day).getDay(); // 0=Sun, 6=Sat, 5=Fri, 4=Thu
  }

  private log(message: string) {
    if (this.logs.length < 1000) this.logs.push(message);
  }

  // Zorluk derecesine göre servisleri sırala
  private getServiceDifficulty(service: Service): number {
      let score = 1000;
      // Az kişinin tutabildiği servisler daha zor
      if (service.allowedUnits && service.allowedUnits.length > 0) {
          const eligible = this.staff.filter(s => service.allowedUnits?.includes(s.unit)).length;
          score -= (eligible * 10);
      }
      return score;
  }

  public generate(): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let minUnfilled = Infinity;
    let bestDeviation = Infinity;

    // Retry loop
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      this.logs = []; 
      const currentResult = this.runSimulation(attempt);
      
      const totalDeviation = currentResult.stats.reduce((acc, s) => {
        const staffDef = this.staff.find(st => st.id === s.staffId);
        if (!staffDef) return acc;
        return acc + Math.abs(staffDef.quotaService - s.serviceShifts);
      }, 0);

      if (currentResult.unfilledSlots < minUnfilled) {
        minUnfilled = currentResult.unfilledSlots;
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      } else if (currentResult.unfilledSlots === minUnfilled && totalDeviation < bestDeviation) {
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      }
    }

    if (!bestResult) throw new Error("Could not generate a schedule");
    return bestResult;
  }

  private hasShiftOnDay(assignmentsMap: Map<number, ShiftAssignment[]>, day: number, staffId: string): boolean {
    const assignments = assignmentsMap.get(day);
    if (!assignments) return false;
    return assignments.some(a => a.staffId === staffId);
  }

  private runSimulation(attemptIndex: number): ScheduleResult {
    const dayAssignmentsMap = new Map<number, ShiftAssignment[]>();
    for(let d=1; d<=this.daysInMonth; d++) dayAssignmentsMap.set(d, []);

    const staffStats = new Map<string, { total: number, service: number, emergency: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, service: 0, emergency: 0, weekend: 0, saturday: 0, sunday: 0 }));

    let unfilledSlots = 0;
    let daysToProcess = Array.from({length: this.daysInMonth}, (_, i) => i + 1);
    
    if (this.config.randomizeOrder) {
        daysToProcess.sort(() => Math.random() - 0.5);
    } 

    for (const day of daysToProcess) {
      const dayOfWeek = this.getDayOfWeek(day);
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
      const isSat = dayOfWeek === 6;
      const isSun = dayOfWeek === 0;
      const isFri = dayOfWeek === 5;

      const currentDayAssignments = dayAssignmentsMap.get(day)!;
      const assignedTodayIds = new Set<string>();

      let seniorAssignedToday = false;

      // --- PHASE 1: ASSIGN 1 SENIOR (ROLE 1) GLOBALLY ---
      // We shuffle services so the "Senior" slot rotates among units (Gen Surg, ENT, etc.)
      // instead of always going to the "hardest" service first.
      const shuffledServicesForSenior = [...this.services].sort(() => Math.random() - 0.5);

      for (const service of shuffledServicesForSenior) {
          if (seniorAssignedToday) break; // Only 1 per day across ALL services
          
          // Check if this service accepts seniors (Role 1)
          if (!service.allowedRoles.includes(1)) continue;

          // Check if we need to assign someone here at all (Min > 0)
          if (service.minDailyCount <= 0) continue;

          const seniorCandidate = this.findBestCandidate(
              service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
              isWeekend, isSat, isSun, isFri, 
              { restrictRole: 1 } // FORCE SENIOR
          );

          if (seniorCandidate) {
             currentDayAssignments.push({
                serviceId: service.id,
                staffId: seniorCandidate.id,
                staffName: seniorCandidate.name,
                role: seniorCandidate.role,
                group: seniorCandidate.group,
                unit: seniorCandidate.unit,
                isEmergency: service.isEmergency
             });
             assignedTodayIds.add(seniorCandidate.id);
             
             const stats = staffStats.get(seniorCandidate.id)!;
             stats.total++;
             stats.service++;
             if (isWeekend) stats.weekend++;
             if (isSat) stats.saturday++;
             if (isSun) stats.sunday++;

             seniorAssignedToday = true;
          }
      }

      // --- PHASE 2: FILL REMAINING SLOTS ---
      // Now we sort by difficulty to ensure hard-to-fill slots get priority for remaining staff
      const dailyServices = [...this.services].sort((a, b) => this.getServiceDifficulty(b) - this.getServiceDifficulty(a));

      for (const service of dailyServices) {
        // Count how many people assigned to this service so far (could be 1 if senior was placed here)
        let currentServiceCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;

        for (let i = currentServiceCount; i < service.minDailyCount; i++) {
          
          // CRITICAL: If a senior was assigned in Phase 1, we BAN seniors in Phase 2.
          // If NO senior was assigned (rare, but possible if all off), we allow seniors to fill slots but prioritize them?
          // Actually, if Phase 1 failed, it means no Role 1 was available for ANY service. 
          // So excluding them here doesn't hurt, or including them doesn't matter.
          // We strictly exclude Role 1 if seniorAssignedToday is true.
          
          let bestCandidate = this.findBestCandidate(
              service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
              isWeekend, isSat, isSun, isFri, 
              { excludeRole: seniorAssignedToday ? 1 : undefined } 
          );

          // Desperation Phase
          if (!bestCandidate && currentServiceCount < service.minDailyCount) {
              bestCandidate = this.findBestCandidate(
                  service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                  isWeekend, isSat, isSun, isFri, 
                  { 
                      desperate: true,
                      excludeRole: seniorAssignedToday ? 1 : undefined 
                  }
              );
          }

          if (bestCandidate) {
            currentDayAssignments.push({
              serviceId: service.id,
              staffId: bestCandidate.id,
              staffName: bestCandidate.name,
              role: bestCandidate.role,
              group: bestCandidate.group,
              unit: bestCandidate.unit,
              isEmergency: service.isEmergency
            });
            assignedTodayIds.add(bestCandidate.id);
            
            const stats = staffStats.get(bestCandidate.id)!;
            stats.total++;
            stats.service++;
            if (isWeekend) stats.weekend++;
            if (isSat) stats.saturday++;
            if (isSun) stats.sunday++;

            currentServiceCount++;

            // If we somehow assigned a senior here (e.g. Phase 1 failed, but Phase 2 found one - rare logic gap), mark it.
            if (bestCandidate.role === 1) seniorAssignedToday = true;

          } else {
             // Fill with EMPTY only if we are below min count
             if (currentDayAssignments.filter(a => a.serviceId === service.id).length < service.minDailyCount) {
                 unfilledSlots++;
                 currentDayAssignments.push({
                    serviceId: service.id,
                    staffId: 'EMPTY',
                    staffName: `BOŞ (Min:${service.minDailyCount})`,
                    role: 0,
                    group: 'Genel',
                    unit: '-',
                    isEmergency: service.isEmergency
                 });
             }
          }
        }
      }
    }

    const schedule: DaySchedule[] = [];
    for(let d=1; d<=this.daysInMonth; d++) {
        schedule.push({
            day: d,
            assignments: dayAssignmentsMap.get(d) || [],
            isWeekend: this.isWeekend(d)
        });
    }

    return {
      schedule,
      unfilledSlots,
      logs: this.logs,
      stats: Array.from(staffStats.entries()).map(([id, s]) => ({
        staffId: id,
        totalShifts: s.total,
        serviceShifts: s.service,
        emergencyShifts: s.emergency,
        weekendShifts: s.weekend,
        saturdayShifts: s.saturday,
        sundayShifts: s.sunday
      }))
    };
  }

  private findBestCandidate(
      service: Service, 
      day: number, 
      assignedTodayIds: Set<string>, 
      dayAssignmentsMap: Map<number, ShiftAssignment[]>,
      staffStats: Map<string, any>,
      isWeekend: boolean, isSat: boolean, isSun: boolean, isFri: boolean,
      options: CandidateOptions
  ): Staff | null {
      
      const dayOfWeek = this.getDayOfWeek(day); 
      const desperateMode = options.desperate || false;

      const candidates = this.staff.filter(person => {
          // --- ROLE FILTERS ---
          if (options.restrictRole !== undefined && person.role !== options.restrictRole) return false;
          if (options.excludeRole !== undefined && person.role === options.excludeRole) return false;

          // --- HARD CONSTRAINTS (NEVER COMPROMISE) ---
          
          // 1. Availability
          if (assignedTodayIds.has(person.id)) return false;
          if (person.offDays.includes(day)) return false;

          // 2. Strict 24h Shift Rule: No shift on Day T-1 or Day T+1
          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;

          // 3. Unit Matching (Branş)
          // Exception: Role 3 (Yeni/Çömez) can work anywhere (Joker)
          const isNewNurse = person.role === 3;
          if (!isNewNurse && service.allowedUnits && service.allowedUnits.length > 0) {
              if (!service.allowedUnits.includes(person.unit)) return false;
          }

          // 4. ROOMMATE CONFLICTS (CRITICAL)
          const roommates = this.roommatesMap.get(person.id) || [];
          for (const roommateId of roommates) {
              // Rule A: Roommate cannot work on the same day (Same Salon Conflict)
              if (assignedTodayIds.has(roommateId)) return false;

              // Rule B: "Nöbet ertesi olanın oda arkadaşına nöbet yazma"
              // Eğer oda arkadaşı dün nöbet tuttuysa (bugün ertesi), bugün ben tutamam.
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, roommateId)) return false;

              // Rule C: Future conflict check (symmetry)
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, roommateId)) return false;
          }

          // 5. Special Units
          if (person.unit === 'Transplantasyon') {
              if (!isSat) return false; // Only Saturday
          }
          if (person.unit === 'Yara') {
              if (!isFri) return false; // Only Friday
          }

          // 6. Quotas
          const stats = staffStats.get(person.id)!;
          if (stats.service >= person.quotaService) return false;
          if (isWeekend && stats.weekend >= person.weekendLimit) return false;

          // 7. Thursday-Weekend Conflict Rule
          // If Saturday(6), check Thursday(4)
          if (isSat) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) return false;
          }
          // If Sunday(0), check Thursday(4)
          if (isSun) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 3, person.id)) return false;
          }
          // If Thursday(4), check upcoming Sat/Sun
          if (dayOfWeek === 4) {
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) return false;
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 3, person.id)) return false;
          }

          return true;
        }).map(person => {
          const stats = staffStats.get(person.id)!;
          let score = 0;

          // SCORING LOGIC

          // 1. Request Priority (Highest)
          if (person.requestedDays && person.requestedDays.includes(day)) {
              score += 50000;
          }

          // 2. Quota Hunger (Fill those furthest from target)
          const remaining = person.quotaService - stats.service;
          score += (remaining * 1000);

          // 3. Weekend Fairness
          if (isWeekend) {
              score -= (stats.weekend * 2000);
          }

          // 4. Spread (Prevent tight clusters if possible, though strict rule handles neighbours)
          if (this.config.preventEveryOtherDay) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score -= 1000;
          }

          // 5. Group Preference (Soft) - Removed as strict, but kept as soft bonus if needed
          if (service.preferredGroup && service.preferredGroup !== 'Farketmez') {
              if (person.group === service.preferredGroup) score += 500;
          }

          // 6. Random Jitter
          score += Math.random() * 500;

          return { person, score };
        });

      candidates.sort((a, b) => b.score - a.score); // High score first

      return candidates.length > 0 ? candidates[0].person : null;
  }
}
