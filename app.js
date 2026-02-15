/* ===================================================
   Ultimate Todo App — Application Engine (localStorage)
   =================================================== */
(() => {
    'use strict';

    // Global error handler
    window.onerror = function (msg, url, line) {
        console.error('JS Error:', msg, 'at line', line);
    };

    // ============================================================
    //  CONSTANTS
    // ============================================================
    const KEYS = {
        TODOS: 'utodo-items',
        PROJECTS: 'utodo-projects',
        TAGS: 'utodo-tags',
        COLLAPSED: 'utodo-collapsed',
        THEME: 'utodo-theme',
        SORT: 'utodo-sort',
        POMODORO: 'utodo-pomodoro-sessions',
    };

    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const PRIORITY_LABELS = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };

    const COLOR_PALETTE = [
        '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
        '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1',
        '#84CC16', '#E11D48'
    ];

    // ============================================================
    //  STORAGE
    // ============================================================
    function load(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; }
        catch (e) { return fallback; }
    }
    function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

    // ============================================================
    //  STATE
    // ============================================================
    let todos = load(KEYS.TODOS, []);
    let projects = load(KEYS.PROJECTS, [
        { id: 'inbox', name: 'Inbox', color: '#7C3AED' },
        { id: 'work', name: 'Work', color: '#3B82F6' },
        { id: 'personal', name: 'Personal', color: '#10B981' }
    ]);
    let tags = load(KEYS.TAGS, [
        { id: 'tag-urgent', name: 'Urgent', color: '#EF4444' },
        { id: 'tag-feature', name: 'Feature', color: '#3B82F6' },
        { id: 'tag-bug', name: 'Bug', color: '#F97316' }
    ]);
    let collapsedState = load(KEYS.COLLAPSED, {});
    let currentView = 'inbox';
    let currentSort = load(KEYS.SORT, 'date');
    let searchQuery = '';
    let undoStack = [];
    let undoTimer = null;
    let editingTaskId = null;

    // Migrate old todos
    (function migrate() {
        let changed = false;
        const todayStr = isoDate(new Date());
        for (let i = 0; i < todos.length; i++) {
            const t = todos[i];
            if (!t.date) { t.date = todayStr; changed = true; }
            if (!t.priority) { t.priority = 4; changed = true; }
            if (!t.project) { t.project = 'inbox'; changed = true; }
            if (!t.tags) { t.tags = []; changed = true; }
            if (!t.subtasks) { t.subtasks = []; changed = true; }
            if (!t.notes) { t.notes = ''; changed = true; }
            if (t.starred === undefined) { t.starred = false; changed = true; }
            if (!t.recurring) { t.recurring = ''; changed = true; }
            if (!t.createdAt) { t.createdAt = Date.now(); changed = true; }
        }
        if (changed) save(KEYS.TODOS, todos);
    })();

    // ============================================================
    //  DOM REFS
    // ============================================================
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    const sidebar = $('sidebar');
    const sidebarOverlay = $('sidebar-overlay');
    const viewTitle = $('view-title');
    const container = $('task-container');
    const emptyState = $('empty-state');
    const progressFill = $('progress-fill');
    const progressLabel = $('progress-label');
    const searchInput = $('search-input');
    const sortSelect = $('sort-select');
    const newTaskInput = $('new-task-input');
    const newTaskDate = $('new-task-date');
    const newTaskPriority = $('new-task-priority');
    const newTaskProject = $('new-task-project');
    const newTaskStarBtn = $('new-task-star');
    const addTaskBtn = $('add-task-btn');
    const navItems = $$('.nav-item');
    const projectList = $('project-list');
    const tagList = $('tag-list');
    const undoToast = $('undo-toast');
    const undoToastMsg = $('undo-toast-msg');
    const undoBtn = $('undo-btn');
    const confettiCanvas = $('confetti-canvas');

    // Set defaults
    newTaskDate.value = isoDate(new Date());
    const savedTheme = localStorage.getItem(KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI();
    sortSelect.value = currentSort;

    // ============================================================
    //  HELPERS
    // ============================================================
    function uuid() {
        return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    function isoDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseDateParts(s) {
        const p = s.split('-');
        return { year: +p[0], month: +p[1], day: +p[2] };
    }

    function isToday(dateStr) { return dateStr === isoDate(new Date()); }
    function isOverdue(dateStr) { return dateStr && !isToday(dateStr) && dateStr < isoDate(new Date()); }

    function isUpcoming(dateStr) {
        const today = new Date();
        const target = new Date(dateStr + 'T00:00:00');
        return (target - today) / 864e5 >= 0 && (target - today) / 864e5 <= 7;
    }

    function formatRelativeDate(dateStr) {
        if (!dateStr) return '';
        if (isToday(dateStr)) return 'Today';
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateStr === isoDate(tomorrow)) return 'Tomorrow';
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (dateStr === isoDate(yesterday)) return 'Yesterday';
        const p = parseDateParts(dateStr);
        return MONTH_NAMES[p.month - 1].slice(0, 3) + ' ' + p.day;
    }

    // ============================================================
    //  FILTERING & SORTING
    // ============================================================
    function getViewTodos() {
        let list = todos;
        switch (currentView) {
            case 'inbox': list = todos.filter(t => t.project === 'inbox'); break;
            case 'today': list = todos.filter(t => isToday(t.date) && !t.completed); break;
            case 'upcoming': list = todos.filter(t => isUpcoming(t.date) && !t.completed); break;
            case 'completed': list = todos.filter(t => t.completed); break;
            case 'overdue': list = todos.filter(t => isOverdue(t.date) && !t.completed); break;
            default:
                if (currentView.startsWith('project-')) {
                    const pid = currentView.slice(8);
                    list = todos.filter(t => t.project === pid);
                } else if (currentView.startsWith('tag-')) {
                    const tid = currentView.slice(4);
                    list = todos.filter(t => t.tags && t.tags.indexOf(tid) !== -1);
                }
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(t => t.text.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q)));
        }
        return sortTodos(list);
    }

    function sortTodos(list) {
        const sorted = list.slice();
        switch (currentSort) {
            case 'priority': sorted.sort((a, b) => a.priority - b.priority || (a.date > b.date ? 1 : -1)); break;
            case 'alpha': sorted.sort((a, b) => a.text.localeCompare(b.text)); break;
            case 'created': sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
            default:
                sorted.sort((a, b) => {
                    if (a.starred !== b.starred) return a.starred ? -1 : 1;
                    if (a.date > b.date) return -1;
                    if (a.date < b.date) return 1;
                    return a.priority - b.priority;
                });
        }
        return sorted;
    }

    function groupByDate(list) {
        const groups = new Map();
        for (const todo of list) {
            const d = todo.date || '';
            if (!groups.has(d)) groups.set(d, []);
            groups.get(d).push(todo);
        }
        return groups;
    }

    // ============================================================
    //  RENDER
    // ============================================================
    function render() {
        const visible = getViewTodos();
        container.innerHTML = '';

        if (visible.length > 0) {
            if (currentSort === 'date') {
                const groups = groupByDate(visible);
                const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
                for (const dateStr of sortedDates) {
                    container.appendChild(buildDateGroup(dateStr, groups.get(dateStr)));
                }
            } else {
                for (const todo of visible) container.appendChild(createTaskEl(todo));
            }
        }

        emptyState.classList.toggle('hidden', visible.length > 0);
        updateProgress();
        updateBadges();
        save(KEYS.TODOS, todos);
    }

    function buildDateGroup(dateStr, items) {
        const key = 'date-' + dateStr;
        const isCol = collapsedState[key];

        const wrap = document.createElement('div');
        wrap.className = 'date-group';

        // Header
        const header = document.createElement('div');
        header.className = 'date-group__header' +
            (isCol ? ' collapsed' : '') +
            (isOverdue(dateStr) ? ' date-group__header--overdue' : '') +
            (isToday(dateStr) ? ' date-group__header--today' : '');

        header.appendChild(makeChevron(14));

        const selectAll = makeGroupCheckbox(items.map(t => t.id));
        header.appendChild(selectAll);

        const label = document.createElement('span');
        label.className = 'date-group__label';
        if (dateStr) {
            const p = parseDateParts(dateStr);
            const dayName = DAY_NAMES[new Date(p.year, p.month - 1, p.day).getDay()];
            label.textContent = formatRelativeDate(dateStr) + ' — ' + dayName + ', ' +
                MONTH_NAMES[p.month - 1].slice(0, 3) + ' ' + p.day + ', ' + p.year;
        } else {
            label.textContent = 'No Date';
        }
        header.appendChild(label);

        const count = document.createElement('span');
        count.className = 'date-group__count';
        count.textContent = items.filter(t => t.completed).length + '/' + items.length;
        header.appendChild(count);

        // Body
        const body = document.createElement('div');
        body.className = 'date-group__body' + (isCol ? ' collapsed' : '');

        for (let i = 0; i < items.length; i++) {
            const el = createTaskEl(items[i]);
            el.style.animationDelay = (i * 25) + 'ms';
            body.appendChild(el);
        }

        header.addEventListener('click', function (e) {
            var el = e.target;
            while (el && el !== header) {
                if (el.type === 'checkbox' || (el.classList && el.classList.contains('date-group__select-all'))) return;
                el = el.parentElement;
            }
            collapsedState[key] = !collapsedState[key];
            save(KEYS.COLLAPSED, collapsedState);
            header.classList.toggle('collapsed');
            body.classList.toggle('collapsed');
        });

        wrap.appendChild(header);
        wrap.appendChild(body);
        return wrap;
    }

    function makeGroupCheckbox(todoIds) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'date-group__select-all';
        const group = todoIds.map(id => todos.find(t => t.id === id)).filter(Boolean);
        const allDone = group.length > 0 && group.every(t => t.completed);
        const noneDone = group.every(t => !t.completed);
        cb.checked = allDone;
        cb.indeterminate = !allDone && !noneDone;
        cb.addEventListener('click', e => e.stopPropagation());
        cb.addEventListener('change', () => {
            const shouldComplete = !group.every(t => t.completed);
            for (const id of todoIds) {
                const todo = todos.find(t => t.id === id);
                if (todo) todo.completed = shouldComplete;
            }
            render();
        });
        return cb;
    }

    // ============================================================
    //  TASK ELEMENT
    // ============================================================
    function createTaskEl(todo) {
        const div = document.createElement('div');
        div.className = 'task-item' + (todo.completed ? ' task-item--completed' : '') +
            (isOverdue(todo.date) && !todo.completed ? ' task-item--overdue' : '');
        div.dataset.id = todo.id;
        div.draggable = true;

        // Priority flag
        const flag = document.createElement('div');
        flag.className = 'task-item__priority-flag task-item__priority-flag--' + todo.priority;
        div.appendChild(flag);

        // Star
        const star = document.createElement('button');
        star.className = 'task-item__star' + (todo.starred ? ' starred' : '');
        star.textContent = todo.starred ? '★' : '☆';
        star.addEventListener('click', (e) => { e.stopPropagation(); toggleStar(todo.id); });
        div.appendChild(star);

        // Checkbox
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'task-item__cb task-item__cb--p' + todo.priority;
        cb.checked = todo.completed;
        cb.addEventListener('change', () => toggleComplete(todo.id));
        div.appendChild(cb);

        // Body (clickable for detail modal)
        const body = document.createElement('div');
        body.className = 'task-item__body';
        body.addEventListener('click', () => openTaskModal(todo.id));

        const text = document.createElement('div');
        text.className = 'task-item__text';
        text.textContent = todo.text;
        body.appendChild(text);

        // Meta row
        const meta = document.createElement('div');
        meta.className = 'task-item__meta';

        const dateBadge = document.createElement('span');
        dateBadge.className = 'task-item__date-badge' + (isOverdue(todo.date) && !todo.completed ? ' task-item__date-badge--overdue' : '');
        dateBadge.textContent = formatRelativeDate(todo.date);
        meta.appendChild(dateBadge);

        const proj = projects.find(p => p.id === todo.project);
        if (proj && proj.id !== 'inbox') {
            const pb = document.createElement('span');
            pb.className = 'task-item__project-badge';
            pb.style.background = proj.color + '20';
            pb.style.color = proj.color;
            pb.textContent = proj.name;
            meta.appendChild(pb);
        }

        if (todo.tags) for (const tagId of todo.tags) {
            const tag = tags.find(t => t.id === tagId);
            if (tag) {
                const te = document.createElement('span');
                te.className = 'task-item__tag';
                te.style.background = tag.color + '20';
                te.style.color = tag.color;
                te.textContent = tag.name;
                meta.appendChild(te);
            }
        }

        if (todo.subtasks && todo.subtasks.length > 0) {
            const sc = document.createElement('span');
            sc.className = 'task-item__subtask-count';
            sc.textContent = '✓ ' + todo.subtasks.filter(s => s.completed).length + '/' + todo.subtasks.length;
            meta.appendChild(sc);
        }

        if (todo.recurring) {
            const rc = document.createElement('span');
            rc.className = 'task-item__recurring-badge';
            rc.textContent = '🔄 ' + todo.recurring;
            meta.appendChild(rc);
        }

        body.appendChild(meta);
        div.appendChild(body);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'task-item__actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'task-item__btn task-item__btn--edit';
        editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(todo.id); });

        const delBtn = document.createElement('button');
        delBtn.className = 'task-item__btn task-item__btn--delete';
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTodo(todo.id); });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        div.appendChild(actions);

        // Drag
        div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', todo.id); div.classList.add('task-item--dragging'); });
        div.addEventListener('dragend', () => div.classList.remove('task-item--dragging'));
        div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('task-item--dragover'); });
        div.addEventListener('dragleave', () => div.classList.remove('task-item--dragover'));
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.classList.remove('task-item--dragover');
            const did = e.dataTransfer.getData('text/plain');
            if (did && did !== todo.id) reorderTodo(did, todo.id);
        });

        return div;
    }

    // ============================================================
    //  CRUD
    // ============================================================
    function addTodo() {
        const text = newTaskInput.value.trim();
        if (!text) return;
        todos.unshift({
            id: uuid(), text, completed: false,
            date: newTaskDate.value || isoDate(new Date()),
            priority: parseInt(newTaskPriority.value) || 4,
            project: newTaskProject.value || 'inbox',
            tags: [], subtasks: [], notes: '',
            starred: newTaskStarBtn.classList.contains('starred'),
            recurring: '', createdAt: Date.now(),
        });
        render();
        newTaskInput.value = '';
        newTaskStarBtn.classList.remove('starred');
        newTaskStarBtn.textContent = '☆';
        newTaskInput.focus();
    }

    function toggleComplete(id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        todo.completed = !todo.completed;
        if (todo.completed && todo.recurring) {
            const n = JSON.parse(JSON.stringify(todo));
            n.id = uuid(); n.completed = false; n.createdAt = Date.now();
            const d = new Date(todo.date + 'T00:00:00');
            if (todo.recurring === 'daily') d.setDate(d.getDate() + 1);
            else if (todo.recurring === 'weekly') d.setDate(d.getDate() + 7);
            else if (todo.recurring === 'monthly') d.setMonth(d.getMonth() + 1);
            n.date = isoDate(d);
            n.subtasks = n.subtasks.map(s => ({ ...s, completed: false }));
            todos.unshift(n);
        }
        render();
        checkConfetti();
    }

    function toggleStar(id) {
        const todo = todos.find(t => t.id === id);
        if (todo) { todo.starred = !todo.starred; render(); }
    }

    function deleteTodo(id) {
        const idx = todos.findIndex(t => t.id === id);
        if (idx === -1) return;
        const removed = todos.splice(idx, 1)[0];
        pushUndo('Task deleted', [removed], idx);
        const el = container.querySelector('[data-id="' + id + '"]');
        if (el) {
            el.classList.add('task-item--removing');
            el.addEventListener('animationend', () => render(), { once: true });
        } else render();
    }

    function reorderTodo(draggedId, targetId) {
        const di = todos.findIndex(t => t.id === draggedId);
        const ti = todos.findIndex(t => t.id === targetId);
        if (di === -1 || ti === -1) return;
        const [item] = todos.splice(di, 1);
        todos.splice(ti, 0, item);
        render();
    }

    // ============================================================
    //  TASK DETAIL MODAL
    // ============================================================
    function openTaskModal(id) {
        editingTaskId = id;
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        $('detail-title').value = todo.text;
        $('detail-notes').value = todo.notes || '';
        $('detail-date').value = todo.date;
        $('detail-priority').value = todo.priority;
        $('detail-recurring').value = todo.recurring || '';

        const projSelect = $('detail-project');
        projSelect.innerHTML = '';
        for (const p of projects) {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name;
            if (p.id === todo.project) opt.selected = true;
            projSelect.appendChild(opt);
        }

        const tagContainer = $('detail-tags');
        tagContainer.innerHTML = '';
        for (const tag of tags) {
            const el = document.createElement('span');
            el.className = 'detail-tag' + (todo.tags.indexOf(tag.id) !== -1 ? ' selected' : '');
            el.style.background = tag.color + '20';
            el.style.color = tag.color;
            el.textContent = tag.name;
            el.dataset.tagId = tag.id;
            el.addEventListener('click', () => el.classList.toggle('selected'));
            tagContainer.appendChild(el);
        }

        renderSubtasks(todo);
        showModal('task-modal-overlay');
    }

    function saveTaskDetail() {
        const todo = todos.find(t => t.id === editingTaskId);
        if (!todo) return;
        todo.text = $('detail-title').value.trim() || todo.text;
        todo.notes = $('detail-notes').value;
        todo.date = $('detail-date').value || todo.date;
        todo.priority = parseInt($('detail-priority').value);
        todo.project = $('detail-project').value;
        todo.recurring = $('detail-recurring').value;

        const selectedTags = [];
        for (const el of $('detail-tags').querySelectorAll('.detail-tag.selected')) {
            if (el.dataset.tagId) selectedTags.push(el.dataset.tagId);
        }
        todo.tags = selectedTags;

        hideModal('task-modal-overlay');
        render();
    }

    function renderSubtasks(todo) {
        const list = $('subtask-list');
        list.innerHTML = '';
        if (!todo.subtasks) todo.subtasks = [];
        for (let i = 0; i < todo.subtasks.length; i++) {
            const st = todo.subtasks[i];
            const li = document.createElement('li');
            li.className = 'subtask-item';

            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.className = 'subtask-item__cb'; cb.checked = st.completed;
            cb.addEventListener('change', () => { st.completed = cb.checked; txtInput.classList.toggle('subtask-item__text--done', cb.checked); save(KEYS.TODOS, todos); });

            const txtInput = document.createElement('input');
            txtInput.type = 'text';
            txtInput.className = 'subtask-item__text' + (st.completed ? ' subtask-item__text--done' : '');
            txtInput.value = st.text;
            txtInput.addEventListener('blur', () => { st.text = txtInput.value.trim() || st.text; save(KEYS.TODOS, todos); });

            const delBtn = document.createElement('button');
            delBtn.className = 'subtask-item__delete'; delBtn.textContent = '×';
            delBtn.addEventListener('click', () => { todo.subtasks.splice(i, 1); save(KEYS.TODOS, todos); renderSubtasks(todo); });

            li.appendChild(cb); li.appendChild(txtInput); li.appendChild(delBtn);
            list.appendChild(li);
        }
    }

    $('add-subtask-btn').addEventListener('click', () => {
        const todo = todos.find(t => t.id === editingTaskId);
        if (!todo) return;
        if (!todo.subtasks) todo.subtasks = [];
        todo.subtasks.push({ id: uuid(), text: '', completed: false });
        save(KEYS.TODOS, todos);
        renderSubtasks(todo);
        const inputs = $('subtask-list').querySelectorAll('.subtask-item__text');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    });

    $('detail-save-btn').addEventListener('click', saveTaskDetail);
    $('detail-delete-btn').addEventListener('click', () => { if (editingTaskId) { hideModal('task-modal-overlay'); deleteTodo(editingTaskId); } });

    // ============================================================
    //  MODALS
    // ============================================================
    function showModal(id) { $(id).classList.remove('hidden'); }
    function hideModal(id) { $(id).classList.add('hidden'); }

    ['task-modal-overlay', 'stats-modal-overlay', 'shortcuts-modal-overlay', 'project-modal-overlay', 'tag-modal-overlay'].forEach(id => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) hideModal(id); });
    });
    $('task-modal-close').addEventListener('click', () => hideModal('task-modal-overlay'));
    $('stats-modal-close').addEventListener('click', () => hideModal('stats-modal-overlay'));
    $('shortcuts-modal-close').addEventListener('click', () => hideModal('shortcuts-modal-overlay'));
    $('project-modal-close').addEventListener('click', () => hideModal('project-modal-overlay'));
    $('tag-modal-close').addEventListener('click', () => hideModal('tag-modal-overlay'));

    // ============================================================
    //  PROJECTS
    // ============================================================
    function renderProjects() {
        projectList.innerHTML = '';
        for (const proj of projects) {
            const btn = document.createElement('button');
            btn.className = 'nav-item' + (currentView === 'project-' + proj.id ? ' nav-item--active' : '');
            btn.dataset.view = 'project-' + proj.id;

            const dot = document.createElement('span');
            dot.className = 'nav-item__color'; dot.style.background = proj.color;
            btn.appendChild(dot);

            const name = document.createElement('span');
            name.textContent = proj.name;
            btn.appendChild(name);

            const badge = document.createElement('span');
            badge.className = 'nav-item__badge';
            badge.textContent = todos.filter(t => t.project === proj.id && !t.completed).length;
            btn.appendChild(badge);

            btn.addEventListener('click', () => switchView('project-' + proj.id));
            projectList.appendChild(btn);
        }

        const current = newTaskProject.value;
        newTaskProject.innerHTML = '';
        for (const p of projects) {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name;
            newTaskProject.appendChild(opt);
        }
        newTaskProject.value = current || 'inbox';
    }

    $('add-project-btn').addEventListener('click', () => {
        $('project-name-input').value = '';
        renderColorPicker('project-color-picker');
        showModal('project-modal-overlay');
        $('project-name-input').focus();
    });

    $('save-project-btn').addEventListener('click', () => {
        const name = $('project-name-input').value.trim();
        if (!name) return;
        projects.push({ id: 'proj-' + uuid(), name, color: getSelectedColor('project-color-picker') || COLOR_PALETTE[0] });
        save(KEYS.PROJECTS, projects);
        hideModal('project-modal-overlay');
        renderProjects();
        render();
    });

    // ============================================================
    //  TAGS
    // ============================================================
    function renderTags() {
        tagList.innerHTML = '';
        for (const tag of tags) {
            const btn = document.createElement('button');
            btn.className = 'nav-item' + (currentView === 'tag-' + tag.id ? ' nav-item--active' : '');
            btn.dataset.view = 'tag-' + tag.id;

            const dot = document.createElement('span');
            dot.className = 'nav-item__color'; dot.style.background = tag.color;
            btn.appendChild(dot);

            const name = document.createElement('span');
            name.textContent = tag.name;
            btn.appendChild(name);

            const badge = document.createElement('span');
            badge.className = 'nav-item__badge';
            badge.textContent = todos.filter(t => t.tags && t.tags.indexOf(tag.id) !== -1).length;
            btn.appendChild(badge);

            btn.addEventListener('click', () => switchView('tag-' + tag.id));
            tagList.appendChild(btn);
        }
    }

    $('add-tag-btn').addEventListener('click', () => {
        $('tag-name-input').value = '';
        renderColorPicker('tag-color-picker');
        showModal('tag-modal-overlay');
        $('tag-name-input').focus();
    });

    $('save-tag-btn').addEventListener('click', () => {
        const name = $('tag-name-input').value.trim();
        if (!name) return;
        tags.push({ id: 'tag-' + uuid(), name, color: getSelectedColor('tag-color-picker') || COLOR_PALETTE[0] });
        save(KEYS.TAGS, tags);
        hideModal('tag-modal-overlay');
        renderTags();
        render();
    });

    // ============================================================
    //  COLOR PICKER
    // ============================================================
    function renderColorPicker(containerId) {
        const el = $(containerId); el.innerHTML = '';
        for (const color of COLOR_PALETTE) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch'; swatch.style.background = color; swatch.dataset.color = color;
            swatch.addEventListener('click', () => { el.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected')); swatch.classList.add('selected'); });
            el.appendChild(swatch);
        }
        if (el.firstChild) el.firstChild.classList.add('selected');
    }

    function getSelectedColor(containerId) {
        const s = $(containerId).querySelector('.color-swatch.selected');
        return s ? s.dataset.color : null;
    }

    // ============================================================
    //  VIEWS
    // ============================================================
    function switchView(view) {
        currentView = view;
        navItems.forEach(btn => btn.classList.toggle('nav-item--active', btn.dataset.view === view));
        projectList.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('nav-item--active', btn.dataset.view === view));
        tagList.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('nav-item--active', btn.dataset.view === view));

        const titles = { inbox: 'Inbox', today: 'Today', upcoming: 'Upcoming', completed: 'Completed', overdue: 'Overdue' };
        if (titles[view]) viewTitle.textContent = titles[view];
        else if (view.startsWith('project-')) { const p = projects.find(p => p.id === view.slice(8)); viewTitle.textContent = p ? p.name : 'Project'; }
        else if (view.startsWith('tag-')) { const t = tags.find(t => t.id === view.slice(4)); viewTitle.textContent = t ? '#' + t.name : 'Tag'; }

        render();
        sidebar.classList.remove('open');
        sidebarOverlay.classList.add('hidden');
    }

    navItems.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    // ============================================================
    //  PROGRESS & BADGES
    // ============================================================
    function updateProgress() {
        const total = todos.length, done = todos.filter(t => t.completed).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressFill.style.width = pct + '%';
        progressLabel.textContent = pct + '%';
    }

    function updateBadges() {
        const todayStr = isoDate(new Date());
        $('badge-inbox').textContent = todos.filter(t => t.project === 'inbox' && !t.completed).length;
        $('badge-today').textContent = todos.filter(t => t.date === todayStr && !t.completed).length;
        $('badge-upcoming').textContent = todos.filter(t => isUpcoming(t.date) && !t.completed).length;
        $('badge-completed').textContent = todos.filter(t => t.completed).length;
        $('badge-overdue').textContent = todos.filter(t => isOverdue(t.date) && !t.completed).length;
        renderProjects();
        renderTags();
    }

    // ============================================================
    //  SEARCH & SORT
    // ============================================================
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim(); render(); });
    sortSelect.addEventListener('change', () => { currentSort = sortSelect.value; save(KEYS.SORT, currentSort); render(); });

    // ============================================================
    //  UNDO
    // ============================================================
    function pushUndo(msg, items, idx) {
        undoStack.push({ items, idx });
        undoToastMsg.textContent = msg;
        undoToast.classList.remove('hidden');
        undoToast.style.animation = 'none'; undoToast.offsetHeight;
        undoToast.style.animation = 'toastIn .3s ease forwards';
        if (undoTimer) clearTimeout(undoTimer);
        undoTimer = setTimeout(() => { undoToast.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => undoToast.classList.add('hidden'), 300); undoStack = []; }, 5000);
    }

    undoBtn.addEventListener('click', () => {
        if (undoStack.length === 0) return;
        const last = undoStack.pop();
        for (const item of last.items) todos.splice(last.idx, 0, item);
        render();
        undoToast.style.animation = 'toastOut .3s ease forwards';
        setTimeout(() => undoToast.classList.add('hidden'), 300);
        if (undoTimer) clearTimeout(undoTimer);
    });

    // ============================================================
    //  THEME
    // ============================================================
    function updateThemeUI() {
        const t = document.documentElement.getAttribute('data-theme');
        const label = $('theme-label');
        const icon = $('theme-icon');
        if (t === 'dark') {
            label.textContent = 'Light Mode';
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        } else {
            label.textContent = 'Dark Mode';
            icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        }
    }

    $('theme-toggle-btn').addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(KEYS.THEME, next);
        updateThemeUI();
    });

    // ============================================================
    //  POMODORO
    // ============================================================
    let pomodoroMinutes = 25, pomodoroSeconds = 0, pomodoroRunning = false, pomodoroInterval = null;
    let pomodoroSessions = load(KEYS.POMODORO, 0);
    $('pomodoro-sessions').textContent = pomodoroSessions;

    $('pomodoro-toggle').addEventListener('click', () => $('pomodoro-panel').classList.toggle('hidden'));

    $('pomodoro-start').addEventListener('click', () => {
        if (pomodoroRunning) {
            clearInterval(pomodoroInterval); pomodoroRunning = false;
            $('pomodoro-start').textContent = 'Start'; $('pomodoro-start').classList.remove('pomodoro__btn--active');
        } else {
            pomodoroRunning = true;
            $('pomodoro-start').textContent = 'Pause'; $('pomodoro-start').classList.add('pomodoro__btn--active');
            pomodoroInterval = setInterval(() => {
                if (pomodoroSeconds === 0) {
                    if (pomodoroMinutes === 0) {
                        clearInterval(pomodoroInterval); pomodoroRunning = false;
                        $('pomodoro-start').textContent = 'Start'; $('pomodoro-start').classList.remove('pomodoro__btn--active');
                        pomodoroSessions++; save(KEYS.POMODORO, pomodoroSessions);
                        $('pomodoro-sessions').textContent = pomodoroSessions;
                        if (Notification.permission === 'granted') new Notification('Pomodoro Complete!', { body: 'Sessions: ' + pomodoroSessions });
                        pomodoroMinutes = 25; pomodoroSeconds = 0; updatePomodoroDisplay(); return;
                    }
                    pomodoroMinutes--; pomodoroSeconds = 59;
                } else pomodoroSeconds--;
                updatePomodoroDisplay();
            }, 1000);
        }
    });

    $('pomodoro-reset').addEventListener('click', () => {
        clearInterval(pomodoroInterval); pomodoroRunning = false;
        $('pomodoro-start').textContent = 'Start'; $('pomodoro-start').classList.remove('pomodoro__btn--active');
        const m = document.querySelector('.pomodoro__mode--active');
        pomodoroMinutes = m ? parseInt(m.dataset.minutes) : 25; pomodoroSeconds = 0; updatePomodoroDisplay();
    });

    document.querySelectorAll('.pomodoro__mode').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pomodoro__mode').forEach(b => b.classList.remove('pomodoro__mode--active'));
            btn.classList.add('pomodoro__mode--active');
            clearInterval(pomodoroInterval); pomodoroRunning = false;
            $('pomodoro-start').textContent = 'Start'; $('pomodoro-start').classList.remove('pomodoro__btn--active');
            pomodoroMinutes = parseInt(btn.dataset.minutes); pomodoroSeconds = 0; updatePomodoroDisplay();
        });
    });

    function updatePomodoroDisplay() {
        $('pomodoro-display').textContent = String(pomodoroMinutes).padStart(2, '0') + ':' + String(pomodoroSeconds).padStart(2, '0');
    }

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    // ============================================================
    //  STATISTICS
    // ============================================================
    $('stats-btn').addEventListener('click', () => { renderStats(); showModal('stats-modal-overlay'); });

    function renderStats() {
        const total = todos.length, completed = todos.filter(t => t.completed).length;
        const active = total - completed, overdue = todos.filter(t => isOverdue(t.date) && !t.completed).length;

        $('stat-total').textContent = total;
        $('stat-completed').textContent = completed;
        $('stat-active').textContent = active;
        $('stat-overdue').textContent = overdue;

        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        $('stat-rate-fill').style.width = rate + '%';
        $('stat-rate-label').textContent = rate + '% completed';

        const pStats = $('priority-stats'); pStats.innerHTML = '';
        const pColors = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];
        for (let p = 1; p <= 4; p++) {
            const count = todos.filter(t => t.priority === p).length;
            const row = document.createElement('div'); row.className = 'priority-stat-row';
            const lbl = document.createElement('span'); lbl.className = 'priority-stat-row__label'; lbl.style.color = pColors[p - 1]; lbl.textContent = 'P' + p + ' ' + PRIORITY_LABELS[p];
            const bar = document.createElement('div'); bar.className = 'priority-stat-row__bar';
            const fill = document.createElement('div'); fill.className = 'priority-stat-row__fill'; fill.style.width = (total > 0 ? (count / total) * 100 : 0) + '%'; fill.style.background = pColors[p - 1]; bar.appendChild(fill);
            const cnt = document.createElement('span'); cnt.className = 'priority-stat-row__count'; cnt.textContent = count;
            row.appendChild(lbl); row.appendChild(bar); row.appendChild(cnt); pStats.appendChild(row);
        }

        const heatmap = $('week-heatmap'); heatmap.innerHTML = '';
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const ds = isoDate(d);
            const c = todos.filter(t => t.completed && t.date === ds).length;
            const col = document.createElement('div'); col.className = 'heatmap__day';
            const cell = document.createElement('div'); cell.className = 'heatmap__cell';
            const intensity = Math.min(c * 25, 100);
            cell.style.background = intensity > 0 ? 'hsla(265, 90%, 65%, ' + (intensity / 100) + ')' : 'var(--surface)';
            const label = document.createElement('span'); label.className = 'heatmap__label'; label.textContent = DAY_NAMES[d.getDay()];
            col.appendChild(cell); col.appendChild(label); heatmap.appendChild(col);
        }
    }

    // ============================================================
    //  EXPORT
    // ============================================================
    $('export-btn').addEventListener('click', () => {
        const data = { todos, projects, tags, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'todo-backup-' + isoDate(new Date()) + '.json'; a.click(); URL.revokeObjectURL(a.href);
    });

    // ============================================================
    //  SIDEBAR
    // ============================================================
    $('sidebar-toggle').addEventListener('click', () => {
        if (window.innerWidth > 768) sidebar.classList.toggle('sidebar--collapsed');
        else { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('hidden'); }
    });

    $('mobile-menu-btn').addEventListener('click', () => {
        if (window.innerWidth > 768) sidebar.classList.toggle('sidebar--collapsed');
        else { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('hidden'); }
    });

    sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden'); });

    // ============================================================
    //  KEYBOARD SHORTCUTS
    // ============================================================
    $('shortcuts-btn').addEventListener('click', () => showModal('shortcuts-modal-overlay'));

    document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
        switch (e.key) {
            case 'n': case 'N': e.preventDefault(); newTaskInput.focus(); break;
            case '/': e.preventDefault(); searchInput.focus(); break;
            case '?': showModal('shortcuts-modal-overlay'); break;
            case 'd': case 'D': $('theme-toggle-btn').click(); break;
            case 'p': case 'P': $('pomodoro-toggle').click(); break;
            case 'Escape':
                ['task-modal-overlay', 'stats-modal-overlay', 'shortcuts-modal-overlay', 'project-modal-overlay', 'tag-modal-overlay'].forEach(id => {
                    if (!$(id).classList.contains('hidden')) hideModal(id);
                });
                break;
        }
    });

    // ============================================================
    //  CONFETTI
    // ============================================================
    function checkConfetti() {
        const t = todos.filter(t => isToday(t.date));
        if (t.length > 0 && t.every(t => t.completed)) fireConfetti();
    }

    function fireConfetti() {
        const canvas = confettiCanvas, ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const particles = [], colors = ['#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
        for (let i = 0; i < 120; i++) {
            particles.push({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height * 0.5 - canvas.height * 0.5,
                vx: (Math.random() - 0.5) * 8, vy: Math.random() * 4 + 2, size: Math.random() * 8 + 3,
                color: colors[Math.floor(Math.random() * colors.length)], rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10, life: 1
            });
        }
        let frame = 0;
        function animate() {
            frame++; ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                p.x += p.vx; p.vy += 0.1; p.y += p.vy; p.rotation += p.rotSpeed; p.life -= 0.008;
                if (p.life <= 0) continue;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore();
            }
            if (frame < 150 && particles.some(p => p.life > 0)) requestAnimationFrame(animate);
            else ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        animate();
    }

    // ============================================================
    //  SVG HELPER
    // ============================================================
    function makeChevron(size) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.5'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('date-group__chevron');
        const polyline = document.createElementNS(ns, 'polyline');
        polyline.setAttribute('points', '6 9 12 15 18 9');
        svg.appendChild(polyline); return svg;
    }

    // ============================================================
    //  ADD TASK EVENT
    // ============================================================
    addTaskBtn.addEventListener('click', addTodo);
    newTaskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
    newTaskStarBtn.addEventListener('click', () => {
        newTaskStarBtn.classList.toggle('starred');
        newTaskStarBtn.textContent = newTaskStarBtn.classList.contains('starred') ? '★' : '☆';
    });

    // ============================================================
    //  INIT
    // ============================================================
    renderProjects();
    renderTags();
    render();

})();
