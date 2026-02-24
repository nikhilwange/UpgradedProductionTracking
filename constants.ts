
import { ActivityStandard } from './types';

export const S1_START = 420;  // 07:00
export const S1_END = 930;    // 15:30
export const S2_START = 900;  // 15:00
export const S2_END = 1410;   // 23:30

// --- Chakan Plant Configurations ---

const CHAKAN_NH_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement", "Evaporator Installation", "Compressor Installation", "Pump Assembly", "Hydraulic Piping-1", "PHE Mounting", "Evaporator Inlet Pipe", "Discharge Pipe Installation", "Suction Line Installation", "Compressor Housing Mounting", "Glycol Pump Mounting", "Hydraulic Piping-2", "V Coil Mounting"],
  "Brazing": ["Discharge Line", "Liquid Line", "Glycol Expansion tanks mounting", "Fan Assembly", "Fan Wiring"],
  "Wiring": ["Insulation", "Valves Fitting", "Wiring", "Vacuuming", "Refrigerant"],
  "Dry Run Test": ["Dry Run Test"],
  "Lab": ["EOL"],
  "Finishing": ["Finishing"]
};

const CHAKAN_CH_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement", "Evaporator Installation", "Compressor Installation", "Pump Assembly", "Evaporator Inlet Pipe", "Discharge Pipe Installation", "Suction Line Installation", "Compressor Housing Mounting", "V Coil Mounting", "Hydraulic Pipe Line Installation"],
  "Brazing": ["Discharge Line", "Liquid Line", "Fan Assembly", "Fan Wiring"],
  "Wiring": ["Insulation", "Valves Fitting", "Wiring", "Vacuuming", "Refrigerant"],
  "Dry Run Test": ["Dry Run Test"],
  "Lab": ["EOL"],
  "Finishing": ["Finishing"]
};

const CHAKAN_ADANI_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement", "Evaporator Installation", "Compressor Installation", "Electrical Adaptor Box Mounting", "Pump Assembly", "Pump VFD Mounting", "Evaporator Inlet Pipe", "Discharge Pipe Installation", "Suction Line Installation", "Compressor Housing Mounting", "V Coil Mounting", "Hydraulic Pipe Line Installation"],
  "Brazing": ["Discharge Line", "Liquid Line", "Fan Assembly", "Fan Wiring"],
  "Wiring": ["Insulation", "Valves Fitting", "Wiring", "Vacuuming", "Refrigerant"],
  "Dry Run Test": ["Dry Run Test"],
  "Lab": ["EOL"],
  "Finishing": ["Finishing"]
};

const CHAKAN_PDX_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement", "Evaporator Installation", "Compressor Installation", "Evaporator Inlet Pipe", "Discharge Pipe Installation", "Suction Line Installation", "Compressor Housing Mounting", "V Coil Mounting"],
  "Brazing": ["Discharge Line", "Liquid Line", "Fan Assembly", "Fan Wiring"],
  "Wiring": ["Insulation", "Valves Fitting", "Wiring", "Vacuuming", "Refrigerant"],
  "Dry Run Test": ["Dry Run Test"],
  "Lab": ["EOL"],
  "Finishing": ["Finishing"]
};

const CHAKAN_NH_ACTIVITY_STANDARDS: Record<string, number> = {
  "Frame Movement": 120, "Evaporator Installation": 66, "Compressor Installation": 144, "Pump Assembly": 40, "Hydraulic Piping-1": 450, "PHE Mounting": 300, "Evaporator Inlet Pipe": 65, "Discharge Pipe Installation": 36, "Suction Line Installation": 70, "Compressor Housing Mounting": 100, "Glycol Pump Mounting": 40, "Hydraulic Piping-2": 450, "V Coil Mounting": 220, "Discharge Line": 265, "Liquid Line": 248, "Glycol Expansion tanks mounting": 180, "Fan Assembly": 320, "Fan Wiring": 240, "Insulation": 540, "Valves Fitting": 253, "Wiring": 518, "Vacuuming": 315, "Refrigerant": 202, "Dry Run Test": 1200, "EOL": 900, "Finishing": 423
};

const CHAKAN_CH_ACTIVITY_STANDARDS: Record<string, number> = {
  ...CHAKAN_NH_ACTIVITY_STANDARDS,
  "Hydraulic Pipe Line Installation": 450,
  "EOL": 900
};

const CHAKAN_ADANI_ACTIVITY_STANDARDS: Record<string, number> = {
  "Frame Movement": 120, "Evaporator Installation": 66, "Compressor Installation": 144, "Electrical Adaptor Box Mounting": 45, "Pump Assembly": 40, "Pump VFD Mounting": 45, "Evaporator Inlet Pipe": 65, "Discharge Pipe Installation": 36, "Suction Line Installation": 70, "Compressor Housing Mounting": 100, "V Coil Mounting": 220, "Hydraulic Pipe Line Installation": 204, "Discharge Line": 265, "Liquid Line": 248, "Fan Assembly": 320, "Fan Wiring": 240, "Insulation": 540, "Valves Fitting": 253, "Wiring": 518, "Vacuuming": 315, "Refrigerant": 202, "Dry Run Test": 1200, "EOL": 900, "Finishing": 423
};

