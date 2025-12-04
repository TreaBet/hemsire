
import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment } from '../types';

interface CandidateOptions {
    desperate?: boolean;
    deepDesperate?: boolean; // New mode: Ignore group preferences completely
    restrictRole?: number;
    excludeRole?: number;
    restrictSpecialty?: string; // New: Force a specific specialty (transplant/wound)
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

  // Calculate day difficulty for sorting
  // Checks constraints to see which days are restricted for specialties
  private getDayDifficulty(day: number): number {
      const dow = this.getDayOfWeek(day);
      
      // Check if any constraint (specialty or unit) applies to this day
      // If a specialty is ONLY allowed on this day, it's a hard day.
      const constraints = this.config.unitConstraints.filter(c => c.allowedDays.includes(dow));
      
      if (constraints.some(c => c.unit === 'Transplantasyon')) return 100; // Hardest
      if (constraints.some(c => c.unit === 'Yara Bakım')) return 90; // Hard
      
      if (dow === 6) return 80;  // Saturday
      if (dow === 0) return 60;  // Sunday
      return 10; // Weekdays
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
    
    // SMART SORT: Process hardest days first (Sat > Fri > Sun > Others)
    if (this.config.randomizeOrder) {
         daysToProcess.sort((a, b) => {
             const diff = this.getDayDifficulty(b) - this.getDayDifficulty(a);
             if (diff !== 0) return diff;
             return Math.random() - 0.5;
         });
    } else {
        daysToProcess.sort((a, b) => this.getDayDifficulty(b) - this.getDayDifficulty(a));
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

      // HELPER: Assign a staff member to a service and update stats
      const assignToSlot = (candidate: Staff, service: Service) => {
          currentDayAssignments.push({
              serviceId: service.id,
              staffId: candidate.id,
              staffName: candidate.name,
              role: candidate.role,
              group: candidate.group,
              unit: candidate.unit,
              isEmergency: service.isEmergency
          });
          assignedTodayIds.add(candidate.id);
          
          const stats = staffStats.get(candidate.id)!;
          stats.total++;
          stats.service++;
          if (isWeekend) stats.weekend++;
          if (isSat) stats.saturday++;
          if (isSun) stats.sunday++;

          if (candidate.role === 1) seniorAssignedToday = true;
      };

      // --- PHASE 0: PRIORITY SPECIALTY ASSIGNMENT ---
      // Önce özellikli günlerin (Transplant/Yara vb.) zorunlu personelini ata.
      // Bu personel boşta varsa ve bugün o özelliğin günü ise, 1 boşluğa kesin o yazılır.
      for (const constraint of this.config.unitConstraints) {
          if (constraint.allowedDays.includes(dayOfWeek)) {
               let targetSpecialty: string | undefined = undefined;
               if (constraint.unit === 'Transplantasyon') targetSpecialty = 'transplant';
               if (constraint.unit === 'Yara Bakım') targetSpecialty = 'wound';

               if (targetSpecialty) {
                   // Check if we already have this specialist assigned (unlikely at start of day loop)
                   const alreadyAssigned = currentDayAssignments.some(a => {
                       const s = this.staff.find(st => st.id === a.staffId);
                       return s?.specialty === targetSpecialty;
                   });

                   if (!alreadyAssigned) {
                       // Find a service that needs people and is compatible
                       // We prioritize 'Genel Cerrahi' type services or services allowing all units
                       const eligibleServices = [...this.services]
                            .filter(s => s.minDailyCount > 0)
                            .sort((a, b) => this.getServiceDifficulty(b) - this.getServiceDifficulty(a));

                       for (const service of eligibleServices) {
                           // Try to find the specific specialist for this service
                           const specialistCandidate = this.findBestCandidate(
                               service, day, assignedTodayIds, dayAssignmentsMap, staffStats,
                               isWeekend, isSat, isSun, isFri,
                               { restrictSpecialty: targetSpecialty } // STRICTLY find this specialty
                           );

                           if (specialistCandidate) {
                               assignToSlot(specialistCandidate, service);
                               break; // Found and assigned the specialist for this constraint
                           }
                       }
                   }
               }
          }
      }

      // --- PHASE 1: ASSIGN 1 SENIOR (ROLE 1) GLOBALLY ---
      // Only if not assigned in Phase 0
      if (!seniorAssignedToday) {
          const shuffledServicesForSenior = [...this.services].sort(() => Math.random() - 0.5);
          for (const service of shuffledServicesForSenior) {
              if (seniorAssignedToday) break; 
              
              if (!service.allowedRoles.includes(1)) continue;
              if (service.minDailyCount <= 0) continue;
              
              // Check if service is already full (due to Phase 0)
              const count = currentDayAssignments.filter(a => a.serviceId === service.id).length;
              if (count >= service.minDailyCount) continue;

              const seniorCandidate = this.findBestCandidate(
                  service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                  isWeekend, isSat, isSun, isFri, 
                  { restrictRole: 1 } 
              );

              if (seniorCandidate) {
                 assignToSlot(seniorCandidate, service);
              }
          }
      }

      // --- PHASE 2: FILL REMAINING SLOTS ---
      const dailyServices = [...this.services].sort((a, b) => this.getServiceDifficulty(b) - this.getServiceDifficulty(a));

      for (const service of dailyServices) {
        let currentServiceCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;

        for (let i = currentServiceCount; i < service.minDailyCount; i++) {
          
          // 1. Normal Try
          let bestCandidate = this.findBestCandidate(
              service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
              isWeekend, isSat, isSun, isFri, 
              { 
                  excludeRole: seniorAssignedToday ? 1 : undefined,
                  // Note: Phase 0 handled strict specialty requirements, so here we don't strictly enforce it
                  // unless we want to allow *multiple* specialists. 
                  // But existing logic had check here. We can keep it loose or rely on scoring.
                  // Let's rely on scoring and Phase 0 having done the heavy lifting.
              } 
          );

          // 2. Desperate Try (Relax soft constraints)
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

          // 3. Deep Desperation (Ignore Group Preferences)
          if (!bestCandidate && currentServiceCount < service.minDailyCount) {
             bestCandidate = this.findBestCandidate(
                  service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                  isWeekend, isSat, isSun, isFri, 
                  { 
                      desperate: true,
                      deepDesperate: true, // Ignore group preferences
                      excludeRole: seniorAssignedToday ? 1 : undefined
                  }
              );
          }

          if (bestCandidate) {
            assignToSlot(bestCandidate, service);
            currentServiceCount++;
          } else {
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
      
      const candidates = this.staff.filter(person => {
          // --- OPTIONS FILTERS ---
          if (options.restrictRole !== undefined && person.role !== options.restrictRole) return false;
          if (options.excludeRole !== undefined && person.role === options.excludeRole) return false;
          
          // CRITICAL: Mandatory Specialty Reservation (Used in Phase 0)
          if (options.restrictSpecialty && person.specialty !== options.restrictSpecialty) return false;

          // --- HARD CONSTRAINTS ---
          
          // 1. Availability
          if (assignedTodayIds.has(person.id)) return false;
          if (person.offDays.includes(day)) return false;

          // 2. Strict 24h Shift Rule
          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;

          // 3. Unit Matching (Branş) & Constraints
          const isNewNurse = person.role === 3;
          
          if (!isNewNurse) {
              // A. Service Unit Matching
              // If service allows specific units, check if person matches
              if (service.allowedUnits && service.allowedUnits.length > 0) {
                  if (!service.allowedUnits.includes(person.unit)) return false;
              }

              // B. Unit Day Constraints (Legacy Unit Check)
              // If unitConstraint matches person.unit, apply days
              const constraint = this.config.unitConstraints.find(c => c.unit === person.unit);
              if (constraint) {
                  if (!constraint.allowedDays.includes(dayOfWeek)) return false;
              }
              
              // C. Specialty Day Constraints
              // If person has specialty, and there is a constraint for that specialty name
              // BUT: If we are in Phase 0 (restrictSpecialty is set), we implicitly know it's allowed.
              // If we are in normal phase, we should enforce day restriction for specialty staff.
              if (person.specialty && person.specialty !== 'none') {
                  let specName = '';
                  if (person.specialty === 'transplant') specName = 'Transplantasyon';
                  if (person.specialty === 'wound') specName = 'Yara Bakım';
                  
                  const specConstraint = this.config.unitConstraints.find(c => c.unit === specName);
                  if (specConstraint) {
                      // If constraint exists, they can ONLY work on allowed days
                      if (!specConstraint.allowedDays.includes(dayOfWeek)) return false;
                  }
              }
          }

          // 4. ROOMMATE CONFLICTS
          const roommates = this.roommatesMap.get(person.id) || [];
          for (const roommateId of roommates) {
              if (assignedTodayIds.has(roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, roommateId)) return false;
          }

          // 5. Quotas (Strict - Never exceed even in desperate)
          const stats = staffStats.get(person.id)!;
          if (stats.service >= person.quotaService) return false;
          if (isWeekend && stats.weekend >= person.weekendLimit) return false;

          // 6. Thursday-Weekend Conflict
          if (isSat && this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) return false;
          if (isSun && this.hasShiftOnDay(dayAssignmentsMap, day - 3, person.id)) return false;
          if (dayOfWeek === 4) {
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) return false;
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 3, person.id)) return false;
          }
          
          // 7. Group Constraint (Strict unless Deep Desperate)
          if (service.preferredGroup && service.preferredGroup !== 'Farketmez' && !options.deepDesperate) {
               if (person.group !== service.preferredGroup) return false;
          }

          return true;
        }).map(person => {
          const stats = staffStats.get(person.id)!;
          let score = 0;

          // SCORING LOGIC

          // 1. Mandatory Reservation Bonus (Phase 0)
          if (options.restrictSpecialty && person.specialty === options.restrictSpecialty) {
              score += 500000;
          }

          // 2. Specialty Priority (Fallback for Phase 2)
          if (person.specialty && person.specialty !== 'none') {
             let specName = '';
             if (person.specialty === 'transplant') specName = 'Transplantasyon';
             if (person.specialty === 'wound') specName = 'Yara Bakım';
             const constraint = this.config.unitConstraints.find(c => c.unit === specName);
             if (constraint && constraint.allowedDays.includes(dayOfWeek)) {
                 score += 100000;
             }
          }

          // 3. Request Priority
          if (person.requestedDays && person.requestedDays.includes(day)) {
              score += 20000;
          }

          // 4. Quota Hunger
          const remaining = person.quotaService - stats.service;
          score += (remaining * 1000);

          // 5. Weekend Fairness
          if (isWeekend) score -= (stats.weekend * 2000);

          // 6. Spread (Soft Constraint)
          if (this.config.preventEveryOtherDay) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score -= 1000;
          }

          // 7. Group Preference
          if (service.preferredGroup && service.preferredGroup !== 'Farketmez') {
              if (person.group === service.preferredGroup) score += 500;
          }

          score += Math.random() * 500;

          return { person, score };
        });

      candidates.sort((a, b) => b.score - a.score);

      return candidates.length > 0 ? candidates[0].person : null;
  }
}
