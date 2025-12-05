

import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment } from '../types';

interface CandidateOptions {
    desperate?: boolean;
    restrictRole?: number;
    excludeRole?: number;
    restrictSpecialty?: string; // New: Force a specific specialty (Exact String Match)
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
      
      // Use dynamic checks if needed, but for now hardcoded difficulty is simple
      // We can make this dynamic later if needed
      
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
  
  // Helper to count potential candidates for a service (for sorting in Phase 3)
  private getPotentialCandidatesCount(service: Service): number {
      return this.staff.filter(s => {
          if (service.allowedUnits && service.allowedUnits.length > 0) {
              if (!service.allowedUnits.includes(s.unit)) return false;
          }
          // Allowed Roles check removed
          return true;
      }).length;
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
        return acc + Math.abs(staffDef.quotaService - s.totalShifts);
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

    const staffStats = new Map<string, { total: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, weekend: 0, saturday: 0, sunday: 0 }));

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
    
    // HELPER: Assign a staff member to a service and update stats
    const assignToSlot = (day: number, candidate: Staff, service: Service) => {
        const currentDayAssignments = dayAssignmentsMap.get(day)!;
        const dayOfWeek = this.getDayOfWeek(day);
        const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
        const isSat = dayOfWeek === 6;
        const isSun = dayOfWeek === 0;

        currentDayAssignments.push({
            serviceId: service.id,
            staffId: candidate.id,
            staffName: candidate.name,
            role: candidate.role,
            unit: candidate.unit
        });
        
        const stats = staffStats.get(candidate.id)!;
        stats.total++;
        if (isWeekend) stats.weekend++;
        if (isSat) stats.saturday++;
        if (isSun) stats.sunday++;
    };

    // Helper to get day context
    const getContext = (day: number) => {
        const dayOfWeek = this.getDayOfWeek(day);
        return {
            isWeekend: dayOfWeek === 6 || dayOfWeek === 0,
            isSat: dayOfWeek === 6,
            isSun: dayOfWeek === 0,
            isFri: dayOfWeek === 5,
            assignedTodayIds: new Set(dayAssignmentsMap.get(day)!.map(a => a.staffId))
        };
    };

    // =========================================================================
    // NEW LOGIC: GLOBAL LAYERING
    // Instead of filling a day completely, we fill Layer 1 for ALL days, then Layer 2, etc.
    // =========================================================================

    // --- PHASE 0: PRIORITY SPECIALTY ASSIGNMENT (Global Pass) ---
    // This MUST happen before anything else to ensure special staff get their restricted days.
    for (const day of daysToProcess) {
        const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
        const dayOfWeek = this.getDayOfWeek(day);
        const currentDayAssignments = dayAssignmentsMap.get(day)!;

        for (const constraint of this.config.unitConstraints) {
            if (constraint.allowedDays.includes(dayOfWeek)) {
                 const targetSpecialty = constraint.unit.trim();
                 const specialists = this.staff.filter(s => s.specialty && s.specialty.trim() === targetSpecialty);

                 if (specialists.length > 0) {
                     const alreadyAssigned = currentDayAssignments.some(a => {
                         const s = this.staff.find(st => st.id === a.staffId);
                         return s?.specialty?.trim() === targetSpecialty;
                     });

                     if (!alreadyAssigned) {
                         const eligibleServices = [...this.services]
                              .filter(s => s.minDailyCount > 0)
                              .sort((a, b) => {
                                  const aAllows = a.allowedUnits?.some(u => u.trim() === targetSpecialty) ? 1 : 0;
                                  const bAllows = b.allowedUnits?.some(u => u.trim() === targetSpecialty) ? 1 : 0;
                                  if (aAllows !== bAllows) return bAllows - aAllows;
                                  return this.getServiceDifficulty(b) - this.getServiceDifficulty(a)
                              });

                         for (const service of eligibleServices) {
                             const currentCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                             if (currentCount >= service.maxDailyCount) continue;

                             const specialistCandidate = this.findBestCandidate(
                                 service, day, assignedTodayIds, dayAssignmentsMap, staffStats,
                                 isWeekend, isSat, isSun, isFri,
                                 { restrictSpecialty: targetSpecialty }
                             );

                             if (specialistCandidate) {
                                 assignToSlot(day, specialistCandidate, service);
                                 assignedTodayIds.add(specialistCandidate.id);
                                 break;
                             }
                         }
                     }
                 }
            }
        }
    }

    // --- PHASE 1: ASSIGN 1 SENIOR (Global Pass) ---
    // Ensures every day has at least 1 Senior if possible.
    for (const day of daysToProcess) {
        const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
        let seniorAssignedToday = Array.from(assignedTodayIds).some(id => this.staff.find(s => s.id === id)?.role === 1);

        if (!seniorAssignedToday) {
            const shuffledServicesForSenior = [...this.services].sort(() => Math.random() - 0.5);
            for (const service of shuffledServicesForSenior) {
                if (seniorAssignedToday) break;
                if (service.minDailyCount <= 0) continue;
                
                const currentDayAssignments = dayAssignmentsMap.get(day)!;
                const count = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                if (count >= service.minDailyCount) continue; // Don't overfill logic yet

                const seniorCandidate = this.findBestCandidate(
                    service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                    isWeekend, isSat, isSun, isFri, 
                    { restrictRole: 1 } 
                );

                if (seniorCandidate) {
                   assignToSlot(day, seniorCandidate, service);
                   seniorAssignedToday = true;
                }
            }
        }
    }

    // --- PHASE 2: FILL MINIMUMS (LAYERED Global Pass) ---
    // Critical Change: We iterate by "Fill Layer" first, then by Day.
    // Layer 1: Fill 1st slot of Service A, Service B, etc. for ALL Days.
    // Layer 2: Fill 2nd slot of Service A, Service B, etc. for ALL Days.
    
    const maxMinDailyCount = Math.max(...this.services.map(s => s.minDailyCount));

    for (let layer = 1; layer <= maxMinDailyCount; layer++) {
        // Recalculate sort order for each layer slightly to avoid bias? 
        // Keeping consistent hard day sort is usually better.
        
        for (const day of daysToProcess) {
            const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
            const currentDayAssignments = dayAssignmentsMap.get(day)!;
            const dailyServices = [...this.services].sort((a, b) => this.getServiceDifficulty(b) - this.getServiceDifficulty(a));

            for (const service of dailyServices) {
                // How many do we have now?
                let currentServiceCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                
                // Only try to fill if we haven't met the CURRENT LAYER target AND haven't met the SERVICE MIN
                // e.g. If Layer is 2, but Service Min is 1, we stop at 1.
                while (currentServiceCount < layer && currentServiceCount < service.minDailyCount) {
                    
                    let bestCandidate = this.findBestCandidate(
                        service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                        isWeekend, isSat, isSun, isFri, {} 
                    );

                    if (!bestCandidate) {
                        bestCandidate = this.findBestCandidate(
                            service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                            isWeekend, isSat, isSun, isFri, { desperate: true }
                        );
                    }

                    if (bestCandidate) {
                        assignToSlot(day, bestCandidate, service);
                        assignedTodayIds.add(bestCandidate.id);
                        currentServiceCount++;
                    } else {
                        // If we can't fill Layer 1, that's a problem. 
                        // But if we can't fill Layer 2, maybe we just leave it for now.
                        // We mark empty only if we are at the final layer logic or give up?
                        // For visualization, we only push EMPTY if we completely fail after all attempts.
                        break; // Move to next service
                    }
                }
            }
        }
    }

    // Final Minimum Check (Fill gaps with EMPTY)
    for (const day of daysToProcess) {
        const currentDayAssignments = dayAssignmentsMap.get(day)!;
        for (const service of this.services) {
            const count = currentDayAssignments.filter(a => a.serviceId === service.id).length;
            if (count < service.minDailyCount) {
                for(let i=count; i<service.minDailyCount; i++) {
                    unfilledSlots++;
                     currentDayAssignments.push({
                        serviceId: service.id,
                        staffId: 'EMPTY',
                        staffName: `BOŞ (Min:${service.minDailyCount})`,
                        role: 0,
                        unit: '-'
                     });
                }
            }
        }
    }

    // --- PHASE 3: FILL TO GLOBAL TARGET (MAX BALANCE) (Global Pass) ---
    if (this.config.dailyTotalTarget > 0) {
        for (const day of daysToProcess) {
             const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
             const currentDayAssignments = dayAssignmentsMap.get(day)!;
             let currentTotalStaff = currentDayAssignments.filter(a => a.staffId !== 'EMPTY').length;

             let protectionCounter = 0;
             while (currentTotalStaff < this.config.dailyTotalTarget && protectionCounter < 50) {
                  protectionCounter++;
                  const flexibleServices = this.services.filter(s => {
                      const currentCount = currentDayAssignments.filter(a => a.serviceId === s.id).length;
                      return currentCount < s.maxDailyCount;
                  });
                  
                  if (flexibleServices.length === 0) break;
                  
                  flexibleServices.sort((a, b) => this.getPotentialCandidatesCount(b) - this.getPotentialCandidatesCount(a));
                  
                  let filledSomething = false;
                  for (const service of flexibleServices) {
                       let extraCandidate = this.findBestCandidate(
                          service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                          isWeekend, isSat, isSun, isFri, {} 
                      );
                      
                      if (!extraCandidate) {
                          extraCandidate = this.findBestCandidate(
                              service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                              isWeekend, isSat, isSun, isFri, { desperate: true }
                          );
                      }
    
                      if (extraCandidate) {
                          assignToSlot(day, extraCandidate, service);
                          assignedTodayIds.add(extraCandidate.id);
                          currentTotalStaff++;
                          filledSomething = true;
                          break; 
                      }
                  }
                  if (!filledSomething) break;
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

      // --- LOGIC: CALCULATE MIN SHIFTS FOR FAIRNESS ---
      
      // 1. Min Shifts of Juniors (Role 3) - Used for Vertical Fairness (Senior vs Junior)
      const activeJuniors = this.staff.filter(s => s.role === 3 && s.isActive);
      let minJuniorShifts = 999;
      if (activeJuniors.length > 0) {
          minJuniorShifts = Math.min(...activeJuniors.map(j => staffStats.get(j.id)?.total || 0));
      }

      // 2. Min Shifts Map by Role - EXCLUDING SPECIALTIES for Water Level Rule
      // FIXED: Also Exclude staff who have reached their quota from dragging down the average.
      const minShiftsByRole: Record<number, number> = {};
      [1, 2, 3].forEach(r => {
          // Filter ONLY standard staff (no specialty) to calculate the "Water Level"
          const peers = this.staff.filter(s => 
              s.role === r && 
              s.isActive && 
              (s.specialty === 'none' || !s.specialty)
          );
          
          // FILTER: Only consider peers who still have quota space!
          // If a peer is maxed out, they shouldn't force others to wait.
          const unfinishedPeers = peers.filter(p => {
              const stats = staffStats.get(p.id);
              return stats && stats.total < p.quotaService;
          });

          // Fallback: If everyone is finished, look at everyone (effectively disables rule)
          const referenceGroup = unfinishedPeers.length > 0 ? unfinishedPeers : peers;

          if (referenceGroup.length > 0) {
              minShiftsByRole[r] = Math.min(...referenceGroup.map(p => staffStats.get(p.id)?.total || 0));
          } else {
              minShiftsByRole[r] = 0;
          }
      });
      
      // Check if a senior is ALREADY assigned today (Stateless check)
      const seniorCountOnDay = Array.from(assignedTodayIds).filter(id => this.staff.find(s => s.id === id)?.role === 1).length;
      
      // Get set of Units assigned today for Diversity Score
      // Get counts of units to prevent clumping (e.g. 2 KBB today)
      const assignedUnitsCount = new Map<string, number>();
      assignedTodayIds.forEach(id => {
          const s = this.staff.find(st => st.id === id);
          if (s && s.unit) {
              assignedUnitsCount.set(s.unit, (assignedUnitsCount.get(s.unit) || 0) + 1);
          }
      });

      // Get set of Units assigned YESTERDAY for Smoothing Score
      const assignedYesterdayUnitsCount = new Map<string, number>();
      const yesterdayAssignments = dayAssignmentsMap.get(day - 1);
      if (yesterdayAssignments) {
          yesterdayAssignments.forEach(a => {
              const s = this.staff.find(st => st.id === a.staffId);
              if (s && s.unit) {
                  assignedYesterdayUnitsCount.set(s.unit, (assignedYesterdayUnitsCount.get(s.unit) || 0) + 1);
              }
          });
      }

      const candidates = this.staff.filter(person => {
          // --- OPTIONS FILTERS ---
          if (options.restrictRole !== undefined && person.role !== options.restrictRole) return false;
          if (options.excludeRole !== undefined && person.role === options.excludeRole) return false;
          
          // CRITICAL: Mandatory Specialty Reservation (Used in Phase 0)
          if (options.restrictSpecialty && person.specialty?.trim() !== options.restrictSpecialty) return false;

          // --- HARD CONSTRAINTS ---
          
          // 1. Availability
          if (assignedTodayIds.has(person.id)) return false;
          if (person.offDays.includes(day)) return false;

          // 2. Strict 24h Shift Rule
          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;
          
          // 4. Unit Matching (Branş) & Constraints
          const isNewNurse = person.role === 3;
          
          if (!isNewNurse) {
              // A. Service Unit Matching
              // If service allows specific units, check if person matches
              if (service.allowedUnits && service.allowedUnits.length > 0) {
                  if (!service.allowedUnits.includes(person.unit)) return false;
              }

              // B. Unit Day Constraints (Legacy Unit Check)
              const constraint = this.config.unitConstraints.find(c => c.unit === person.unit);
              if (constraint) {
                  if (!constraint.allowedDays.includes(dayOfWeek)) return false;
              }
              
              // C. Specialty Day Constraints (Dynamic Logic)
              if (person.specialty && person.specialty !== 'none') {
                  const specConstraint = this.config.unitConstraints.find(c => c.unit.trim() === person.specialty?.trim());
                  if (specConstraint) {
                      // If constraint exists for this specialty name, they can ONLY work on allowed days
                      if (!specConstraint.allowedDays.includes(dayOfWeek)) return false;
                  }
              }
          }

          // 5. ROOMMATE CONFLICTS
          const roommates = this.roommatesMap.get(person.id) || [];
          for (const roommateId of roommates) {
              if (assignedTodayIds.has(roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, roommateId)) return false;

              // NEW RULE: If roommate is OFF today, I cannot work.
              const roommate = this.staff.find(r => r.id === roommateId);
              if (roommate && roommate.offDays.includes(day)) {
                  return false;
              }
          }

          // 6. Quotas (Strict - Never exceed even in desperate)
          const stats = staffStats.get(person.id)!;
          if (stats.total >= person.quotaService) return false;
          if (isWeekend && stats.weekend >= person.weekendLimit) return false;

          // 7. Thursday-Weekend Conflict
          if (isSat && this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) return false;
          if (isSun && this.hasShiftOnDay(dayAssignmentsMap, day - 3, person.id)) return false;
          if (dayOfWeek === 4) {
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) return false;
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 3, person.id)) return false;
          }

          // --- STRICT HORIZONTAL FAIRNESS (HARD CONSTRAINT) ---
          // "Aynı kıdem içinde nöbet farkı 1den fazla olamaz."
          // Applies only to standard staff (no specialty) who haven't maxed out quota.
          if (person.specialty === 'none' || !person.specialty) {
              if (stats.total > minShiftsByRole[person.role]) {
                  return false;
              }
          }
          
          // --- STRICT SENIOR STACKING (HARD CONSTRAINT) ---
          if (person.role === 1) {
              // Rule 1: ABSOLUTE MAX 2 Seniors per day. No exception.
              if (seniorCountOnDay >= 2) return false;
              
              // Rule 2: Try to keep it at 1 if not desperate.
              if (!options.desperate && seniorCountOnDay >= 1) {
                  return false;
              }
          }

          // --- SOFT CONSTRAINTS (Skipped in desperate mode) ---
          if (!options.desperate) {
              
              // 8. STRICT JUNIOR (ROLE 3) PRIORITY (Vertical Fairness)
              if (person.role === 2 && activeJuniors.length > 0) {
                  if (stats.total >= minJuniorShifts) {
                      return false;
                  }
              }
          }
          
          return true;
        }).map(person => {
          const stats = staffStats.get(person.id)!;
          let score = 0;

          // SCORING LOGIC

          // 1. Mandatory Reservation Bonus (Phase 0)
          if (options.restrictSpecialty && person.specialty?.trim() === options.restrictSpecialty) {
              score += 500000;
          }

          // 2. Specialty Priority (Fallback for Phase 2)
          if (person.specialty && person.specialty !== 'none') {
             const constraint = this.config.unitConstraints.find(c => c.unit.trim() === person.specialty?.trim());
             if (constraint && constraint.allowedDays.includes(dayOfWeek)) {
                 score += 100000;
             }
          }

          // 3. Request Priority
          if (person.requestedDays && person.requestedDays.includes(day)) {
              score += 20000;
          }
          
          // 4. UNIT DIVERSITY & SATURATION SCORE
          const countToday = assignedUnitsCount.get(person.unit) || 0;
          const countYesterday = assignedYesterdayUnitsCount.get(person.unit) || 0;
          
          // A. Diversity Bonus (Start of day)
          if (countToday === 0) {
              score += 10000;
          }
          
          // B. Saturation Penalty (Prevent "2 KBB today")
          // If 1 KBB is already assigned, heavily penalize adding a 2nd one.
          // Exception: If the service explicitly REQUIRES this unit (e.g. KBB Service), we must allow it.
          // Note: service.allowedUnits might be null or empty for general services.
          const isServiceRestrictedToUnit = service.allowedUnits?.includes(person.unit);
          
          if (countToday > 0 && !isServiceRestrictedToUnit) {
               score -= 8000; // Strong penalty to push the 2nd KBB to tomorrow
          }

          // C. Consecutive Unit Smoothing (Prevent "2 yesterday, 0 today")
          // If KBB worked yesterday, penalize KBB today slightly to encourage spacing.
          // This forces the "1 today, 1 tomorrow" pattern instead of "2 today".
          if (countYesterday > 0 && !isServiceRestrictedToUnit) {
              score -= 3000; 
          }
          
          // D. Gap Filling Bonus
          // If no KBB yesterday AND no KBB today (yet), boost to fill the gap
          if (countYesterday === 0 && countToday === 0) {
              score += 2000;
          }

          // 5. GLOBAL JUNIOR BIAS
          if (person.role === 3) {
              score += 2000; 
          }

          // 6. Senior Stacking Penalty (Second Senior Discouragement)
          // If 1 senior is present, apply penalty to adding a 2nd one.
          // This allows it if desperate (since hard constraint > 2), but discourages it.
          if (person.role === 1 && seniorCountOnDay >= 1) {
              score -= 50000; 
          }
          
          // 7. SATURDAY SENIOR AVERSION
          // Reduce score for Seniors on Saturday to prevent "Clumping" on the hardest day
          // This forces the algorithm to pick Role 2/3 for Saturday slots first.
          // Phase 1 still guarantees 1 senior, but Phase 2 won't pick a 2nd one easily,
          // and Phase 1 will pick the Senior with the LEAST shifts anyway.
          if (person.role === 1 && isSat) {
              score -= 5000;
          }

          // 8. Quota Hunger (High Weight)
          const remaining = person.quotaService - stats.total;
          score += (remaining * 3000); // Increased weight to overcome soft penalties if necessary

          // 9. Weekend Fairness
          if (isWeekend) score -= (stats.weekend * 2000);

          // 10. Spread (Soft Constraint)
          if (this.config.preventEveryOtherDay) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score -= 1000;
          }

          score += Math.random() * 500;

          return { person, score };
        });

      candidates.sort((a, b) => b.score - a.score);

      return candidates.length > 0 ? candidates[0].person : null;
  }
}