const CHAKAN_PDX_ACTIVITY_STANDARDS: Record<string, number> = {
  ...CHAKAN_NH_ACTIVITY_STANDARDS,
  "EOL": 900
};

// --- DSE Configuration (Now assigned to Chakan) ---

const CHAKAN_DSE_STAGE_MAPPING: Record<string, string[]> = {
  "Pre-Assembly": ["Base Frame Prep", "Side Panel Fitting"],
  "Assembly": ["Module Installation", "Internal Piping"],
  "Testing": ["Pressure Test", "Component Check"],
  "Packing": ["Final Wrapping", "Dispatch Ready"]
};

const CHAKAN_DSE_ACTIVITY_STANDARDS: Record<string, number> = {
  "Base Frame Prep": 60,
  "Side Panel Fitting": 45,
  "Module Installation": 120,
  "Internal Piping": 180,
  "Pressure Test": 90,
  "Component Check": 30,
  "Final Wrapping": 40,
  "Dispatch Ready": 20
};

// --- Updated Li7 Configuration for Ambernath (Standardized to Title Case) ---
const AMBERNATH_LI7_STAGE_MAPPING: Record<string, string[]> = {
  "Batt Cabinet Loading": [
    "Chassis Dismantle",
    "Batt Insertion",
    "Vertical Bus Bar Fitment and BMS Module Assembly"
  ],
  "Wiring": [
    "Wiring",
    "Routing",
    "Stickering and Pre-Finishing"
  ],
  "Testing": ["EOL"],
  "Finishing": ["Finishing"]
};

const AMBERNATH_LI7_ACTIVITY_STANDARDS: Record<string, number> = {
  "Chassis Dismantle": 40,
  "Batt Insertion": 70,
  "Vertical Bus Bar Fitment and BMS Module Assembly": 60,
  "Wiring": 75,
  "Routing": 40,
  "Stickering and Pre-Finishing": 50,
  "EOL": 90,
  "Finishing": 20
};

// --- Li7 PCA Configuration for Ambernath ---
const AMBERNATH_LI7_PCA_STAGE_MAPPING: Record<string, string[]> = {
  "PCA Assembly": [
    "1 Bin Kitting and PCA Dismantle from Batt Cabinet",
    "Component & Busbar Assembly",
    "Wiring & Routing",
    "Torque Marking, Prefinishing, Labelling & Finishing",
    "Testing"
  ]
};

const AMBERNATH_LI7_PCA_ACTIVITY_STANDARDS: Record<string, number> = {
  "1 Bin Kitting and PCA Dismantle from Batt Cabinet": 20,
  "Component & Busbar Assembly": 40,
  "Wiring & Routing": 45,
  "Torque Marking, Prefinishing, Labelling & Finishing": 50,
  "Testing": 55
};

// --- 2X Configuration for Ambernath ---
const AMBERNATH_2X_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement and Sheet Metal, Material Loading"],
  "Core Assembly and Integration": [
    "Mounting of Contactor Assembly, Routing & Wiring",
    "Mounting of Resistor Shelf, PIB Board and Fan Tray Assembly",
    "Mounting of DC Choke and DC Cap and its Wiring",
    "Mounting of AC Inductor and wiring",
    "Module Insertion Inverter, Rectifier, Booster LHS, Booster RHS",
    "Stacked Busbar Mounting and Connection, 7 Types Fuse Insertion and wiring"
  ],
  "Busbar Assembly": ["Rear Side Busbar Assembly"],
  "Testing": ["Connection/Disconnection", "Functional Testing", "Burn-In"],
  "Finishing": ["Finishing"]
};

const AMBERNATH_2X_ACTIVITY_STANDARDS: Record<string, number> = {
  "Frame Movement and Sheet Metal, Material Loading": 60,
  "Mounting of Contactor Assembly, Routing & Wiring": 480,
  "Mounting of Resistor Shelf, PIB Board and Fan Tray Assembly": 720,
  "Mounting of DC Choke and DC Cap and its Wiring": 360,
  "Mounting of AC Inductor and wiring": 360,
  "Module Insertion Inverter, Rectifier, Booster LHS, Booster RHS": 288,
  "Stacked Busbar Mounting and Connection, 7 Types Fuse Insertion and wiring": 288,
  "Rear Side Busbar Assembly": 240,
  "Connection/Disconnection": 90,
  "Functional Testing": 690,
  "Burn-In": 390,
  "Finishing": 480
};

