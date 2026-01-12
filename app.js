   // --- State Management ---
        let cards = JSON.parse(localStorage.getItem('study_cards')) || [];
        let todos = JSON.parse(localStorage.getItem('study_todos')) || [];
        let timerSettings = JSON.parse(localStorage.getItem('study_timer_settings')) || { focus: 25, break: 5 };
        
        let currentCardIndex = 0;
        let isCardFlipped = false;

        // --- Timer Logic ---
        let isFocusMode = true;
        let timerSeconds = timerSettings.focus * 60;
        let timerInterval = null;
        
        const timerDisplay = document.getElementById('timer-display');
        const timerProgress = document.getElementById('timer-progress');
        const timerStatus = document.getElementById('timer-status');
        const timerToggleBtn = document.getElementById('timer-toggle');
        const CIRCUMFERENCE = 691;

        document.getElementById('focus-input').value = timerSettings.focus;
        document.getElementById('break-input').value = timerSettings.break;

        function updateTimerDisplay() {
            const mins = Math.floor(timerSeconds / 60);
            const secs = timerSeconds % 60;
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const total = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
            const offset = CIRCUMFERENCE - (timerSeconds / total) * CIRCUMFERENCE;
            timerProgress.style.strokeDashoffset = isNaN(offset) ? 0 : offset;
            
            if (isFocusMode) {
                timerStatus.textContent = "Focus";
                timerStatus.className = "timer-status text-indigo";
                timerProgress.style.color = "var(--primary)";
            } else {
                timerStatus.textContent = "Break";
                timerStatus.className = "timer-status text-green";
                timerProgress.style.color = "var(--secondary)";
            }
        }

        function applyTimerSettings() {
            const focusVal = parseInt(document.getElementById('focus-input').value) || 25;
            const breakVal = parseInt(document.getElementById('break-input').value) || 5;
            
            timerSettings = { focus: focusVal, break: breakVal };
            localStorage.setItem('study_timer_settings', JSON.stringify(timerSettings));
            
            resetTimer();
            const btn = event.currentTarget;
            const originalText = btn.textContent;
            btn.textContent = "保存しました！";
            setTimeout(() => btn.textContent = originalText, 2000);
        }

        function resetTimer() {
            clearInterval(timerInterval);
            timerInterval = null;
            isFocusMode = true;
            timerSeconds = timerSettings.focus * 60;
            timerToggleBtn.textContent = 'スタート';
            updateTimerDisplay();
        }

        timerToggleBtn.onclick = () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                timerToggleBtn.textContent = '再開';
            } else {
                timerToggleBtn.textContent = '一時停止';
                timerInterval = setInterval(() => {
                    if (timerSeconds > 0) {
                        timerSeconds--;
                        updateTimerDisplay();
                    } else {
                        clearInterval(timerInterval);
                        timerInterval = null;
                        isFocusMode = !isFocusMode;
                        timerSeconds = (isFocusMode ? timerSettings.focus : timerSettings.break) * 60;
                        timerToggleBtn.textContent = 'スタート';
                        updateTimerDisplay();
                    }
                }, 1000);
            }
        };

        document.getElementById('timer-reset').onclick = resetTimer;

        // --- Tab Switching ---
        function switchTab(tabId, title) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            document.getElementById('app-title').textContent = title;
            
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById('nav-' + tabId).classList.add('active');
        }

        // --- Flashcard Logic ---
        function toggleCardModal() {
            const modal = document.getElementById('card-modal');
            modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        }

        function addCard() {
            const q = document.getElementById('card-q').value.trim();
            const a = document.getElementById('card-a').value.trim();
            if (q && a) {
                cards.push({ q, a });
                saveCards();
                document.getElementById('card-q').value = '';
                document.getElementById('card-a').value = '';
                toggleCardModal();
                currentCardIndex = cards.length - 1;
                updateCardDisplay();
            }
        }

        function saveCards() {
            localStorage.setItem('study_cards', JSON.stringify(cards));
        }

        function updateCardDisplay() {
            const textEl = document.getElementById('card-text');
            const counterEl = document.getElementById('card-counter');
            const deleteBtn = document.getElementById('delete-card-btn');
            
            if (cards.length === 0) {
                textEl.textContent = "カードがありません。右上の＋から追加してください。";
                counterEl.textContent = "0 / 0";
                deleteBtn.style.display = 'none';
                return;
            }

            deleteBtn.style.display = 'block';
            const card = cards[currentCardIndex];
            textEl.textContent = isCardFlipped ? card.a : card.q;
            textEl.style.color = isCardFlipped ? 'var(--secondary)' : 'var(--text-main)';
            counterEl.textContent = `${currentCardIndex + 1} / ${cards.length}`;
        }

        document.getElementById('card-display').onclick = () => {
            if (cards.length === 0) return;
            isCardFlipped = !isCardFlipped;
            updateCardDisplay();
        };

        function nextCard() {
            if (cards.length === 0) return;
            currentCardIndex = (currentCardIndex + 1) % cards.length;
            isCardFlipped = false;
            updateCardDisplay();
        }

        function prevCard() {
            if (cards.length === 0) return;
            currentCardIndex = (currentCardIndex - 1 + cards.length) % cards.length;
            isCardFlipped = false;
            updateCardDisplay();
        }

        function deleteCurrentCard(e) {
            e.stopPropagation();
            if (confirm('このカードを削除しますか？')) {
                cards.splice(currentCardIndex, 1);
                saveCards();
                if (currentCardIndex >= cards.length && cards.length > 0) {
                    currentCardIndex = cards.length - 1;
                }
                isCardFlipped = false;
                updateCardDisplay();
            }
        }

        // --- Todo Logic ---
        function saveTodos() {
            localStorage.setItem('study_todos', JSON.stringify(todos));
        }

        function renderTodos() {
            const list = document.getElementById('todo-list');
            list.innerHTML = '';
            todos.forEach((todo, index) => {
                const li = document.createElement('li');
                li.className = 'todo-item';
                li.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodo(${index})">
                    <span class="todo-text ${todo.done ? 'done' : ''}">${todo.text}</span>
                    <button onclick="deleteTodo(${index})" class="btn-todo-delete">削除</button>
                `;
                list.appendChild(li);
            });
        }

        document.getElementById('add-todo').onclick = () => {
            const input = document.getElementById('todo-input');
            const text = input.value.trim();
            if (text) {
                todos.push({ text: text, done: false });
                saveTodos();
                input.value = '';
                renderTodos();
            }
        };

        window.toggleTodo = (index) => {
            todos[index].done = !todos[index].done;
            saveTodos();
            renderTodos();
        };

        window.deleteTodo = (index) => {
            todos.splice(index, 1);
            saveTodos();
            renderTodos();
        };

        // --- Initialize ---
        updateTimerDisplay();
        updateCardDisplay();
        renderTodos();