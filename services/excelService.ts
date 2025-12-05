
import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff } from '../types';

const formatDate = (day: number, month: number, year: number): string => {
    const date = new Date(year, month, day);
    // Tarih formatı: 01.01.2024 Pazartesi
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
};

export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number, staffList: Staff[]) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // --- GENEL LİSTE ---
  
  // 1. Servislerin maksimum kişi sayısını bul (Dinamik Sütunlar için)
  const serviceMaxCounts: Record<string, number> = {};
  services.forEach(s => {
      let max = 0;
      result.schedule.forEach(day => {
          const count = day.assignments.filter(a => a.serviceId === s.id).length;
          if (count > max) max = count;
      });
      // En az 1 sütun olsun
      serviceMaxCounts[s.id] = Math.max(max, 1);
  });

  // 2. Başlıkları Oluştur
  const headersMain = ['Tarih'];
  services.forEach(s => {
      const count = serviceMaxCounts[s.id];
      for(let i=1; i<=count; i++) {
          headersMain.push(`${s.name} ${i}`);
      }
  });

  const dataMain: any[] = [];

  result.schedule.forEach((daySchedule) => {
    const isWeekend = daySchedule.isWeekend;
    
    // Satır Verisi
    const row: any = {
      'Tarih': formatDate(daySchedule.day, month, year),
    };

    services.forEach(service => {
      // O günkü, o servise ait atamaları al
      let assignments = daySchedule.assignments.filter(a => a.serviceId === service.id);
      
      // SORGU: Kıdeme Göre Sırala (1: Kıdemli, 2: Tecrübeli, 3: Çömez)
      // Role 0 (EMPTY) genelde en sona kalsın veya boş olarak işlensin.
      assignments.sort((a, b) => {
          // Eğer biri boşsa onu sona at
          if (a.staffId === 'EMPTY') return 1;
          if (b.staffId === 'EMPTY') return -1;
          return a.role - b.role;
      });

      const maxCols = serviceMaxCounts[service.id];
      
      for(let i=0; i<maxCols; i++) {
          const colName = `${service.name} ${i+1}`;
          if (assignments[i]) {
              const a = assignments[i];
              
              if (a.staffId === 'EMPTY') {
                  // İSTEK: Boş yerleri yazma
                  row[colName] = ''; 
              } else {
                  let displayName = a.staffName;
                  if (a.role === 1) {
                      displayName += ' (K)'; // Kıdemli işareti
                  }
                  row[colName] = displayName;
              }
          } else {
              // İSTEK: Boş yerleri yazma
              row[colName] = ''; 
          }
      }
    });

    dataMain.push(row);
  });

  const wsMain = XLSX.utils.json_to_sheet(dataMain, { header: headersMain });
  
  // Sütun Genişlikleri
  const cols = [{ wch: 25 }]; // Tarih sütunu biraz geniş
  services.forEach(s => {
      const count = serviceMaxCounts[s.id];
      for(let i=0; i<count; i++) cols.push({ wch: 20 });
  });
  wsMain['!cols'] = cols;

  // Haftasonu Renklendirme Mantığı
  if (result.schedule.length > 0) {
      const range = XLSX.utils.decode_range(wsMain['!ref'] || "A1:A1");
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const dayIndex = R - 1; 
          if (result.schedule[dayIndex] && result.schedule[dayIndex].isWeekend) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                  const cell_address = { c: C, r: R };
                  const cell_ref = XLSX.utils.encode_cell(cell_address);
                  if (!wsMain[cell_ref]) wsMain[cell_ref] = { t: 's', v: '' }; // Boşsa oluştur
                  
                  // Hücre stili
                  wsMain[cell_ref].s = {
                      fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } }, // Açık Sarı
                      font: { bold: true }
                  };
              }
          }
      }
  }

  XLSX.utils.book_append_sheet(wb, wsMain, "Genel Liste");

  // --- PERSONEL LİSTESİ (Matrix) ---
  
  const daysInMonthList: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
      daysInMonthList.push(d.toString());
  }

  // İSTEK: Branş sütununu kaldır
  const headersPerson = ['Ad Soyad', 'Kıdem', 'Toplam', ...daysInMonthList];
  
  const dataPerson: any[] = [];
  
  // SIRALAMA: Önce Kıdem (Role ASC), Sonra İsim
  const sortedStaff = [...staffList].sort((a, b) => {
      if (a.role !== b.role) return a.role - b.role; // 1 (Kıdemli) önce gelir
      return a.name.localeCompare(b.name);
  });

  sortedStaff.forEach(person => {
      const stats = result.stats.find(s => s.staffId === person.id);
      const row: any = {
          'Ad Soyad': person.role === 1 ? `${person.name} (K)` : person.name,
          'Kıdem': person.role,
          'Toplam': stats?.totalShifts || 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
          const daySchedule = result.schedule.find(s => s.day === d);
          const assignment = daySchedule?.assignments.find(a => a.staffId === person.id);
          const headerKey = d.toString(); 
          
          if (assignment) {
              const service = services.find(s => s.id === assignment.serviceId);
              let val = service ? service.name : 'X';
              
              // Kısaltmalar
              if (val.includes('Genel Cerrahi')) val = 'G.Cer';
              else if (val.includes('KBB')) val = 'KBB';
              else if (val.includes('Plastik')) val = 'Plst';
              else if (val.includes('Beyin')) val = 'Beyin';
              else if (val.includes('Acil')) val = 'ACİL';
              
              row[headerKey] = val;
          } else {
              row[headerKey] = '';
          }
      }
      dataPerson.push(row);
  });

  const wsPerson = XLSX.utils.json_to_sheet(dataPerson, { header: headersPerson });
  
  wsPerson['!cols'] = [
      { wch: 20 }, // Ad Soyad
      { wch: 6 },  // Kıdem
      { wch: 8 },  // Toplam
      ...daysInMonthList.map(() => ({ wch: 4 })) // Günler dar olsun
  ];
  
  // Personel listesinde de haftasonu sütunlarını boyayalım
  const rangeP = XLSX.utils.decode_range(wsPerson['!ref'] || "A1:A1");
  // Kolon bazlı boyama (Gün sütunları için)
  for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend) {
          // Header row (0) + Data rows
          // İndeksler değişti: 0:Ad, 1:Kıdem, 2:Toplam -> Günler 3. indeksten başlar
          const colIndex = 3 + (d - 1); 
          for (let R = rangeP.s.r; R <= rangeP.e.r; ++R) {
               const cell_address = { c: colIndex, r: R };
               const cell_ref = XLSX.utils.encode_cell(cell_address);
               if (!wsPerson[cell_ref]) wsPerson[cell_ref] = { t: 's', v: '' };

               wsPerson[cell_ref].s = {
                   fill: { patternType: "solid", fgColor: { rgb: "E2EFDA" } } // Açık Yeşil/Gri
               };
          }
      }
  }

  XLSX.utils.book_append_sheet(wb, wsPerson, "Personel Bazlı");

  XLSX.writeFile(wb, `Nobet_Listesi_${monthName}_${year}.xlsx`);
};