// --- 3X Configuration for Ambernath ---
const AMBERNATH_3X_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement and Sheet Metal, Material Loading"],
  "Core Assembly and Integration": [
    "Mounting of Contactor Assembly, Routing & Wiring",
    "Mounting of Resistor Shelf, PIB Board and Fan Tray Assembly",
    "Mounting of DC Choke and DC Cap and its Wiring",
    "Mounting of AC Inductor and Wiring",
    "Module Insertion Inverter, Rectifier, Booster LHS, Booster RHS",
    "Stacked Busbar Mounting and Connection, 7 Types Fuse Insertion and wiring"
  ],
  "Busbar Assembly": ["Rear Side Busbar Assembly"],
  "Testing": ["Connection/Disconnection", "Functional Testing", "Burn-In"],
  "Finishing": ["Finishing Activity"]
};

const AMBERNATH_3X_ACTIVITY_STANDARDS: Record<string, number> = {
  "Frame Movement and Sheet Metal, Material Loading": 90,
  "Mounting of Contactor Assembly, Routing & Wiring": 720,
  "Mounting of Resistor Shelf, PIB Board and Fan Tray Assembly": 1080,
  "Mounting of DC Choke and DC Cap and its Wiring": 540,
  "Mounting of AC Inductor and Wiring": 540,
  "Module Insertion Inverter, Rectifier, Booster LHS, Booster RHS": 432,
  "Stacked Busbar Mounting and Connection, 7 Types Fuse Insertion and wiring": 432,
  "Rear Side Busbar Assembly": 240,
  "Connection/Disconnection": 120,
  "Functional Testing": 1065,
  "Burn-In": 465,
  "Finishing Activity": 480
};

// --- STS Configuration for Ambernath ---
const AMBERNATH_STS_STAGE_MAPPING: Record<string, string[]> = {
  "Loading": ["Frame Movement and Sheet Metal, Material Loading"],
  "STS Assembly and Integration": [
    "Component Mounting, Labeling",
    "Wiring",
    "Busbar Assembly",
    "Fan Mounting, Heat Sink Assembly Mounting"
  ],
  "Testing": ["Connection/Disconnection, Functional Testing, Burn-In"],
  "Finishing": ["Finishing"]
};

const AMBERNATH_STS_ACTIVITY_STANDARDS: Record<string, number> = {
  "Frame Movement and Sheet Metal, Material Loading": 30,
  "Component Mounting, Labeling": 480,
  "Wiring": 1080,
  "Busbar Assembly": 1620,
  "Fan Mounting, Heat Sink Assembly Mounting": 480,
  "Connection/Disconnection, Functional Testing, Burn-In": 450,
  "Finishing": 300
};

// --- Master Plant Config Registry ---

export const PLANT_REGISTRY: Record<string, any> = {
  "CHAKAN": {
    "models": {
      "CHILLER_NH": {
        mapping: CHAKAN_NH_STAGE_MAPPING,
        standards: CHAKAN_NH_ACTIVITY_STANDARDS
      },
      "CHILLER_CH": {
        mapping: CHAKAN_CH_STAGE_MAPPING,
        standards: CHAKAN_CH_ACTIVITY_STANDARDS
      },
      "CHILLER_ADANI": {
        mapping: CHAKAN_ADANI_STAGE_MAPPING,
        standards: CHAKAN_ADANI_ACTIVITY_STANDARDS
      },
      "PDX": {
        mapping: CHAKAN_PDX_STAGE_MAPPING,
        standards: CHAKAN_PDX_ACTIVITY_STANDARDS
      }
    }
  },
  "AMBERNATH": {
    "models": {
      "Li7": {
        mapping: AMBERNATH_LI7_STAGE_MAPPING,
        standards: AMBERNATH_LI7_ACTIVITY_STANDARDS
      },
      "Li7 PCA": {
        mapping: AMBERNATH_LI7_PCA_STAGE_MAPPING,
        standards: AMBERNATH_LI7_PCA_ACTIVITY_STANDARDS
      },
      "2X": {
        mapping: AMBERNATH_2X_STAGE_MAPPING,
        standards: AMBERNATH_2X_ACTIVITY_STANDARDS
      },
      "3X": {
        mapping: AMBERNATH_3X_STAGE_MAPPING,
        standards: AMBERNATH_3X_ACTIVITY_STANDARDS
      },
      "STS": {
        mapping: AMBERNATH_STS_STAGE_MAPPING,
        standards: AMBERNATH_STS_ACTIVITY_STANDARDS
      }
    }
  }
};

