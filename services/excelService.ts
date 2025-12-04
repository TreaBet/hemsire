
import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff, Group } from '../types';

const formatDate = (day: number, month: number, year: number): string => {
    const d = day.toString().padStart(2, '0');
    const m = (month + 1).toString().padStart(2, '0');
    return `${d}.${m}.${year}`;
};

export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number, staffList: Staff[]) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // --- GENEL LİSTE ---
  const headersMain = ['Tarih', 'Gün', ...services.map(s => s.name)];
  const dataMain: any[] = [];

  result.schedule.forEach((daySchedule) => {
    const date = new Date(year, month, daySchedule.day);
    const dayName = date.toLocaleString('tr-TR', { weekday: 'short' });
    const isWeekend = daySchedule.isWeekend;

    const row: any = {
      'Tarih': formatDate(daySchedule.day, month, year),
      'Gün': isWeekend ? `${dayName} (HS)` : dayName
    };

    services.forEach(service => {
      const assignments = daySchedule.assignments.filter(a => a.serviceId === service.id);
      if (assignments.length > 0) {
          const names = assignments.map(a => a.staffId === 'EMPTY' ? '!!! BOŞ !!!' : a.staffName).join(', ');
          row[service.name] = names;
      } else {
          row[service.name] = '-';
      }
    });

    dataMain.push(row);
  });

  const wsMain = XLSX.utils.json_to_sheet(dataMain, { header: headersMain });
  wsMain['!cols'] = [{ wch: 12 }, { wch: 10 }, ...services.map(s => ({ wch: 30 }))];
  XLSX.utils.book_append_sheet(wb, wsMain, "Genel Liste");

  // --- PERSONEL LİSTESİ ---
  const daysHeader = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
  const headersPerson = ['Ad Soyad', 'Branş', 'Salon', 'Kıdem', 'Toplam', ...daysHeader];
  
  const dataPerson: any[] = [];
  const sortedStaff = [...staffList].sort((a, b) => a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name));

  sortedStaff.forEach(person => {
      const stats = result.stats.find(s => s.staffId === person.id);
      const row: any = {
          'Ad Soyad': person.name,
          'Branş': person.unit,
          'Salon': person.room,
          'Kıdem': person.role,
          'Toplam': stats?.totalShifts || 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
          const daySchedule = result.schedule.find(s => s.day === d);
          const assignment = daySchedule?.assignments.find(a => a.staffId === person.id);
          row[d.toString()] = assignment ? 'NÖBET' : '';
      }
      dataPerson.push(row);
  });

  const wsPerson = XLSX.utils.json_to_sheet(dataPerson, { header: headersPerson });
  wsPerson['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, ...daysHeader.map(() => ({ wch: 4 }))];
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
            'Hedef': 7, 
            'Haftasonu Limit': 2,
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
                        group: 'A', // Varsayılan
                        quotaService: parseInt(row['Hedef'] || '7'),
                        quotaEmergency: 0,
                        weekendLimit: parseInt(row['Haftasonu Limit'] || '2'),
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
