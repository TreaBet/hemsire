import { Staff, Service, RoleConfig, UnitConstraint } from '../types';

export interface AppData {
    version: string;
    timestamp: string;
    staff: Staff[];
    services: Service[];
    roleConfigs: Record<number, RoleConfig>;
    unitConstraints?: UnitConstraint[];
    config: {
        month: number;
        year: number;
        randomizeDays: boolean;
        preventEveryOther: boolean;
    }
}

export const exportToJSON = (
    staff: Staff[],
    services: Service[],
    roleConfigs: Record<number, RoleConfig>,
    config: { month: number; year: number; randomizeDays: boolean; preventEveryOther: boolean },
    unitConstraints: UnitConstraint[] = []
) => {
    const data: AppData = {
        version: "2.0",
        timestamp: new Date().toISOString(),
        staff,
        services,
        roleConfigs,
        unitConstraints,
        config
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nobetmatik_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const importFromJSON = async (file: File): Promise<AppData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (!json.version || !json.staff || !json.services) {
                    reject(new Error("Geçersiz yedek dosyası formatı."));
                }
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsText(file);
    });
};