// Helper to determine plant and config from Serial/Model
export const getModelContext = (serialNo: string, model: string, currentPlant?: string) => {
  const sn = serialNo.trim().toUpperCase();
  const m = model.trim().toUpperCase();

  // Explicit check for Li7 model
  if (m === 'LI7' || m === 'Li7' || m.includes('LI7') || m.includes('Li7')) {
    if (m.includes('PCA')) {
      return { plant: "AMBERNATH", type: "Li7 PCA", ...PLANT_REGISTRY.AMBERNATH.models["Li7 PCA"] };
    }
    return { plant: "AMBERNATH", type: "Li7", ...PLANT_REGISTRY.AMBERNATH.models.Li7 };
  }

  if (m === '2X' || m.includes('2X')) {
    return { plant: "AMBERNATH", type: "2X", ...PLANT_REGISTRY.AMBERNATH.models["2X"] };
  }
  if (m === '3X' || m.includes('3X')) {
    return { plant: "AMBERNATH", type: "3X", ...PLANT_REGISTRY.AMBERNATH.models["3X"] };
  }
  if (m === 'STS' || m.includes('STS')) {
    return { plant: "AMBERNATH", type: "STS", ...PLANT_REGISTRY.AMBERNATH.models["STS"] };
  }

  if (m === 'ADANI' || m.includes('ADANI')) {
    return { plant: "CHAKAN", type: "CHILLER_ADANI", ...PLANT_REGISTRY.CHAKAN.models.CHILLER_ADANI };
  }

  if (m === 'PDX' || m.includes('PDX')) {
    return { plant: "CHAKAN", type: "PDX", ...PLANT_REGISTRY.CHAKAN.models.PDX };
  }

  // Logic to determine plant and model sub-type
  if (sn.startsWith('NH')) return { plant: "CHAKAN", type: "CHILLER_NH", ...PLANT_REGISTRY.CHAKAN.models.CHILLER_NH };
  if (sn.startsWith('CH')) return { plant: "CHAKAN", type: "CHILLER_CH", ...PLANT_REGISTRY.CHAKAN.models.CHILLER_CH };
  if (sn.startsWith('ADANI')) return { plant: "CHAKAN", type: "CHILLER_ADANI", ...PLANT_REGISTRY.CHAKAN.models.CHILLER_ADANI };
  
  // Fallback to plant context if provided
  if (currentPlant === "AMBERNATH") {
    return { plant: "AMBERNATH", type: "Li7", ...PLANT_REGISTRY.AMBERNATH.models.Li7 };
  }
  
  // Default to Chakan CHILLER_NH for legacy/unspecified
  return { plant: "CHAKAN", type: "CHILLER_NH", ...PLANT_REGISTRY.CHAKAN.models.CHILLER_NH };
};

export const STAGE_MAPPING = CHAKAN_NH_STAGE_MAPPING; // Legacy compatibility
export const ACTIVITY_STANDARDS = CHAKAN_NH_ACTIVITY_STANDARDS; // Legacy compatibility
// Export STAGES_LIST for admin console compatibility
export const STAGES_LIST = Object.keys(CHAKAN_NH_STAGE_MAPPING);

export const PRODUCT_LINES_LIST = [
  "PDX 1 / 1.5 BAY", "SCU", "PDX 2 / 3 BAY", "PCW 1 / 2 BAY", "PCW 3 / 4 BAY", "FAN ASSEMBLY", "CHILLER", "CHILLER 1", "CHILLER 2", "FWU - 1", "FWU - 2", "FWU - 3", "DSE", "CRV/CRV+", "PKDX", "Li7", "Li7 PCA", "Trinergy"
];

export const MODELS_LIST = [
  "PDX", "PCW", "PNW", "CRV", "CRV+", "SCU", "DME", "CHILLER", "VANTAGE", "PKDX", "FWU", "DSE INDOOR", "DSE OUTDOOR", "Li7", "Li7 PCA", "2X", "3X", "STS", "ADANI"
];

export const SERIAL_NUMBERS_LIST = [
  "Adani1", "CH21", "CH22", "CH23", "CH24", "CH25", "CH26", "CH27",
  "NH10", "NH11", "NH12", "NH13", "NH14", "NH15", "NH16", "NH17", "NH18", "NH19", "NH20", "NH21",
  "NH9", "Sify1", "Sify2", "Sify3", "Sify4", "Sify5",
  "Adani2", "Adani3", "Adani4", "Adani5", "Adani6", "Adani7", "Adani8", "Adani9", "Adani10",
  "NH22", "NH23", "NH24", "NH25", "NH26", "NH27", "NH28", "NH29", "NH30", "NH31", "NH32", "NH33", "NH34", "NH35", "NH36", "NH37", "NH38", "NH39", "NH40",
  "CH28", "CH29", "CH30", "CH31", "CH32", "CH33", "CH34", "CH35", "CH36", "CH37", "CH38", "CH39", "CH40"
];