export const generateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Ad Soyad', 'Branş', 'Salon', 'Kıdem', 'Hedef', 'Haftasonu Limit', 'İzinler', 'İstekler'];
    const exampleData = [
        { 
            'Ad Soyad': 'Hem. Örnek Kişi', 
            'Branş': 'Genel Cerrahi', 
            'Salon': '1',
            'Kıdem': 2, 
            'Hedef': 2, 
            'Haftasonu Limit': 1,
            'İzinler': '1,2,3',
            'İstekler': '15,20'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
    ws['!cols'] = [{wch:20}, {wch:15}, {wch:8}, {wch:8}, {wch:8}, {wch:15}, {wch:15}, {wch:15}];
    XLSX.writeFile(wb, "Personel_Yukleme_Taslagi.xlsx");
};

export const readStaffFromExcel = async (file: File): Promise<Staff[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const worksheet = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const staffList: Staff[] = json.map((row: any, index) => {
                    const parseList = (str: any) => {
                        if (typeof str === 'number') return [str];
                        if (!str) return [];
                        return str.toString().split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
                    };

                    return {
                        id: `imp_${Date.now()}_${index}`,
                        name: row['Ad Soyad'] || 'İsimsiz',
                        unit: row['Branş'] || 'Genel Cerrahi',
                        room: (row['Salon'] || '').toString(),
                        role: parseInt(row['Kıdem'] || '2'),
                        quotaService: parseInt(row['Hedef'] || '2'),
                        weekendLimit: parseInt(row['Haftasonu Limit'] || '1'),
                        offDays: parseList(row['İzinler']),
                        requestedDays: parseList(row['İstekler']),
                        isActive: true
                    };
                });
                resolve(staffList);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsBinaryString(file);
    });
};
