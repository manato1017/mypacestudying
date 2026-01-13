     // --- DATA ---
        let cards = JSON.parse(localStorage.getItem('study_cards')) || [];
        let groups = JSON.parse(localStorage.getItem('study_groups')) || ["すべて"];
        let todos = JSON.parse(localStorage.getItem('study_todos')) || [];
        let studyHistory = JSON.parse(localStorage.getItem('study_history')) || {}; // { 'YYYY-MM-DD': minutes }
        let timerSettings = JSON.parse(localStorage.getItem('study_timer_settings')) || { focus: 25, break: 5, silent: false };
        
        let activeGroup = "すべて";
        let currentCardIndex = 0;
        let isCardFlipped = false;

        // --- AUDIO ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let isAudioEnabled = false;

        function playAlarm() {
            if (timerSettings.silent || !isAudioEnabled) return;
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        }

        // --- UTILS ---
        function getTodayStr() {
            return new Date().toISOString().split('T')[0];
        }

        function formatMins(totalMins) {
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return `${h}h ${m}m`;
        }

        // --- HISTORY & STATS ---
        function recordStudySession(mins) {
            const today = getTodayStr();
            studyHistory[today] = (studyHistory[today] || 0) + mins;
            localStorage.setItem('study_history', JSON.stringify(studyHistory));
            renderStats();
        }

        function renderStats() {
            const todayStr = getTodayStr();
            const todayMins = studyHistory[todayStr] || 0;
            let totalMins = 0;
            Object.values(studyHistory).forEach(m => totalMins += m);

            document.getElementById('stat-today').textContent = formatMins(todayMins);
            document.getElementById('stat-total').textContent = formatMins(totalMins);

            // Chart
            const chartArea = document.getElementById('chart-area');
            chartArea.innerHTML = '';
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                last7Days.push(d.toISOString().split('T')[0]);
            }

            const maxMins = Math.max(...last7Days.map(d => studyHistory[d] || 0), 60);

            last7Days.forEach(dayStr => {
                const mins = studyHistory[dayStr] || 0;
                const heightPercent = (mins / maxMins) * 100;
                const dateObj = new Date(dayStr);
                const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

                const barWrapper = document.createElement('div');
                barWrapper.className = 'chart-bar-wrapper';
                barWrapper.innerHTML = `
                    <div class="chart-bar" style="height: ${heightPercent}%" title="${mins}分"></div>
                    <div class="chart-day">${label}</div>
                `;
                chartArea.appendChild(barWrapper);
            });

            // History List
            const historyList = document.getElementById('history-list');
            const sortedDates = Object.keys(studyHistory).sort().reverse();
            if (sortedDates.length === 0) {
                historyList.innerHTML = '<p style="font-size:0.75rem; color:var(--text-light); text-align:center;">履歴はありません</p>';
            } else {
                historyList.innerHTML = sortedDates.map(date => `
                    <div style="display:flex; justify-content:space-between; padding: 0.5rem 0; border-bottom:1px solid #f1f5f9; font-size:0.8rem;">
                        <span style="color:var(--text-muted);">${date}</span>
                        <span style="font-weight:600;">${formatMins(studyHistory[date])}</span>
                    </div>
                `).join('');
            }
        }

        // --- TIMER ---
        let isFocusMode = true;
        let timerSeconds = timerSettings.focus * 60;
        let timerInterval = null;
        const CIRCUMFERENCE = 691;

        document.getElementById('focus-input').value = timerSettings.focus;
        document.getElementById('break-input').value = timerSettings.break;
        document.getElementById('silent-mode-toggle').checked = timerSettings.silent;

        document.getElementById('silent-mode-toggle').onchange = function() {
            timerSettings.silent = this.checked;
            localStorage.setItem('study_timer_settings', JSON.stringify(timerSettings));
        };

        function updateTimerDisplay() {
            const mins = Math.floor(timerSeconds / 60);
            const secs = timerSeconds % 60;
            document.getElementById('timer-display').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            const total = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
            const offset = CIRCUMFERENCE - (timerSeconds / (total || 1)) * CIRCUMFERENCE;
            document.getElementById('timer-progress').style.strokeDashoffset = isNaN(offset) ? 0 : offset;
            
            const status = document.getElementById('timer-status');
            status.textContent = isFocusMode ? "Focus" : "Break";
            status.style.color = isFocusMode ? "var(--primary)" : "var(--secondary)";
            document.getElementById('timer-progress').style.color = isFocusMode ? "var(--primary)" : "var(--secondary)";
        }

        function applyTimerSettings() {
            timerSettings.focus = parseInt(document.getElementById('focus-input').value) || 25;
            timerSettings.break = parseInt(document.getElementById('break-input').value) || 5;
            localStorage.setItem('study_timer_settings', JSON.stringify(timerSettings));
            resetTimer();
        }

        function resetTimer() {
            clearInterval(timerInterval);
            timerInterval = null;
            isFocusMode = true;
            timerSeconds = timerSettings.focus * 60;
            document.getElementById('timer-toggle').textContent = 'スタート';
            updateTimerDisplay();
        }

        document.getElementById('timer-toggle').onclick = function() {
            if (!isAudioEnabled) { audioCtx.resume(); isAudioEnabled = true; }
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                this.textContent = '再開';
            } else {
                this.textContent = '一時停止';
                timerInterval = setInterval(() => {
                    if (timerSeconds > 0) {
                        timerSeconds--;
                        updateTimerDisplay();
                    } else {
                        clearInterval(timerInterval);
                        timerInterval = null;
                        playAlarm();
                        
                        // Record Focus Time if session finished
                        if (isFocusMode) {
                            recordStudySession(timerSettings.focus);
                        }

                        isFocusMode = !isFocusMode;
                        timerSeconds = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
                        this.textContent = 'スタート';
                        updateTimerDisplay();
                    }
                }, 1000);
            }
        };
        document.getElementById('timer-reset').onclick = resetTimer;

        // --- TABS ---
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById('nav-' + tabId).classList.add('active');
            if (tabId === 'stats') renderStats();
        }

        // --- FLASHCARDS ---
        function toggleGroupModal() {
            const m = document.getElementById('group-modal');
            m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
        }
        function toggleCardModal() {
            const m = document.getElementById('card-modal');
            m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
        }

        function addGroup() {
            const name = document.getElementById('group-name-input').value.trim();
            if (name && !groups.includes(name)) {
                groups.push(name);
                localStorage.setItem('study_groups', JSON.stringify(groups));
                document.getElementById('group-name-input').value = '';
                renderGroups(); toggleGroupModal();
            }
        }

        function renderGroups() {
            const container = document.getElementById('group-tabs');
            container.innerHTML = '';
            groups.forEach(g => {
                const pill = document.createElement('div');
                pill.className = `group-pill ${activeGroup === g ? 'active' : ''}`;
                pill.textContent = g;
                pill.onclick = () => {
                    activeGroup = g;
                    currentCardIndex = 0; isCardFlipped = false;
                    renderGroups(); updateCardDisplay();
                };
                container.appendChild(pill);
            });
            const select = document.getElementById('card-group-select');
            select.innerHTML = '';
            groups.filter(g => g !== "すべて").forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = g;
                select.appendChild(opt);
            });
        }

        function addCard() {
            const group = document.getElementById('card-group-select').value;
            const q = document.getElementById('card-q').value.trim();
            const a = document.getElementById('card-a').value.trim();
            if (q && a && group) {
                cards.push({ q, a, group });
                localStorage.setItem('study_cards', JSON.stringify(cards));
                document.getElementById('card-q').value = '';
                document.getElementById('card-a').value = '';
                toggleCardModal(); updateCardDisplay();
            }
        }

        function getFilteredCards() {
            return activeGroup === "すべて" ? cards : cards.filter(c => c.group === activeGroup);
        }

        function updateCardDisplay() {
            const filtered = getFilteredCards();
            const textEl = document.getElementById('card-text');
            const counterEl = document.getElementById('card-counter');
            const deleteBtn = document.getElementById('delete-card-btn');
            
            if (filtered.length === 0) {
                textEl.textContent = activeGroup === "すべて" ? "カードなし" : "空のグループです";
                counterEl.textContent = "0 / 0";
                deleteBtn.style.display = 'none';
                return;
            }
            deleteBtn.style.display = 'flex';
            const card = filtered[currentCardIndex];
            textEl.textContent = isCardFlipped ? card.a : card.q;
            textEl.style.color = isCardFlipped ? 'var(--secondary)' : 'var(--text-main)';
            counterEl.textContent = `${currentCardIndex + 1} / ${filtered.length}`;
        }

        document.getElementById('card-display').onclick = () => {
            if (getFilteredCards().length > 0) { isCardFlipped = !isCardFlipped; updateCardDisplay(); }
        };

        function nextCard() {
            const len = getFilteredCards().length;
            if (len > 0) { currentCardIndex = (currentCardIndex + 1) % len; isCardFlipped = false; updateCardDisplay(); }
        }
        function prevCard() {
            const len = getFilteredCards().length;
            if (len > 0) { currentCardIndex = (currentCardIndex - 1 + len) % len; isCardFlipped = false; updateCardDisplay(); }
        }
        function deleteCurrentCard(e) {
            e.stopPropagation();
            if (confirm('削除しますか？')) {
                const filtered = getFilteredCards();
                const cardToDelete = filtered[currentCardIndex];
                cards = cards.filter(c => c !== cardToDelete);
                localStorage.setItem('study_cards', JSON.stringify(cards));
                if (currentCardIndex >= getFilteredCards().length && currentCardIndex > 0) currentCardIndex--;
                isCardFlipped = false; updateCardDisplay();
            }
        }

        // --- TODO ---
        function renderTodos() {
            const ongoing = document.getElementById('ongoing-list');
            const completed = document.getElementById('completed-list');
            ongoing.innerHTML = ''; completed.innerHTML = '';
            
            todos.forEach((t, i) => {
                const div = document.createElement('div');
                div.className = 'todo-item';
                div.innerHTML = `
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo(${i})" style="width:1rem; height:1rem;">
                    <div class="todo-info">
                        <span>${t.text}</span>
                        ${t.date ? `<span class="todo-date">期限: ${t.date}</span>` : ''}
                    </div>
                    <button onclick="deleteTodo(${i})" style="background:none; border:none; color:var(--danger); font-size:0.6rem;">削除</button>
                `;
                if (t.done) completed.appendChild(div); else ongoing.appendChild(div);
            });
        }

        document.getElementById('add-todo').onclick = () => {
            const val = document.getElementById('todo-input').value.trim();
            const date = document.getElementById('todo-date-input').value;
            if (val) {
                todos.push({ text: val, date: date, done: false });
                localStorage.setItem('study_todos', JSON.stringify(todos));
                document.getElementById('todo-input').value = '';
                document.getElementById('todo-date-input').value = '';
                renderTodos();
            }
        };

        window.toggleTodo = (i) => { 
            todos[i].done = !todos[i].done; 
            localStorage.setItem('study_todos', JSON.stringify(todos)); 
            renderTodos(); 
        };
        
        window.deleteTodo = (i) => { 
            todos.splice(i, 1); 
            localStorage.setItem('study_todos', JSON.stringify(todos)); 
            renderTodos(); 
        };

        // --- INIT ---
        updateTimerDisplay(); renderGroups(); updateCardDisplay(); renderTodos(); renderStats()b;
    </script>
</body>