export const OPERATORS_BY_MODEL_LINE: Record<string, string[]> = {
  "PCW 3 / 4 BAY": ["Akshay Patil", "Ravindra Kadu", "Ganesh Patil", "Kishore Joshi", "Vikrant Shelar", "Nilesh Nivale", "Subodh Padave", "Yogesh Palkar", "Suresh Jadhav", "Sandeep Musale", "Pravin Hande", "Roshan Jatole", "Surendra Raut", "Suraj Jadhav", "Rahul Sadgir", "Pratap Singh Rajput"],
  "CRV/CRV+": ["Vinayak Jawahire", "Pooja Kumbhar", "Prashant Mhatre", "Prashant Patil", "Akshay Satkar", "Chetan Kadam", "Rushikesh Patil", "Swapnil Rajput", "Monika Gadhe", "Ujwal Sardar", "Kunal Patil", "Ritesh Takalkar", "Omkar Bodake", "Dipika Rathod", "Lav Chauhan", "Machhindra Shinde", "Sumit Patil", "Vaibhav Patil", "Govind Kamble"],
  "CHILLER": ["Vimlesh Yadav", "Baliram Rajbhar", "Vedant Jadhav", "Akash Nimkarde", "Vijay Bharude", "Nitesh Mandal", "Dipak Poojari", "Prasant Patil", "Sandhya Sharma", "Rakesh Rajbhar", "Kishan Pal", "Pintu Kumar", "Bhupesh Bhoir", "Ganesh Patil", "Hemant Kokam", "Chetan Mahajan", "Omkar Harane", "Sameer Chavhan", "Ashish Tambutkar", "Chandan Chourasia", "Liladhar Patil", "Suraj Dubakawad", "Kunal Faware", "Sanjay Mandavkar", "Kaustubh Pawar", "Nitin Jadhav", "Dhanraj Patil", "Ganesh Hatankar", "Chetan Malgunkar", "Dipali Khot", "Sanjay Payghade", "Vishal Aware", "Ajinath Kolhe", "Umesh Shinde", "Shankar Thakur", "Manjunath Mastoli", "Mahadev Patole", "Laxman Pradhan", "Dipak Gavali", "Atish Wankhde", "Abhay Bhende", "Prem Khandare", "Prashant Shinde", "Patil Suresh", "Dnyanesh Khairnar", "Pravin Chandekar", "Dinesh Sonawane", "Darshan Jadhar", "Vishal Patil", "Bhushan Patil", "Jayesh Ramane", "Vilas Kande", "Avinash Tayade", "Aditya Bhalekar", "Roshan Kale", "Kiran Yadav", "Dipak Shendage", "Shubham Raut", "Vivek Shinde", "Abhijit Waikar", "Avishakar Patil", "Kuldip Kumar", "Dhanu Naik", "Sagar Damodar", "Shree Singh", "Ratan Kumar", "Pratik Marathe", "Omker Jagatap", "Ashrut Kumar", "Ekanath Patil", "Arbaj Tamboli", "Akshay Adhav", "Ramesh Patil", "Mayur Jadhav", "Ajay Agivale", "Rushikesh Agale", "Binod Kumar", "Sameer Shekh", "Ashik Hussain", "Ramchandra Gadkari"],
  "ADANI": ["Vimlesh Yadav", "Baliram Rajbhar", "Vedant Jadhav", "Akash Nimkarde", "Vijay Bharude", "Nitesh Mandal", "Dipak Poojari", "Prasant Patil", "Sandhya Sharma", "Rakesh Rajbhar", "Kishan Pal", "Pintu Kumar", "Bhupesh Bhoir", "Ganesh Patil", "Hemant Kokam", "Chetan Mahajan", "Omkar Harane", "Sameer Chavhan", "Ashish Tambutkar", "Chandan Chourasia", "Liladhar Patil", "Suraj Dubakawad", "Kunal Faware", "Sanjay Mandavkar", "Kaustubh Pawar", "Nitin Jadhav", "Dhanraj Patil", "Ganesh Hatankar", "Chetan Malgunkar", "Dipali Khot", "Sanjay Payghade", "Vishal Aware", "Ajinath Kolhe", "Umesh Shinde", "Shankar Thakur", "Manjunath Mastoli", "Mahadev Patole", "Laxman Pradhan", "Dipak Gavali", "Atish Wankhde", "Abhay Bhende", "Prem Khandare", "Prashant Shinde", "Patil Suresh", "Dnyanesh Khairnar", "Pravin Chandekar", "Dinesh Sonawane", "Darshan Jadhar", "Vishal Patil", "Bhushan Patil", "Jayesh Ramane", "Vilas Kande", "Avinash Tayade", "Aditya Bhalekar", "Roshan Kale", "Kiran Yadav", "Dipak Shendage", "Shubham Raut", "Vivek Shinde", "Abhijit Waikar", "Avishakar Patil", "Kuldip Kumar", "Dhanu Naik", "Sagar Damodar", "Shree Singh", "Ratan Kumar", "Pratik Marathe", "Omker Jagatap", "Ashrut Kumar", "Ekanath Patil", "Arbaj Tamboli", "Akshay Adhav", "Ramesh Patil", "Mayur Jadhav", "Ajay Agivale", "Rushikesh Agale", "Binod Kumar", "Sameer Shekh", "Ashik Hussain", "Ramchandra Gadkari"],
  "FWU - 1": ["Hanmant Shinde", "Shivaji Kolekar", "Pratik Bondre", "Sahilpratap Patil", "Ajay Kamble", "Durgadas Punam", "Tipu Pawar", "Prajyot Jambeke", "Ajay Mhatre", "Shyamji Yadav", "Dhanesh Kondilkar", "Sunil Randve", "Savta Gaikwad", "Vinod Bondre", "Manish Nagpure", "Akshay Pokale", "Dharmraj Dane", "Kundan Kumar", "Vaibhav Shinde", "Vishwajit Shelke", "Bharat Sonawane", "Prathmesh Desai", "Satish Kurale", "Khanderav Deokate", "Anant Bhagat", "Abhishek Desai", "Ghanshyam Majhi", "Sangam Bagade", "Samir Kurewar", "Dewanand Tembhurne", "Rahul Jadhav", "Ruchita Mestry", "Sneha Raut", "Nilanchal Sandh", "Rahul Saw", "Shrikisan Kayande", "Kiran Patil", "Bhumendra Daharwal", "Saurabh Sahane", "Ram Chandara", "Shubham Pawar", "Roshan Vaidya", "Ritesh Nagade", "Roshan Thakare", "Shyam Bhande", "Sanket Patil", "Omkar Tate", "Hasen Ali", "Yaseen Chappardhand", "Ram Kumar", "Santhosh Topale", "Prajakta More", "Vedant Jadhav", "Shubham Augad", "Ajay Kumar", "Mohammad Jafar", "Irfan Alam", "Ak Akash Chillar", "Shiva Yadav"],
  "FWU - 2": ["Narayan Pawar", "Sudhir Mokal", "Ganesh Chavan", "Snehalata Yevrikar", "Pooja Waghmare", "Shankar Jadhav", "Chetan Vagade", "Sagar Gaikwad", "Ajay Bhore", "Manoj Patil", "Rushikesh Davari", "Omkar Gavade", "Sagar Mane", "Shree Bhosale", "Suraj Jagdale", "Rakesh Sonawane", "Indra Gaikwad", "Prashant Koli", "Omkar Ghag", "Vaibhav Salgar", "Harshat Kurewar", "Prathamesh Ganeshkar", "Ashwini Rathod", "Namdev Khavare", "Adhikrao Ingale", "Yogesh Raskar", "Keshav Khot", "Sameer Patil", "Tushar Shikhare", "Suraj Pachumbre", "Pralhad Barhate", "Tanmay Kale", "Shashikant Kamble", "Suraj Patil", "Indrajit Patil", "Vishal Markal", "Geeta Patel"],
  "PDX": ["Nikhil Gaikwad", "Amol Shelke", "Mahesh Jantre", "Narendra Raut", "Deepak Gaikar", "Trushank Tambe", "Pravin Raut", "Sameer Gage", "Suraj Kamble", "Parmeshwar Jedhe", "Surjeet Sah", "Swati Jadhav", "Dnyaneshwar Shinde", "Ritesh Zope", "Nishikant Gondhale", "Nilesh Kurwade", "Tanuja Jagdane", "Pallavi Fagare", "Sujit Dongare", "Rupesh Gharat", "Pratik Salunkhe", "Ajay Yadav", "Subhash Patil", "Yogesh Dhuware", "Nilesh Naik", "Pandurang Pisal", "Raghunath Thakare", "Nitin Sonawane", "Dharmesh Savaji", "Jai Bhoir", "Ajay Mirkute", "Kundlik Padir", "Gaurav Kharat", "Arati Archana", "Vaibhav Rakhonde", "Kishor Pawar", "Altaf Shaha", "Sandip Davari", "Pallavi Patil", "Shruti Dhande", "Svaraj Gaykwad", "Akash Kurhekar", "Hanumant Gaikwad", "Rahul Mali", "Raviraj Bhate", "Vinayak Magdum"],
  "PDX 2 / 3 BAY": ["Nikhil Gaikwad", "Amol Shelke", "Mahesh Jantre", "Narendra Raut", "Deepak Gaikar", "Trushank Tambe", "Pravin Raut", "Sameer Gage", "Suraj Kamble", "Parmeshwar Jedhe", "Surjeet Sah", "Swati Jadhav", "Dnyaneshwar Shinde", "Ritesh Zope", "Nishikant Gondhale", "Nilesh Kurwade", "Tanuja Jagdane", "Pallavi Fagare", "Sujit Dongare", "Rupesh Gharat", "Pratik Salunkhe", "Ajay Yadav", "Subhash Patil", "Yogesh Dhuware"],
  "PDX 1 / 1.5 BAY": ["Nilesh Naik", "Pandurang Pisal", "Raghunath Thakare", "Nitin Sonawane", "Dharmesh Savaji", "Jai Bhoir", "Ajay Mirkute", "Kundlik Padir", "Gaurav Kharat", "Arati Archana", "Vaibhav Rakhonde", "Kishor Pawar", "Altaf Shaha", "Sandip Davari", "Pallavi Patil", "Shruti Dhande", "Svaraj Gaykwad", "Akash Kurhekar", "Hanumant Gaikwad", "Rahul Mali", "Raviraj Bhate", "Vinayak Magdum"],
  "Li7": ["NILESH SHELKE", "HITESH SHARMA", "NIKHIL MHATRE", "SHEKHAR DHULE", "ARSLAM SHAIKH", "JAYESH SHINGTE", "RIDDESH BHOPI", "RAMAKANT MHATRE", "VISHAL PATIL"],
  "Li7 PCA": ["NILESH SHELKE", "HITESH SHARMA", "NIKHIL MHATRE", "SHEKHAR DHULE", "ARSLAM SHAIKH", "JAYESH SHINGTE", "RIDDESH BHOPI", "RAMAKANT MHATRE", "VISHAL PATIL"],
  "2X": ["Amit Ahirwar", "Yash Perane", "Prasad Lukare", "Ajay Shirke", "Mayur Sonawale", "Ganesh Chinchgharkar", "Prashant Jadhav", "Rahul Jamghare", "Gunvant Shende", "Subodh Hardikar", "Sandeep Pashte"],
  "3X": ["Amit Ahirwar", "Yash Perane", "Prasad Lukare", "Ajay Shirke", "Mayur Sonawale", "Ganesh Chinchgharkar", "Prashant Jadhav", "Rahul Jamghare", "Gunvant Shende", "Subodh Hardikar", "Sandeep Pashte"],
  "STS": ["DHIRAJ SONAWANE", "AJIT THOMBRE", "NISHANT MALI", "SHRIRAM THIGALE", "ROSHAN BHOYE", "SAMADHAN BHOIR", "PRASAD SHENDE", "ARIF SHAIKH", "SAGAR PARADHI", "BHAVESH PATIL", "CHANDRAKANT HANI", "SAURABH MARADE", "DEEP DHUMAL", "MANDAR LUBDE", "SWAPNIL ZUZAM", "SAGAR PATIL", "ADITYA SONAWALE", "SAHIL RAWUL"],
  "Trinergy": ["NILESH SHELKE", "HITESH SHARMA", "NIKHIL MHATRE", "SHEKHAR DHULE", "ARSLAM SHAIKH", "JAYESH SHINGTE", "RIDDESH BHOPI", "RAMAKANT MHATRE", "VISHAL PATIL"]
};

