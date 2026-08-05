import { dayBrief, projectReport, projectRisks, projectsList, teamList, teamLoad, whoami, } from './tools/reports.js';
import { taskAssign, taskComment, taskCreate, taskGet, taskMove, taskUpdate, tasksSearch } from './tools/tasks.js';
import { demandCreate } from './tools/demand.js';
import { listCreate, listDelete, listPurge, listRename, listRestore, listTrash } from './tools/lists.js';
export const TOOLS = [
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
