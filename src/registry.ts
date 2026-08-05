// Read tools first, write tools after: the order work actually happens in, and the order a model
// reads the list.
import type { ToolDef } from './types.js';
import {
  dayBrief,
  projectReport,
  projectRisks,
  projectsList,
  teamList,
  teamLoad,
  whoami,
} from './tools/reports.js';
import { taskAssign, taskComment, taskCreate, taskGet, taskMove, taskUpdate, tasksSearch } from './tools/tasks.js';
import { demandCreate } from './tools/demand.js';
import { listCreate, listDelete, listPurge, listRename, listRestore, listTrash } from './tools/lists.js';

export const TOOLS: ToolDef[] = [
  // read
  dayBrief,
  projectsList,
  projectReport,
  projectRisks,
  teamLoad,
  teamList,
  tasksSearch,
  taskGet,
  whoami,
  listTrash,
  // write
  demandCreate,
  taskCreate,
  taskUpdate,
  taskAssign,
  taskMove,
  taskComment,
  listCreate,
  listRename,
  listDelete,
  listRestore,
  listPurge,
];
