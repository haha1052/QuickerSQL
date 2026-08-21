import React, { useState, useEffect, useMemo } from 'react';
import { useTaskStore, useToastStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import type {
  Task,
  TaskType,
  TaskState,
  CreateTaskPayload,
  UpdateTaskPayload,
  DependencyType,
  DependencyConfig,
  TimeIntervalConfig,
  CronConfig,
  TaskSuccessConfig,
} from '../../types/automation';
import { parseDependencyConfig, serializeDependencyConfig } from '../../types/automation';
import {
  type DraftState,
  type DraftDependency,
  type InitialPayload,
  TASK_TYPE_OPTIONS,
  DEPENDENCY_TYPE_LABELS,
  formStyles,
  getInitialDraft,
  migrateScheduleToDeps,
  getDependencyDescription,
  getScheduleFromDeps,
  buildPayloadString,
} from './forms/shared';
import { SqlTaskForm } from './forms/SqlTaskForm';
import { RefreshChartTaskForm } from './forms/RefreshChartTaskForm';
import { RefreshDashboardTaskForm } from './forms/RefreshDashboardTaskForm';
import { ExportCsvTaskForm } from './forms/ExportCsvTaskForm';
import { DependencyEditorModal } from './forms/DependencyEditorModal';

interface TaskEditorModalProps {
  open: boolean;
  task?: Task | null;
  onClose: () => void;
  initialTaskType?: TaskType;
  initialPayload?: InitialPayload;
  initialName?: string;
}

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  open,
  task,
  onClose,
  initialTaskType,
  initialPayload,
  initialName,
}) => {
  const { createTask, updateTask, loadTasks, dependencies, loadDependencies, replaceDependencies } =
    useTaskStore();
  const { addToast } = useToastStore();
  const { t } = useLocale();
  const [draft, setDraft] = useState<DraftState>(
    getInitialDraft(task, initialTaskType, initialPayload, initialName),
  );
  const [deps, setDeps] = useState<DraftDependency[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDepForm, setShowDepForm] = useState(false);
  const [editingDepIndex, setEditingDepIndex] = useState<number | null>(null);
  const [depFormType, setDepFormType] = useState<DependencyType>('time_interval');
  const [depFormConfig, setDepFormConfig] = useState<DependencyConfig | null>(null);

  const allTasks = useTaskStore((s) => s.tasks);
  const isEdit = Boolean(task);

  const availableTasks = useMemo(() => {
    if (!task) return allTasks;
    return allTasks.filter((t) => t.id !== task.id);
  }, [allTasks, task]);

  useEffect(() => {
    if (open) {
      setDraft(getInitialDraft(task, initialTaskType, initialPayload, initialName));
      setError(null);
      setSaving(false);
      setShowDepForm(false);
      setEditingDepIndex(null);
      if (task) {
        const cachedDeps = dependencies[task.id];
        if (cachedDeps && cachedDeps.length > 0) {
          setDeps(
            cachedDeps.map((d) => ({
              id: d.id,
              dependencyType: d.dependencyType,
              dependencyConfig: d.dependencyConfig,
            })),
          );
        } else {
          loadDependencies(task.id).then(() => {
            const currentDeps = useTaskStore.getState().dependencies[task.id];
            if (currentDeps && currentDeps.length > 0) {
              setDeps(
                currentDeps.map((d) => ({
                  id: d.id,
                  dependencyType: d.dependencyType,
                  dependencyConfig: d.dependencyConfig,
                })),
              );
            } else {
              setDeps(migrateScheduleToDeps(task.scheduleMode, task.scheduleValue));
            }
          });
        }
      } else {
        setDeps([]);
      }
    }
  }, [open, task, initialTaskType, initialPayload, initialName]);

  if (!open) return null;

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /** 子表单使用的 patch 合并更新函数 */
  const updateForm = (patch: Partial<DraftState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const openAddDepForm = (type: DependencyType) => {
    setDepFormType(type);
    setEditingDepIndex(null);
    let initialConfig: DependencyConfig;
    switch (type) {
      case 'time_interval':
        initialConfig = { intervalSeconds: 3600 };
        break;
      case 'cron':
        initialConfig = { expression: '0 * * * *', timezone: 'local' };
        break;
      case 'task_success':
        initialConfig = { upstreamTaskId: availableTasks[0]?.id || '', delaySeconds: 0 };
        break;
      case 'task_completed':
        initialConfig = { upstreamTaskId: availableTasks[0]?.id || '', delaySeconds: 0 };
        break;
    }
    setDepFormConfig(initialConfig);
    setShowDepForm(true);
  };

  const openEditDepForm = (index: number) => {
    const dep = deps[index];
    const config = parseDependencyConfig(dep.dependencyConfig);
    if (!config) return;
    setDepFormType(dep.dependencyType);
    setEditingDepIndex(index);
    setDepFormConfig(config);
    setShowDepForm(true);
  };

  const closeDepForm = () => {
    setShowDepForm(false);
    setEditingDepIndex(null);
    setDepFormConfig(null);
  };

  const saveDepForm = () => {
    if (!depFormConfig) return;
    const newDep: DraftDependency = {
      dependencyType: depFormType,
      dependencyConfig: serializeDependencyConfig(depFormConfig),
    };
    if (editingDepIndex !== null) {
      const newDeps = [...deps];
      newDeps[editingDepIndex] = { ...newDep, id: deps[editingDepIndex].id };
      setDeps(newDeps);
    } else {
      setDeps([...deps, newDep]);
    }
    closeDepForm();
  };

  const deleteDep = (index: number) => {
    setDeps(deps.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return t('task.error.nameRequired');
    if (!['sql', 'refresh_chart', 'refresh_dashboard', 'export_csv'].includes(draft.taskType)) {
      return t('task.error.typeRequired');
    }
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      const config = parseDependencyConfig(dep.dependencyConfig);
      if (!config) return t('task.error.depConfigInvalid', { index: i + 1 });
      if (dep.dependencyType === 'time_interval') {
        const c = config as TimeIntervalConfig;
        if (!c.intervalSeconds || c.intervalSeconds <= 0) {
          return t('task.error.intervalPositive', { index: i + 1 });
        }
      }
      if (dep.dependencyType === 'cron') {
        const c = config as CronConfig;
        if (!c.expression || !c.expression.trim()) {
          return t('task.error.cronEmpty', { index: i + 1 });
        }
      }
      if (dep.dependencyType === 'task_success' || dep.dependencyType === 'task_completed') {
        const c = config as TaskSuccessConfig;
        if (!c.upstreamTaskId) {
          return t('task.error.predecessorEmpty', { index: i + 1 });
        }
      }
    }
    if (draft.taskType === 'sql' && !draft.sql.trim()) return t('task.error.sqlRequired');
    if (draft.taskType === 'refresh_chart' && !draft.chartId.trim()) return t('task.error.chartIdRequired');
    if (draft.taskType === 'refresh_dashboard' && !draft.dashboardId.trim()) return t('task.error.dashboardIdRequired');
    if (draft.taskType === 'export_csv' && (!draft.csvSql.trim() || !draft.csvOutputPath.trim())) {
      return t('task.error.sqlAndOutputRequired');
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { scheduleMode, scheduleValue } = getScheduleFromDeps(deps);
      const payloadString = buildPayloadString(draft.taskType, draft);
      if (isEdit && task) {
        const patch: UpdateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          payload: payloadString,
          scheduleMode,
          scheduleValue: scheduleMode === 'manual' ? '' : scheduleValue,
          state: draft.state,
        };
        await updateTask(task.id, patch);
        await replaceDependencies(
          task.id,
          deps.map((d) => ({
            dependencyType: d.dependencyType,
            dependencyConfig: d.dependencyConfig,
          })),
        );
        addToast(t('task.updated'), 'success');
      } else {
        const create: CreateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          taskType: draft.taskType,
          payload: payloadString,
          scheduleMode,
          scheduleValue: scheduleMode === 'manual' ? '' : scheduleValue,
          state: draft.state,
          retryOnFail: draft.retryOnFail,
          timeoutSecs: draft.timeoutSecs,
        };
        const created = await createTask(create);
        if (created && deps.length > 0) {
          await replaceDependencies(
            created.id,
            deps.map((d) => ({
              dependencyType: d.dependencyType,
              dependencyConfig: d.dependencyConfig,
            })),
          );
        }
      }
      await loadTasks();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(t('task.error.saveFailedMsg', { msg }));
      addToast(t('task.error.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={formStyles.overlay} onClick={onClose}>
      <div style={formStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={formStyles.header}>
          <h3 style={formStyles.title}>{isEdit ? t('task.editTitle') : t('task.newTitle')}</h3>
          <button style={formStyles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={formStyles.body}>
          <div style={formStyles.field}>
            <label style={formStyles.label}>{t('task.fieldName')} *</label>
            <input
              style={formStyles.input}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('task.namePlaceholder')}
            />
          </div>

          <div style={formStyles.field}>
            <label style={formStyles.label}>{t('task.fieldDescription')}</label>
            <textarea
              style={{ ...formStyles.textarea, minHeight: '56px' }}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={t('task.descriptionPlaceholder')}
            />
          </div>

          <div style={formStyles.twoCol}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>{t('task.fieldType')} *</label>
              <select
                style={formStyles.select}
                value={draft.taskType}
                onChange={(e) => set('taskType', e.target.value as TaskType)}
              >
                {TASK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>{t('task.fieldStatus')}</label>
              <select
                style={formStyles.select}
                value={draft.state}
                onChange={(e) => set('state', e.target.value as TaskState)}
              >
                <option value="enabled">{t('task.enabled')}</option>
                <option value="disabled">{t('task.disabled')}</option>
                <option value="paused">{t('task.paused')}</option>
              </select>
            </div>
          </div>

          <div style={formStyles.dependencySection}>
            <div style={formStyles.dependencyHeader}>
              <label style={formStyles.label}>{t('task.fieldTrigger')}</label>
            </div>
            <div style={formStyles.dependencyList}>
              {deps.length === 0 ? (
                <div style={formStyles.emptyDeps}>{t('task.emptyDeps')}</div>
              ) : (
                deps.map((dep, index) => (
                  <div key={index} style={formStyles.depItem}>
                    <div style={formStyles.depItemLeft}>
                      <span style={formStyles.depTypeTag}>
                        {DEPENDENCY_TYPE_LABELS[dep.dependencyType]}
                      </span>
                      <span style={formStyles.depDesc}>
                        {getDependencyDescription(dep, allTasks)}
                      </span>
                    </div>
                    <div style={formStyles.depItemActions}>
                      <button
                        style={formStyles.iconBtn}
                        onClick={() => openEditDepForm(index)}
                        title={t('common.edit')}
                      >
                        ✎
                      </button>
                      <button
                        style={formStyles.iconBtn}
                        onClick={() => deleteDep(index)}
                        title={t('common.delete')}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={formStyles.addDepBtnRow}>
              <div style={formStyles.addDepBtnGroup}>
                <button style={formStyles.addDepBtn} onClick={() => openAddDepForm('time_interval')}>
                  + {t('task.addInterval')}
                </button>
                <button style={formStyles.addDepBtn} onClick={() => openAddDepForm('cron')}>
                  + {t('task.addCron')}
                </button>
                <button style={formStyles.addDepBtn} onClick={() => openAddDepForm('task_success')}>
                  + {t('task.addSuccess')}
                </button>
                <button style={formStyles.addDepBtn} onClick={() => openAddDepForm('task_completed')}>
                  + {t('task.addComplete')}
                </button>
              </div>
            </div>
          </div>

          {draft.taskType === 'sql' && <SqlTaskForm form={draft} updateForm={updateForm} />}
          {draft.taskType === 'refresh_chart' && (
            <RefreshChartTaskForm form={draft} updateForm={updateForm} />
          )}
          {draft.taskType === 'refresh_dashboard' && (
            <RefreshDashboardTaskForm form={draft} updateForm={updateForm} />
          )}
          {draft.taskType === 'export_csv' && (
            <ExportCsvTaskForm form={draft} updateForm={updateForm} />
          )}

          <div style={formStyles.twoCol}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>{t('task.fieldRetryCount')}</label>
              <input
                style={formStyles.input}
                type="number"
                min={0}
                value={draft.retryOnFail}
                onChange={(e) => set('retryOnFail', parseInt(e.target.value || '0', 10))}
              />
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>{t('task.fieldTimeout')}</label>
              <input
                style={formStyles.input}
                type="number"
                min={1}
                value={draft.timeoutSecs}
                onChange={(e) => set('timeoutSecs', parseInt(e.target.value || '300', 10))}
              />
            </div>
          </div>

          {error && <div style={formStyles.errorBox}>⚠️ {error}</div>}
        </div>

        <div style={formStyles.footer}>
          <button style={formStyles.cancelBtn} onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button
            style={formStyles.saveBtn}
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? t('task.saving') : t('common.save')}
          </button>
        </div>

        <DependencyEditorModal
          open={showDepForm}
          editingDepIndex={editingDepIndex}
          depFormType={depFormType}
          depFormConfig={depFormConfig}
          availableTasks={availableTasks}
          onTypeChange={openAddDepForm}
          onConfigChange={setDepFormConfig}
          onClose={closeDepForm}
          onSave={saveDepForm}
        />
      </div>
    </div>
  );
};
