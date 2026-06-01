/**
 * CRM Sales — Task per cliente
 */
const CrmTasks = (function createCrmTasksModule() {
    const TASK_TYPES = [
        { id: 'call', label: 'Call', icon: 'phone' },
        { id: 'follow-up', label: 'Follow-up', icon: 'refresh-cw' },
        { id: 'proposta', label: 'Proposta', icon: 'file-text' },
        { id: 'email', label: 'Email', icon: 'mail' },
        { id: 'meeting', label: 'Meeting', icon: 'users' },
        { id: 'altro', label: 'Altro', icon: 'check-square' }
    ];
    const ASSIGNEES = ['Jeck', 'Virgi'];
    const FILTERS = [
        { id: 'all', label: 'Tutte' },
        { id: 'open', label: 'Aperte' },
        { id: 'completed', label: 'Completate' },
        { id: 'overdue', label: 'Scadute' }
    ];

    function getTaskTypeMeta(typeId) {
        return TASK_TYPES.find((t) => t.id === typeId) || TASK_TYPES[1];
    }

    function isTaskOverdue(task) {
        if (task.completed || !task.dueDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(`${task.dueDate}T00:00:00`);
        if (Number.isNaN(due.getTime())) return false;
        return due < today;
    }

    function filterTasks(tasks, filterId) {
        switch (filterId) {
            case 'open':
                return tasks.filter((t) => !t.completed);
            case 'completed':
                return tasks.filter((t) => t.completed);
            case 'overdue':
                return tasks.filter((t) => isTaskOverdue(t));
            default:
                return tasks;
        }
    }

    function countOpenTasks(tasks) {
        return tasks.filter((t) => !t.completed).length;
    }

    function getCompletionPercent(tasks) {
        if (tasks.length === 0) return 0;
        const done = tasks.filter((t) => t.completed).length;
        return Math.round((done / tasks.length) * 100);
    }

    function buildClientSidebarHtml(clients, tasks, selectedClientId, searchQuery, esc) {
        const query = (searchQuery || '').toLowerCase().trim();
        const sorted = [...clients]
            .filter((c) => c.relationship !== 'Eliminato')
            .filter((c) => !query || c.name.toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
        if (sorted.length === 0) {
            return '<p class="tasks-sidebar-empty">Nessun cliente trovato.</p>';
        }
        return sorted.map((client) => {
            const clientTasks = tasks.filter((t) => t.clientId === client.id);
            const openCount = countOpenTasks(clientTasks);
            const isActive = client.id === selectedClientId;
            return `
                <button type="button" class="tasks-client-item ${isActive ? 'is-active' : ''}" data-action="select-task-client" data-client-id="${client.id}">
                    <span class="tasks-client-name">${esc(client.name)}</span>
                    ${openCount > 0 ? `<span class="tasks-client-badge">${openCount}</span>` : ''}
                </button>`;
        }).join('');
    }

    function buildProgressHtml(percent, openCount, totalCount) {
        return `
            <div class="tasks-progress-wrap">
                <div class="tasks-progress-meta">
                    <span><strong>${percent}%</strong> completate</span>
                    <span>${openCount} aperte · ${totalCount} totali</span>
                </div>
                <div class="tasks-progress-track">
                    <div class="tasks-progress-fill" style="width:${percent}%"></div>
                </div>
            </div>`;
    }

    function buildTaskCardHtml(task, esc) {
        const typeMeta = getTaskTypeMeta(task.taskType);
        const overdue = isTaskOverdue(task);
        const dueLabel = task.dueDate
            ? `<span class="task-due ${overdue ? 'is-overdue' : ''}"><i data-lucide="calendar"></i> ${task.dueDate}${overdue ? ' · Scaduta' : ''}</span>`
            : '';
        const notesBlock = task.notes
            ? `<p class="task-notes">${esc(task.notes)}</p>`
            : '';
        return `
            <article class="task-card ${task.completed ? 'is-completed' : ''} ${overdue ? 'is-overdue' : ''}" data-task-id="${task.id}">
                <label class="task-check-wrap">
                    <input type="checkbox" class="task-check" data-action="toggle-task" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <span class="task-check-ui"></span>
                </label>
                <div class="task-card-body">
                    <div class="task-card-top">
                        <span class="task-type-chip task-type-${task.taskType}"><i data-lucide="${typeMeta.icon}"></i> ${typeMeta.label}</span>
                        <span class="task-assignee-chip">${esc(task.assignee)}</span>
                    </div>
                    <h4 class="task-title">${esc(task.title)}</h4>
                    ${notesBlock}
                    <div class="task-card-footer">
                        ${dueLabel}
                        <div class="task-card-actions">
                            <button type="button" class="btn-table-action edit" data-action="edit-task" data-task-id="${task.id}" title="Modifica"><i data-lucide="edit"></i></button>
                            <button type="button" class="btn-table-action delete" data-action="delete-task" data-task-id="${task.id}" title="Elimina"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>
            </article>`;
    }

    function sortTasksForDisplay(tasks) {
        return [...tasks].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const aOver = isTaskOverdue(a);
            const bOver = isTaskOverdue(b);
            if (aOver !== bOver) return aOver ? -1 : 1;
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
    }

    function renderSection(container, deps) {
        if (!container) return;
        const {
            clients,
            tasks,
            selectedClientId,
            taskFilter,
            clientSearchQuery,
            escapeHtml
        } = deps;
        const esc = typeof escapeHtml === 'function' ? escapeHtml : (t) => String(t ?? '');
        const selectedClient = clients.find((c) => c.id === selectedClientId);
        const clientTasks = selectedClient
            ? tasks.filter((t) => t.clientId === selectedClientId)
            : [];
        const filteredTasks = sortTasksForDisplay(filterTasks(clientTasks, taskFilter));
        const percent = getCompletionPercent(clientTasks);
        const openCount = countOpenTasks(clientTasks);
        const filterButtons = FILTERS.map((f) => `
            <button type="button" class="tasks-filter-btn ${taskFilter === f.id ? 'is-active' : ''}" data-action="set-task-filter" data-filter="${f.id}">${f.label}</button>
        `).join('');
        const taskCards = filteredTasks.length === 0
            ? `<p class="tasks-empty">${selectedClient ? 'Nessuna task per questo filtro.' : 'Seleziona un cliente dalla lista.'}</p>`
            : filteredTasks.map((task) => buildTaskCardHtml(task, esc)).join('');
        container.innerHTML = `
            <aside class="tasks-client-sidebar glass-card">
                <div class="tasks-sidebar-header">
                    <h3><i data-lucide="users"></i> Clienti</h3>
                </div>
                <input type="text" class="form-input tasks-client-search" id="tasks-client-search" placeholder="Cerca cliente..." value="${esc(clientSearchQuery || '')}">
                <div class="tasks-client-list" id="tasks-client-list">
                    ${buildClientSidebarHtml(clients, tasks, selectedClientId, clientSearchQuery, esc)}
                </div>
            </aside>
            <section class="tasks-main glass-card">
                ${selectedClient ? `
                    <header class="tasks-main-header">
                        <div>
                            <h3>${esc(selectedClient.name)}</h3>
                            <p class="tasks-main-sub">${esc(selectedClient.type)} · ${esc(selectedClient.owner)}</p>
                        </div>
                        <button type="button" class="btn btn-primary" id="btn-add-task">
                            <i data-lucide="plus"></i>
                            <span>Nuova task</span>
                        </button>
                    </header>
                    ${buildProgressHtml(percent, openCount, clientTasks.length)}
                    <div class="tasks-filters">${filterButtons}</div>
                    <div class="tasks-list" id="tasks-list">${taskCards}</div>
                ` : `
                    <div class="tasks-placeholder">
                        <i data-lucide="check-square"></i>
                        <h3>Seleziona un cliente</h3>
                        <p>Scegli un cliente dalla lista per vedere e gestire le sue task.</p>
                    </div>
                `}
            </section>
        `;
        if (typeof window.safeCreateIcons === 'function') window.safeCreateIcons();
    }

    return {
        TASK_TYPES,
        ASSIGNEES,
        FILTERS,
        isTaskOverdue,
        filterTasks,
        countOpenTasks,
        getCompletionPercent,
        buildClientSidebarHtml,
        renderSection
    };
})();
