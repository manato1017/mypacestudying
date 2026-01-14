 // --- State Management ---
        let cards = JSON.parse(localStorage.getItem('mp_cards')) || [];
        let groups = JSON.parse(localStorage.getItem('mp_groups')) || ["デフォルト"];
        let todos = JSON.parse(localStorage.getItem('mp_todos')) || [];
        let studyStats = JSON.parse(localStorage.getItem('mp_stats')) || {};
        let timerSettings = JSON.parse(localStorage.getItem('mp_timer_cfg')) || { focus: 25, break: 5, autoStart: false };

        let currentGroup = "すべて";
        let currentCardIndex = 0;
        let isCardFlipped = false;
        let isFocusMode = true;
        let timerSeconds = timerSettings.focus * 60;
        let timerInterval = null;
        const CIRCUMFERENCE = 691;

        const getTodayKey = () => {
            const d = new Date();
            return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        };
        const saveData = () => {
            localStorage.setItem('mp_cards', JSON.stringify(cards));
            localStorage.setItem('mp_groups', JSON.stringify(groups));
            localStorage.setItem('mp_todos', JSON.stringify(todos));
            localStorage.setItem('mp_stats', JSON.stringify(studyStats));
            localStorage.setItem('mp_timer_cfg', JSON.stringify(timerSettings));
        };

        // --- Navigation ---
        window.switchTab = (id, title) => {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            document.getElementById('nav-' + id).classList.add('active');
            document.getElementById('app-title').textContent = title;
            if (id === 'stats') renderStats();
            if (id === 'card') renderGroupChips();
            if (id === 'todo') renderTodos();
        };

        // --- Timer Logic ---
        function updateTimerDisplay() {
            const mins = Math.floor(timerSeconds / 60);
            const secs = timerSeconds % 60;
            document.getElementById('timer-display').textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
            const total = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
            const offset = CIRCUMFERENCE - (timerSeconds / total) * CIRCUMFERENCE;
            const progress = document.getElementById('timer-progress');
            progress.style.strokeDashoffset = isNaN(offset) ? 0 : offset;
            progress.style.stroke = isFocusMode ? "var(--primary)" : "var(--secondary)";
            document.getElementById('timer-status').textContent = isFocusMode ? "Focus" : "Break";
        }

        window.toggleTimer = () => {
            const btn = document.getElementById('timer-toggle');
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                btn.textContent = "スタート";
            } else {
                btn.textContent = "停止";
                timerInterval = setInterval(() => {
                    if (timerSeconds > 0) {
                        timerSeconds--;
                        if (isFocusMode) {
                            const key = getTodayKey();
                            studyStats[key] = (studyStats[key] || 0) + 1;
                        }
                        updateTimerDisplay();
                    } else {
                        // Timer Finished
                        clearInterval(timerInterval);
                        timerInterval = null;
                        isFocusMode = !isFocusMode;
                        timerSeconds = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
                        updateTimerDisplay();
                        
                        if (timerSettings.autoStart) {
                            toggleTimer(); // 自動開始
                        } else {
                            btn.textContent = "スタート";
                        }
                    }
                }, 1000);
            }
        };

        window.resetTimer = () => {
            clearInterval(timerInterval);
            timerInterval = null;
            document.getElementById('timer-toggle').textContent = "スタート";
            isFocusMode = true;
            timerSeconds = timerSettings.focus * 60;
            updateTimerDisplay();
            saveData();
        };

        window.saveTimerSettings = () => {
            timerSettings.focus = parseInt(document.getElementById('focus-input').value) || 25;
            timerSettings.break = parseInt(document.getElementById('break-input').value) || 5;
            timerSettings.autoStart = document.getElementById('auto-start-switch').checked;
            resetTimer();
        };

        // --- Flashcard Logic ---
        function getFilteredCards() {
            return currentGroup === "すべて" ? cards : cards.filter(c => c.group === currentGroup);
        }

        function renderGroupChips() {
            const container = document.getElementById('group-container');
            container.innerHTML = '';
            ["すべて", ...groups].forEach(g => {
                const chip = document.createElement('div');
                chip.className = `chip ${currentGroup === g ? 'active' : ''}`;
                chip.textContent = g;
                chip.onclick = () => {
                    currentGroup = g; currentCardIndex = 0; isCardFlipped = false;
                    renderGroupChips(); updateCardDisplay();
                };
                container.appendChild(chip);
            });
        }

        function updateCardDisplay() {
            const filtered = getFilteredCards();
            const front = document.getElementById('card-front');
            const back = document.getElementById('card-back');
            const counter = document.getElementById('card-counter');
            const inner = document.getElementById('card-inner');
            inner.classList.remove('flipped');
            isCardFlipped = false;

            if (filtered.length === 0) {
                front.textContent = "カードがありません";
                back.textContent = "追加してください";
                counter.textContent = "0 / 0";
            } else {
                const card = filtered[currentCardIndex];
                front.textContent = card.q;
                back.textContent = card.a;
                counter.textContent = `${currentCardIndex + 1} / ${filtered.length}`;
            }
        }

        window.flipCard = () => {
            if (getFilteredCards().length === 0) return;
            isCardFlipped = !isCardFlipped;
            document.getElementById('card-inner').classList.toggle('flipped', isCardFlipped);
        };

        window.nextCard = () => {
            const len = getFilteredCards().length;
            if (len > 0) { currentCardIndex = (currentCardIndex + 1) % len; updateCardDisplay(); }
        };

        window.prevCard = () => {
            const len = getFilteredCards().length;
            if (len > 0) { currentCardIndex = (currentCardIndex - 1 + len) % len; updateCardDisplay(); }
        };

        window.deleteCurrentCard = (e) => {
            e.stopPropagation();
            const filtered = getFilteredCards();
            if (filtered.length === 0) return;
            if (confirm("このカードを削除しますか？")) {
                const target = filtered[currentCardIndex];
                cards = cards.filter(c => c !== target);
                saveData();
                const newLen = getFilteredCards().length;
                if (currentCardIndex >= newLen) currentCardIndex = Math.max(0, newLen - 1);
                updateCardDisplay();
            }
        };

        window.addCard = () => {
            const q = document.getElementById('card-q').value.trim();
            const a = document.getElementById('card-a').value.trim();
            if (q && a) {
                const group = currentGroup === "すべて" ? groups[0] : currentGroup;
                cards.push({ q, a, group });
                saveData(); closeModal('card-modal'); updateCardDisplay();
                document.getElementById('card-q').value = ''; document.getElementById('card-a').value = '';
            }
        };

        window.addGroup = () => {
            const name = document.getElementById('group-name').value.trim();
            if (name && !groups.includes(name)) {
                groups.push(name); saveData(); closeModal('group-modal');
                renderGroupChips(); document.getElementById('group-name').value = '';
            }
        };

        // --- Todo Logic ---
        window.addTodo = () => {
            const text = document.getElementById('todo-input').value.trim();
            const period = document.getElementById('todo-period-input').value.trim();
            if (text) {
                todos.push({ text, period, done: false, id: Date.now() });
                saveData(); renderTodos();
                document.getElementById('todo-input').value = '';
                document.getElementById('todo-period-input').value = '';
            }
        };

        window.toggleTodo = (id) => {
            const todo = todos.find(t => t.id === id);
            if (todo) todo.done = !todo.done;
            saveData(); renderTodos();
        };

        window.deleteTodo = (id) => {
            todos = todos.filter(t => t.id !== id);
            saveData(); renderTodos();
        };

        function renderTodos() {
            const listPending = document.getElementById('todo-list-pending');
            const listDone = document.getElementById('todo-list-done');
            listPending.innerHTML = '';
            listDone.innerHTML = '';

            const pendingItems = todos.filter(t => !t.done);
            const doneItems = todos.filter(t => t.done);

            document.getElementById('pending-count').textContent = pendingItems.length;
            document.getElementById('done-count').textContent = doneItems.length;

            const createEl = (t) => {
                const div = document.createElement('div');
                div.className = 'todo-item';
                div.innerHTML = `
                    <input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo(${t.id})" style="width:1.2rem; height:1.2rem; cursor:pointer;">
                    <span class="todo-text ${t.done?'done':''}">${t.text}</span>
                    ${t.period ? `<span class="todo-period">${t.period}</span>` : ''}
                    <button class="btn btn-danger" onclick="deleteTodo(${t.id})" style="padding:0.4rem; margin-left:0.5rem;">削除</button>
                `;
                return div;
            };

            pendingItems.forEach(t => listPending.appendChild(createEl(t)));
            doneItems.forEach(t => listDone.appendChild(createEl(t)));
        }

        // --- Stats ---
        function renderStats() {
            const todayKey = getTodayKey();
            const todaySec = studyStats[todayKey] || 0;
            const totalSec = Object.values(studyStats).reduce((a,b) => a+b, 0);
            document.getElementById('stat-today').textContent = `${Math.floor(todaySec/60)}m`;
            document.getElementById('stat-total').textContent = `${(totalSec/3600).toFixed(1)}h`;

            const chart = document.getElementById('stats-chart');
            chart.innerHTML = '';
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
                days.push({ label: i === 0 ? '今日' : `${d.getMonth()+1}/${d.getDate()}`, val: Math.floor((studyStats[key] || 0) / 60) });
            }
            const max = Math.max(...days.map(d => d.val), 60);
            days.forEach(d => {
                const h = (d.val / max) * 100;
                const col = document.createElement('div'); col.className = 'chart-bar-wrapper';
                col.innerHTML = `<div class="chart-bar" style="height:${h}%"></div><div class="chart-label">${d.label}</div>`;
                chart.appendChild(col);
            });
        }

        window.openModal = (id) => document.getElementById(id).style.display = 'flex';
        window.closeModal = (id) => document.getElementById(id).style.display = 'none';

        window.onload = () => {
            document.getElementById('focus-input').value = timerSettings.focus;
            document.getElementById('break-input').value = timerSettings.break;
            document.getElementById('auto-start-switch').checked = timerSettings.autoStart;
            updateTimerDisplay();
            renderGroupChips();
            updateCardDisplay();
            renderTodos();
        };
