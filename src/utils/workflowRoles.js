import { WORKFLOW_STAGES } from "./qpmsWorkflow";

export const WORKFLOW_ROLES = [
  {
    id: "management",
    label: "Management View",
    visibleMaxStage: WORKFLOW_STAGES.length,
    editableStages: [],
    canEditFaultRemarks: false,
  },
  {
    id: "ground",
    label: "Ground Team",
    visibleMaxStage: 3,
    editableStages: [1, 2, 3],
    canEditFaultRemarks: false,
  },
  {
    id: "mis",
    label: "MIS Team",
    visibleMaxStage: 7,
    editableStages: [4, 5, 6, 7],
    canEditFaultRemarks: true,
  },
  {
    id: "ops_finance",
    label: "Operations & Finance",
    visibleMaxStage: WORKFLOW_STAGES.length,
    editableStages: [8, 9, 10, 11],
    canEditFaultRemarks: false,
  },
];

export function getRoleConfig(roleId) {
  return WORKFLOW_ROLES.find((role) => role.id === roleId) || WORKFLOW_ROLES[0];
}

export function getStageIndex(stage) {
  return WORKFLOW_STAGES.indexOf(stage) + 1;
}

export function canRoleSeeStage(roleId, stage) {
  const config = getRoleConfig(roleId);
  const stageIndex = typeof stage === "number" ? stage : getStageIndex(stage);
  return stageIndex > 0 && stageIndex <= config.visibleMaxStage;
}

export function canRoleEditStage(roleId, stage) {
  const config = getRoleConfig(roleId);
  const stageIndex = typeof stage === "number" ? stage : getStageIndex(stage);
  return config.editableStages.includes(stageIndex);
}

export function getAllowedStages(roleId) {
  const config = getRoleConfig(roleId);
  return config.editableStages.map((index) => WORKFLOW_STAGES[index - 1]);
}

export function getScopeLabel(roleId, stage) {
  const config = getRoleConfig(roleId);
  const stageIndex = typeof stage === "number" ? stage : getStageIndex(stage);
  const firstEditableStage = config.editableStages.length ? Math.min(...config.editableStages) : null;

  if (!canRoleSeeStage(roleId, stageIndex)) {
    return "Hidden";
  }

  if (canRoleEditStage(roleId, stageIndex)) {
    return "Editable";
  }

  if (firstEditableStage && stageIndex < firstEditableStage) {
    return "Before Your Scope";
  }

  return "Read Only";
}
