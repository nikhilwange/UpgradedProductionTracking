export interface ShiftAssignment {
  date: string;
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  operators: string[];
  actualMinutes: number;
  startTime?: string;
  endTime?: string;
  affectedParameter?: string;
  defectCategory?: string;
  issueDescription?: string;
}

export interface ProductionEntry {
  id: string;
  plant: string; 
  stage: string;      
  productLine: string;
  model: string;     
  serialNo: string;  
  unitSrNo: string; 
  soSqNo: string;    
  productionDate: string;      
  endDate?: string;  
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3' | 'Multi-Shift'; 
  activity: string;   
  manpower: number;
  manpowerNames: string[]; 
  assignments: ShiftAssignment[];
  startTime: string; 
  endTime: string;   
  standardCycleTime: number;
  actualCycleTime: number;
  shift1ActualMinutes: number;
  shift2ActualMinutes: number;
  variance: number;
  manhoursEngaged: number;
  lossHours: number;
  lossReason: string;
  affectedParameter?: string;
  defectCategory?: string;
  issueDescription?: string;
  notes: string;
  status: 'Completed' | 'In Progress';
  createdAt: string; 
  userEmail?: string;
  isGap?: boolean; 
  isParallel?: boolean;
}

export interface ActivityStandard {
  [key: string]: number;
}

export interface KPIStats {
  totalUnits: number;
  totalManhours: number;
  avgVariance: number;
  totalLossHours: number;
}