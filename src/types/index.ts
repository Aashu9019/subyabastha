export type ConditionField = 
  | 'name' 
  | 'extension' 
  | 'size' 
  | 'createdDate' 
  | 'modifiedDate' 
  | 'textContent' 
  | 'pdfContent' 
  | 'pdfAuthor';

export type ConditionOperator = 
  | 'equals'
  | 'in'
  | 'contains'
  | 'starts_with' 
  | 'ends_with' 
  | 'regex' 
  | 'greater_than' 
  | 'less_than';

export interface RuleCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export type ActionType = 
  | 'move' 
  | 'copy' 
  | 'rename' 
  | 'delete' 
  | 'unzip' 
  | 'script' 
  | 'notify';

export interface RuleAction {
  id: string;
  type: ActionType;
  destination?: string;
  pattern?: string;
  scriptPath?: string;
  notifyMessage?: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  monitoredFolders: string[];
  matchType: 'ALL' | 'ANY';
  conditions: RuleCondition[];
  actions: RuleAction[];
  stats: {
    timesTriggered: number;
    lastTriggered: string | null;
  };
}

export interface JournalEntry {
  id: string;
  timestamp: string;
  ruleId: string;
  ruleName: string;
  originalPath: string;
  newPath: string | null;
  actionType: ActionType;
  undone: boolean;
}

export interface AppSettings {
  startOnBoot: boolean;
  minimizeToTray: boolean;
  showNotifications: boolean;
  theme: 'dark' | 'light';
  author: string;
}

export interface DryRunResult {
  filePath: string;
  matchedRules: string[];
  proposedActions: {
    type: ActionType;
    details: string;
  }[];
}