export const LOSS_PARAMETER_MAPPING: Record<string, string[]> = {
  "Admin": ["Bus Delay", "Canteen Related", "Admin related Meetings & Celebrations"],
  "AME": ["Infrastructure challenge"],
  "Engineering": ["ECO Changes Issue/Revision", "BOM Error", "Drawing Error", "Software Issue", "Proto Clearance Delay", "Parts obsolete/EOL", "Drawing unavailability", "Test Procedure"],
  "HR": ["Absenteeism", "IR Issue"],
  "L&D": ["Training"],
  "Lab": ["Inspection - Lab", "Testing Delay", "Rework after customer inspection/proto"],
  "Maintainance": ["Machine breakdown", "Utility Issue"],
  "Manufacturing Quality": ["DL Headcount Allocation", "Inprocess inspection not done/delay", "Aesthetics Issue", "Crimping Issue", "Damaged Material - Inhouse handling", "Fitment Issue", "Foreign Objects", "Labelling Issue", "Component Missing", "Defective/Faulty", "Material not as per specification", "Soldering Issue", "Wire connection interchange", "Wire Open Connection", "Wire Routing Issue"],
  "MEG": ["Closure pendency for Gate 4 & 5", "PI Not Available/Error"],
  "Planning": ["Customer Inspection Delay", "Planning Error", "Not in loading plan", "Not in MRP", "Demand within lead time"],
  "Production": ["Capacity Issue", "Inspection Compliance Pending", "ITR Delay", "Manpower Skill Related", "Production Delay", "Trigger not received"],
  "Purchase": ["PO release issue/delay", "Material Shortage", "Material Shortage - Supplier Delay", "Material Shortage - Supplier Delay - Interco", "Material Shortage - Supplier Capacity Issue", "Material Shortage - Short Supply"],
  "Safety": ["Force Majeure - Safety", "Unsafe working conditions"],
  "Sourcing": ["Material Shortage - Credit Hold by Supplier", "Material Shortage - Supplier Lead Time", "Material Shortage - Commercial Issues", "Material Shortage - Supplier Set up", "Material Shortage - Regulations", "Material Shortage - Force Majeure - Supplier"],
  "Stores": ["GAR Pending", "Material Batching Delay/Issue", "Inventory Discrepancy", "Unloading delay", "Shelf life of the item/products"],
  "Supplier Quality": ["Material Shortage - Wrong Revision at IQC", "Wrong Material Reciept at Shopfloor", "Wrong Revision at Shopfloor", "Quantity Mismatch at Shopfloor", "Wrong Dimension", "Damaged Material - Receipt at IQC", "Component Failure", "Bending Issue", "Welding Issue", "Burr Issue", "Hardware issue", "Powder Coating issue", "Functional issue", "Noise issue", "Plating issue", "Pressure issue"]
};

export const ACTIVITIES_LIST = [
  "Frame Movement",
  "Evaporator Installation",
  "Compressor Installation",
  "Electrical Adaptor Box Mounting",
  "Pump Assembly",
  "Pump VFD Mounting",
  "Hydraulic Piping-1",
  "PHE Mounting",
  "Evaporator Inlet Pipe",
  "Discharge Pipe Installation",
  "Suction Line Installation",
  "Compressor Housing Mounting",
  "Glycol Pump Mounting",
  "Hydraulic Piping-2",
  "V Coil Mounting",
  "Hydraulic Pipe Line Installation",
  "Discharge Line",
  "Liquid Line",
  "Glycol Expansion tanks mounting",
  "Fan Assembly",
  "Fan Wiring",
  "Insulation",
  "Valves Fitting",
  "Wiring",
  "Vacuuming",
  "Refrigerant",
  "Dry Run Test",
  "EOL",
  "Finishing"
];

export const BREAK_TIMES = [
  { name: 'Lunch', start: '12:30', end: '13:00', duration: 30 },
  { name: 'Tea', start: '14:00', end: '14:15', duration: 15 },
  { name: 'Evening', start: '18:30', end: '18:45', duration: 15 },
  { name: 'Dinner', start: '21:00', end: '21:30', duration: 30 },
  { name: 'Non Working Hours', start: '23:31', end: '06:59', duration: 448 }
];

export const AMBERNATH_BREAK_TIMES = [
  { name: 'Lunch', start: '12:15', end: '12:45', duration: 30 },
  { name: 'Tea', start: '15:45', end: '16:00', duration: 15 },
  { name: 'Non Working Hours', start: '17:31', end: '08:59', duration: 928 }
];

export const HOLIDAYS_LIST = [
  "2026-01-01", "2026-01-04", "2026-01-11", "2026-01-18", "2026-01-26",
  "2026-02-01", "2026-02-08", "2026-02-15", "2026-02-22",
  "2026-03-01", "2026-03-03", "2026-03-08", "2026-03-15", "2026-03-19", "2026-03-22", "2026-03-29",
  "2026-04-05", "2026-04-12", "2026-04-19", "2026-04-26",
  "2026-05-01", "2026-05-03", "2026-05-10", "2026-05-17", "2026-05-24", "2026-05-31",
  "2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28",
  "2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26",
  "2026-08-02", "2026-08-09", "2026-08-15", "2026-08-16", "2026-08-23", "2026-08-30",
  "2026-09-05", "2026-09-06", "2026-09-13", "2026-09-14", "2026-09-20", "2026-09-27",
  "2026-10-04", "2026-10-11", "2026-10-18", "2026-10-20", "2026-10-25",
  "2026-11-01", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-15", "2026-11-22", "2026-11-29",
  "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"
];

export const APP_THEME = {
  primary: '#0f172a',
  accent: '#3b82f6',
  danger: '#ef4444',
  success: '#22c55e',
};

// --- Shared Utility Functions ---

export const toMins = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const calculateAvailableMinutes = (startMs: number, endMs: number, customBreakTimes?: any[]): number => {
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
  
  let totalAvailable = 0;
  
  const activeBreaks = customBreakTimes || BREAK_TIMES;
  const nonWorking = activeBreaks.find(b => b.name === 'Non Working Hours');
  
  // Operational window: Default is 07:00 to 23:30. 
  // If custom non-working hours are provided, we derive the window from them.
  let OP_START = 420; // 07:00
  let OP_END = 1410;  // 23:30
  
  if (nonWorking) {
    OP_START = toMins(nonWorking.end);
    OP_END = toMins(nonWorking.start);
  }

  const iter = new Date(startMs);
  iter.setHours(0, 0, 0, 0); 
  
  const limit = new Date(endMs);
  limit.setHours(23, 59, 59, 999); 

  while (iter <= limit) {
    const y = iter.getFullYear();
    const m = String(iter.getMonth() + 1).padStart(2, '0');
    const d = String(iter.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    const isSunday = iter.getDay() === 0;
    
    if (!isSunday && !HOLIDAYS_LIST.includes(dateStr)) {
      const dayStartMs = new Date(`${dateStr}T00:00:00`).getTime();
      
      const relStart = Math.max(0, (startMs - dayStartMs) / 60000);
      const relEnd = Math.min(1440, (endMs - dayStartMs) / 60000);
      
      const s = Math.max(relStart, OP_START);
      const e = Math.min(relEnd, OP_END);
      
      if (s < e) {
        let dailyMins = e - s;
        let breakMins = 0;
        activeBreaks.forEach(b => {
          if (b.name === 'Non Working Hours') return;
          const bs = toMins(b.start);
          const be = toMins(b.end);
          const os = Math.max(s, bs);
          const oe = Math.min(e, be);
          if (os < oe) breakMins += (oe - os);
        });
        totalAvailable += (dailyMins - breakMins);
      }
    }
    iter.setDate(iter.getDate() + 1);
  }
  return Math.max(0, totalAvailable);
};
