const { createClient } = window.supabase;

const supabaseClient = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

const DEFAULT_TIME_SLOTS = [
    { start: '08:00', end: '08:45' },
    { start: '08:50', end: '09:35' },
    { start: '09:50', end: '10:35' },
    { start: '10:40', end: '11:25' },
    { start: '11:30', end: '12:15' },
    { start: '13:00', end: '13:45' },
    { start: '13:50', end: '14:35' },
    { start: '14:45', end: '15:30' },
    { start: '15:40', end: '16:25' },
    { start: '16:35', end: '17:20' },
    { start: '17:25', end: '18:10' },
    { start: '18:30', end: '19:15' },
    { start: '19:20', end: '20:05' },
    { start: '20:10', end: '20:55' },
];

class ScheduleManager {
    constructor() {
        this.user = null;
        this.courses = [];
        this.todos = [];
        this.modifications = {};
        this.currentWeek = 1;
        this.semesterStart = null;
        this.currentMonday = null;
        this.isSignUp = false;
        this.timeSlots = [...DEFAULT_TIME_SLOTS];
        
        // AI对话相关状态
        this.currentChatMode = null;
        this.currentConversationId = null;
        this.chatHistory = [];
        this.currentSuggestion = null;
        this.waitingForConfirmation = false;
        
        this.init();
    }

    async init() {
        this.bindAuthEvents();
        await this.checkAuth();
    }

    async checkAuth() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            this.user = session.user;
            await this.initApp();
        } else {
            this.showAuth();
        }

        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.user = session.user;
                await this.initApp();
            } else if (event === 'SIGNED_OUT') {
                this.user = null;
                this.showAuth();
            }
        });
    }

    showAuth() {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    showApp() {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }

    bindAuthEvents() {
        const authForm = document.getElementById('authForm');
        const authSwitchBtn = document.getElementById('authSwitchBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        authSwitchBtn.addEventListener('click', () => {
            this.isSignUp = !this.isSignUp;
            this.updateAuthUI();
        });

        logoutBtn.addEventListener('click', () => this.logout());
    }

    updateAuthUI() {
        const title = document.getElementById('authTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');
        const confirmGroup = document.getElementById('confirmPasswordGroup');
        const errorDiv = document.getElementById('authError');

        errorDiv.style.display = 'none';

        if (this.isSignUp) {
            title.textContent = '注册';
            submitBtn.textContent = '注册';
            switchText.textContent = '已有账号？';
            switchBtn.textContent = '登录';
            confirmGroup.style.display = 'block';
        } else {
            title.textContent = '登录';
            submitBtn.textContent = '登录';
            switchText.textContent = '还没有账号？';
            switchBtn.textContent = '注册';
            confirmGroup.style.display = 'none';
        }
    }

    async handleAuth() {
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const confirmPassword = document.getElementById('authConfirmPassword').value;
        const errorDiv = document.getElementById('authError');

        errorDiv.style.display = 'none';

        if (this.isSignUp) {
            if (password !== confirmPassword) {
                errorDiv.textContent = '两次输入的密码不一致';
                errorDiv.style.display = 'block';
                return;
            }

            if (password.length < 6) {
                errorDiv.textContent = '密码至少需要6个字符';
                errorDiv.style.display = 'block';
                return;
            }

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) {
                errorDiv.textContent = this.getErrorMessage(error.message);
                errorDiv.style.display = 'block';
                return;
            }

            if (data.user && !data.session) {
                errorDiv.textContent = '注册成功！请检查邮箱完成验证后登录。';
                errorDiv.style.background = '#d1fae5';
                errorDiv.style.color = '#059669';
                errorDiv.style.borderColor = '#a7f3d0';
                errorDiv.style.display = 'block';
                this.isSignUp = false;
                this.updateAuthUI();
            }
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                errorDiv.textContent = this.getErrorMessage(error.message);
                errorDiv.style.display = 'block';
                return;
            }

            this.user = data.user;
            await this.initApp();
        }
    }

    getErrorMessage(message) {
        const errorMap = {
            'Invalid login credentials': '邮箱或密码错误',
            'Email not confirmed': '邮箱未验证，请检查邮箱',
            'User already registered': '该邮箱已注册',
            'Password should be at least 6 characters': '密码至少需要6个字符',
            'Invalid email': '邮箱格式不正确'
        };
        return errorMap[message] || message;
    }

    async logout() {
        await supabaseClient.auth.signOut();
        this.courses = [];
        this.todos = [];
        this.modifications = {};
        this.showAuth();
    }

    async initApp() {
        this.showApp();
        this.bindEvents();
        await this.loadSemesterStart();
        await this.loadTimeSlots();
        
        // 初始化当前显示的周一日期（基于当前时间，完全独立于学期设置）
        this.currentMonday = this.getCurrentMonday();
        
        // 计算当前显示的周次在学期内的对应周次（仅用于显示）
        this.currentWeek = this.calculateWeekForDate(this.currentMonday);
        
        await this.loadAllData();
        this.renderTimeSlotsSettings();
        this.renderWeekView();
        this.renderCourseList();
        this.renderTodoList();
        this.updateWeekDisplay();
    }

    async loadSemesterStart() {
        const { data, error } = await supabaseClient
            .from('semester_settings')
            .select('semester_start, total_weeks')
            .eq('user_id', this.user.id)
            .single();

        if (data) {
            this.semesterStart = new Date(data.semester_start);
            this.totalWeeks = data.total_weeks || 20;
        } else {
            // 用户没有设置学期起始日期，保持为null
            this.semesterStart = null;
            this.totalWeeks = null;
            
            console.log('学期起始日期未设置，保持为null');
        }
    }

    async loadTimeSlots() {
        const { data, error } = await supabaseClient
            .from('time_slots')
            .select('*')
            .eq('user_id', this.user.id)
            .order('slot_index', { ascending: true });

        if (data && data.length > 0) {
            this.timeSlots = data.map(s => ({
                id: s.id,
                start: s.start_time,
                end: s.end_time
            }));
        }
    }

    async loadAllData() {
        await Promise.all([
            this.loadCourses(),
            this.loadTodos(),
            this.loadModifications()
        ]);
    }

    async loadCourses() {
        const { data, error } = await supabaseClient
            .from('courses')
            .select('*')
            .eq('user_id', this.user.id)
            .order('day', { ascending: true })
            .order('time_start', { ascending: true });

        if (data) {
            this.courses = data.map(c => ({
                id: c.id,
                name: c.name,
                day: c.day,
                timeStart: c.time_start,
                timeEnd: c.time_end,
                location: c.location,
                weeks: c.weeks
            }));
        }
    }

    async loadTodos() {
        const { data, error } = await supabaseClient
            .from('todos')
            .select('*')
            .eq('user_id', this.user.id)
            .order('date', { ascending: true });

        if (data) {
            this.todos = data.map(t => ({
                id: t.id,
                name: t.name,
                date: t.date,
                startTime: t.start_time,
                endTime: t.end_time,
                location: t.location,
                note: t.note,
                alarm: t.alarm
            }));
        }
    }

    async loadModifications() {
        const { data, error } = await supabaseClient
            .from('course_modifications')
            .select('*')
            .eq('user_id', this.user.id);

        if (data) {
            this.modifications = {};
            data.forEach(m => {
                const key = `${m.course_id}_${m.week}`;
                this.modifications[key] = {
                    courseId: m.course_id,
                    week: m.week,
                    newDay: m.new_day,
                    newTimeStart: m.new_time_start,
                    newTimeEnd: m.new_time_end,
                    newLocation: m.new_location
                };
            });
        }
    }

    // 获取当前周的周一日期（基于当前时间，不受学期设置影响）
    getCurrentMonday() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    // 获取当前周的日期范围（基于当前时间）
    getCurrentWeekDates() {
        // 如果currentMonday未设置，使用当前时间计算
        if (!this.currentMonday) {
            this.currentMonday = this.getCurrentMonday();
        }
        
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.currentMonday);
            date.setDate(this.currentMonday.getDate() + i);
            dates.push(date);
        }
        return dates;
    }

    // 计算当前周次（基于学期设置）
    getCurrentWeek() {
        if (!this.semesterStart || !this.totalWeeks) return null;
        
        const now = new Date();
        const start = new Date(this.semesterStart);
        
        // 重置时间为同一天开始
        start.setHours(0, 0, 0, 0);
        const nowReset = new Date(now);
        nowReset.setHours(0, 0, 0, 0);
        
        // 计算天数差（包含开始当天）
        const diffDays = Math.floor((nowReset - start) / (24 * 60 * 60 * 1000)) + 1;
        
        // 计算周数：如果天数差小于等于0，说明在当前学期开始之前
        if (diffDays <= 0) {
            return null; // 不在学期范围内
        }
        
        const week = Math.ceil(diffDays / 7);
        
        // 检查是否在学期范围内
        if (week < 1 || week > this.totalWeeks) {
            return null; // 不在学期范围内
        }
        
        return week;
    }

    // 获取指定周次的日期范围（基于学期设置）
    getWeekDates(weekNum) {
        if (!this.semesterStart || weekNum < 1 || weekNum > this.totalWeeks) {
            return this.getCurrentWeekDates(); // 返回当前周的日期作为默认
        }
        
        const start = new Date(this.semesterStart);
        start.setDate(start.getDate() + (weekNum - 1) * 7);
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date);
        }
        return dates;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getDateForDay(dayOfWeek, weekNum = null) {
        // 始终使用当前显示的日期，不受学期设置影响
        const weekDates = this.getCurrentWeekDates();
        
        const dayIndex = dayOfWeek - 1;
        if (dayIndex >= 0 && dayIndex < weekDates.length) {
            return this.formatDate(weekDates[dayIndex]);
        }
        return null;
    }

    // 计算指定日期在学期内的周次
    calculateWeekForDate(date) {
        if (!this.semesterStart || !this.totalWeeks) {
            return null; // 没有学期设置，返回null
        }
        
        const start = new Date(this.semesterStart);
        start.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        // 计算天数差（确保为正数）
        const diffTime = targetDate - start;
        const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
        
        // 如果日期在学期开始之前，返回null
        if (diffDays < 0) {
            return null;
        }
        
        // 计算周数（从1开始）
        const week = Math.floor(diffDays / 7) + 1;
        
        // 检查是否在学期范围内
        if (week < 1 || week > this.totalWeeks) {
            return null; // 不在学期范围内
        }
        
        return week;
    }

    parseWeeks(weekStr) {
        if (!weekStr || weekStr.trim() === '') {
            return Array.from({ length: 20 }, (_, i) => i + 1);
        }
        
        const weeks = new Set();
        const parts = weekStr.split(',');
        
        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                for (let i = start; i <= end; i++) {
                    weeks.add(i);
                }
            } else {
                weeks.add(parseInt(part));
            }
        });
        
        return Array.from(weeks).sort((a, b) => a - b);
    }

    getDayName(day) {
        const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return days[day];
    }

    // 高级感配色方案 - 固定课程（深色调）
    getFixedCourseColors() {
        return [
            // 深蓝系 - 专业稳重
            'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
            'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
            'linear-gradient(135deg, #16a085 0%, #1abc9c 100%)',
            
            // 深紫系 - 学术优雅
            'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
            'linear-gradient(135deg, #2c3e50 0%, #4a235a 100%)',
            
            // 深绿系 - 自然和谐
            'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
            'linear-gradient(135deg, #16a085 0%, #27ae60 100%)',
            
            // 深红系 - 重点突出
            'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)',
            'linear-gradient(135deg, #d35400 0%, #e67e22 100%)',
            
            // 深灰系 - 中性专业
            'linear-gradient(135deg, #7f8c8d 0%, #95a5a6 100%)',
            'linear-gradient(135deg, #34495e 0%, #5d6d7e 100%)'
        ];
    }

    // 高级感配色方案 - 待办事项（浅色调）
    getTodoItemColors() {
        return [
            // 浅蓝系 - 清新明快
            'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
            'linear-gradient(135deg, #81ecec 0%, #00cec9 100%)',
            
            // 浅绿系 - 轻松自然
            'linear-gradient(135deg, #55efc4 0%, #00b894 100%)',
            'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
            
            // 浅粉系 - 柔和温馨
            'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
            'linear-gradient(135deg, #fab1a0 0%, #e17055 100%)',
            
            // 浅黄系 - 温暖明亮
            'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
            'linear-gradient(135deg, #f6e58d 0%, #ffbe76 100%)',
            
            // 浅紫系 - 优雅浪漫
            'linear-gradient(135deg, #d6a2e8 0%, #82589f 100%)',
            'linear-gradient(135deg, #c8d6e5 0%, #8395a7 100%)'
        ];
    }

    // 基于名称和类型获取高级配色
    getAdvancedItemGradient(name, type) {
        // 使用简单的哈希函数为名称生成一致的索引
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = ((hash << 5) - hash) + name.charCodeAt(i);
            hash = hash & hash;
        }
        
        let colorPalette;
        if (type === 'fixed') {
            colorPalette = this.getFixedCourseColors();
        } else if (type === 'todo-item') {
            colorPalette = this.getTodoItemColors();
        } else {
            // 其他类型使用中等色调
            colorPalette = [
                'linear-gradient(135deg, #636e72 0%, #2d3436 100%)',
                'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)',
                'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)'
            ];
        }
        
        // 确保索引在有效范围内
        const index = Math.abs(hash) % colorPalette.length;
        return colorPalette[index];
    }

    getTimeSlot(time) {
        if (!time || time < 1 || time > this.timeSlots.length) return '';
        const slot = this.timeSlots[time - 1];
        return `第${time}节 (${slot.start}-${slot.end})`;
    }

    getTimeSlotRange(timeStart, timeEnd) {
        if (!timeStart || !timeEnd) return '';
        if (timeStart === timeEnd) {
            return this.getTimeSlot(timeStart);
        }
        const startSlot = this.timeSlots[timeStart - 1];
        const endSlot = this.timeSlots[timeEnd - 1];
        if (!startSlot || !endSlot) return '';
        return `第${timeStart}-${timeEnd}节 (${startSlot.start}-${endSlot.end})`;
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            // 完全独立于学期设置：基于当前显示的日期切换到上一周
            if (!this.currentMonday) {
                this.currentMonday = this.getCurrentMonday();
            }
            
            const prevMonday = new Date(this.currentMonday);
            prevMonday.setDate(this.currentMonday.getDate() - 7);
            this.currentMonday = prevMonday;
            
            // 计算当前显示的周次在学期内的对应周次（仅用于显示）
            this.currentWeek = this.calculateWeekForDate(this.currentMonday);
            
            this.updateWeekDisplay();
            this.renderWeekView();
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            // 完全独立于学期设置：基于当前显示的日期切换到下一周
            if (!this.currentMonday) {
                this.currentMonday = this.getCurrentMonday();
            }
            
            const nextMonday = new Date(this.currentMonday);
            nextMonday.setDate(this.currentMonday.getDate() + 7);
            this.currentMonday = nextMonday;
            
            // 计算当前显示的周次在学期内的对应周次（仅用于显示）
            this.currentWeek = this.calculateWeekForDate(this.currentMonday);
            
            this.updateWeekDisplay();
            this.renderWeekView();
        });

        document.getElementById('addCourseBtn').addEventListener('click', () => {
            this.openCourseModal();
        });

        document.getElementById('addTodoBtn').addEventListener('click', () => {
            this.openTodoModal();
        });

        document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        document.getElementById('courseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCourse();
        });

        document.getElementById('modifyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveModification();
        });

        document.getElementById('todoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTodo();
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        document.getElementById('slotsPerDay').addEventListener('change', (e) => {
            const count = parseInt(e.target.value);
            if (count > 0 && count <= 12) {
                this.adjustTimeSlots(count);
            }
        });

        document.getElementById('addTimeSlotBtn').addEventListener('click', () => {
            this.addTimeSlot();
        });

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveTimeSlots();
        });


    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        if (tabId === 'ai-chat') {
            // 切换到AI对话页面时，恢复对话状态
            this.restoreAIChatState();
        }
    }

    restoreAIChatState() {
        // 恢复AI对话的聊天历史
        this.renderAIChat();
        
        // 如果当前有建议正在等待确认，重新显示确认提示
        if (this.currentSuggestion && this.waitingForConfirmation) {
            const messagesDiv = document.getElementById('chatMessages');
            const lastMessage = messagesDiv.lastChild;
            
            if (lastMessage && !lastMessage.textContent.includes('请回复"确认"或"取消"')) {
                // 重新添加确认提示
                let confirmMessage = '';
                
                switch (this.currentSuggestion.type) {
                    case 'todo_suggestion':
                        confirmMessage = '请回复"确认"或"取消"来确认或取消当前待办事项建议。';
                        break;
                    case 'course_mod_suggestion':
                        confirmMessage = '请回复"确认"或"取消"来确认或取消当前课程设置建议。';
                        break;
                    case 'long_term_plan':
                        confirmMessage = '请回复"确认"或"取消"来确认或取消当前长期规划建议。';
                        break;
                }
                
                if (confirmMessage) {
                    this.addAIMessage(confirmMessage);
                }
            }
        }
        
        // 重新渲染日程，显示AI建议的预显示
        if (this.currentSuggestion) {
            this.renderWeekSchedule();
        }
    }

    updateWeekDisplay() {
        const weekElement = document.getElementById('currentWeek');
        
        // 计算当前显示的日期在学期内的对应周次
        const semesterWeek = this.calculateWeekForDate(this.currentMonday);
        
        if (semesterWeek === null) {
            // 不在学期范围内，显示日期和提示
            const dateStr = this.currentMonday ? this.formatDate(this.currentMonday) : '未知日期';
            weekElement.textContent = `(不在学期范围内)`;
            weekElement.style.color = '#ef4444';
            weekElement.style.fontStyle = 'italic';
        } else {
            // 在学期范围内，显示周次和日期
            const dateStr = this.currentMonday ? this.formatDate(this.currentMonday) : '未知日期';
            weekElement.textContent = `第 ${semesterWeek} 周 `;
            weekElement.style.color = '';
            weekElement.style.fontStyle = '';
        }
    }

    renderWeekView() {
        // 使用当前周的日期，不受学期设置影响
        const weekDates = this.getCurrentWeekDates();
        
        for (let day = 1; day <= 7; day++) {
            const column = document.querySelector(`.day-column[data-day="${day}"]`);
            const header = column.querySelector('.day-header');
            const date = weekDates[day - 1];
            header.innerHTML = `${this.getDayName(day)}<br><small>${date.getMonth() + 1}/${date.getDate()}</small>`;
            
            let existingSlots = column.querySelectorAll('.slot');
            existingSlots.forEach(slot => slot.remove());
            
            for (let time = 1; time <= this.timeSlots.length; time++) {
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.time = time;
                column.appendChild(slot);
            }
        }
        
        this.renderTimeColumn();
        this.renderWeekSchedule();
    }

    renderTimeColumn() {
        const timeColumn = document.querySelector('.time-column');
        timeColumn.innerHTML = '<div class="time-header">时间</div>';
        
        this.timeSlots.forEach((slot, index) => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.innerHTML = `${slot.start}<br>${slot.end}`;
            timeColumn.appendChild(timeSlot);
        });
    }

    renderWeekSchedule() {
        // 使用当前显示的日期，不受学期设置影响
        const weekDates = this.getCurrentWeekDates();
        
        for (let day = 1; day <= 7; day++) {
            const column = document.querySelector(`.day-column[data-day="${day}"]`);
            const slots = column.querySelectorAll('.slot');
            
            const renderedItems = new Set();
            
            slots.forEach((slot, timeIndex) => {
                const time = timeIndex + 1;
                const items = this.getItemsForSlot(day, time, weekDates[day - 1]);
                
                items.forEach(item => {
                    const itemKey = `${item.type}_${item.id}_${item.slotCount || 1}`;
                    if (renderedItems.has(itemKey)) return;
                    
                    if (item.isFirstSlot || !item.slotCount) {
                        renderedItems.add(itemKey);
                        
                        const div = document.createElement('div');
                        div.className = `schedule-item ${item.type}`;
                        if (item.hasConflict) div.classList.add('conflict');
                        if (item.slotCount && item.slotCount > 1) div.classList.add('multi-slot');
                        
                        // 为固定课程和待办事项应用高级配色方案
                        if (item.type === 'fixed' || item.type === 'todo-item') {
                            div.style.background = this.getAdvancedItemGradient(item.name, item.type);
                            div.style.borderLeft = '4px solid rgba(0, 0, 0, 0.2)';
                        }
                        
                        if (item.slotCount && item.slotCount > 1) {
                            const slotHeight = 120;
                            const totalHeight = slotHeight * item.slotCount;
                            div.style.height = `${totalHeight}px`;
                            div.style.position = 'absolute';
                            div.style.top = '0';
                            div.style.left = '0';
                            div.style.right = '0';
                            div.style.zIndex = '10';
                        }
                        
                        div.innerHTML = `
                            <div class="item-name">${item.name}</div>
                            <div class="item-time">${this.getTimeSlotRangeForItem(item, time)}</div>
                            ${item.location ? `<div class="item-location">${item.location}</div>` : ''}
                            ${item.badge ? `<span class="item-badge">${item.badge}</span>` : ''}
                        `;
                        
                        div.addEventListener('click', (e) => {
                            console.log('点击事件触发:', item.type, item.name);
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            this.showItemDetail(item);
                        });
                        slot.appendChild(div);
                    }
                });
            });
        }
    }

    getItemsForSlot(day, time, date) {
        const items = [];
        const dateStr = this.formatDate(date);
        
        this.courses.forEach(course => {
            if (course.day === day && time >= course.timeStart && time <= course.timeEnd) {
                const weeks = this.parseWeeks(course.weeks);
                if (weeks.includes(this.currentWeek)) {
                    const modKey = `${course.id}_${this.currentWeek}`;
                    const mod = this.modifications[modKey];
                    
                    if (!mod) {
                        items.push({
                            type: 'fixed',
                            id: course.id,
                            name: course.name,
                            location: course.location,
                            originalCourse: course,
                            isFirstSlot: time === course.timeStart,
                            slotCount: course.timeEnd - course.timeStart + 1
                        });
                    }
                }
            }
        });
        
        Object.keys(this.modifications).forEach(key => {
            const mod = this.modifications[key];
            if (mod.week === this.currentWeek && mod.newDay === day && 
                time >= mod.newTimeStart && time <= mod.newTimeEnd) {
                const course = this.courses.find(c => c.id === mod.courseId);
                if (course) {
                    const weeks = this.parseWeeks(course.weeks);
                    if (weeks.includes(this.currentWeek)) {
                        items.push({
                            type: 'modified',
                            id: course.id,
                            name: course.name,
                            location: mod.newLocation || course.location,
                            badge: '临时修改',
                            originalCourse: course,
                            modification: mod,
                            isFirstSlot: time === mod.newTimeStart,
                            slotCount: mod.newTimeEnd - mod.newTimeStart + 1
                        });
                    }
                }
            }
        });
        
        this.todos.forEach(todo => {
            if (todo.date === dateStr) {
                const overlapInfo = this.todoOverlapsSlotWithInfo(todo, time);
                if (overlapInfo.overlaps) {
                    items.push({
                        type: 'todo-item',
                        id: todo.id,
                        name: todo.name,
                        location: todo.location,
                        todo: todo,
                        isFirstSlot: overlapInfo.isFirstSlot,
                        slotCount: overlapInfo.slotCount
                    });
                }
            }
        });
        
        items.forEach(item => {
            item.hasConflict = items.length > 1;
        });
        
        // 添加AI建议事项
        if (this.currentSuggestion) {
            const aiItems = this.getAIItemsForSlot(day, time, dateStr);
            items.push(...aiItems);
        }
        
        if (this.currentSuggestion && this.currentSuggestion.type === 'long_term_plan') {
            const planData = this.currentSuggestion.data;
            
            // 检查长期规划实例
            if (planData.instances && planData.instances.length > 0) {
                planData.instances.forEach(instance => {
                    const instanceDate = new Date(instance.date);
                    const currentDate = new Date(dateStr);
                    
                    // 检查日期是否匹配
                    if (instanceDate.toDateString() === currentDate.toDateString()) {
                        const overlapInfo = this.todoOverlapsSlotWithInfo({
                            startTime: instance.startTime,
                            endTime: instance.endTime
                        }, time);
                        
                        if (overlapInfo.overlaps) {
                            items.push({
                                type: 'ai-suggestion',
                                id: `ai-plan-instance-${instance.date}-${instance.startTime}`,
                                name: planData.activityName,
                                location: instance.location || planData.location || '',
                                badge: '长期规划',
                                isFirstSlot: overlapInfo.isFirstSlot,
                                slotCount: overlapInfo.slotCount,
                                suggestion: this.currentSuggestion
                            });
                        }
                    }
                });
            }
        }
        
        return items;
    }

    todoOverlapsSlot(todo, slotIndex) {
        if (!todo.startTime || !todo.endTime) {
            return true;
        }
        
        const slot = this.timeSlots[slotIndex - 1];
        if (!slot) return false;
        
        const todoStart = this.timeToMinutes(todo.startTime);
        const todoEnd = this.timeToMinutes(todo.endTime);
        const slotStart = this.timeToMinutes(slot.start);
        const slotEnd = this.timeToMinutes(slot.end);
        
        return todoStart < slotEnd && todoEnd > slotStart;
    }

    todoOverlapsSlotWithInfo(todo, slotIndex) {
        const startTime = todo.startTime || todo.start_time;
        const endTime = todo.endTime || todo.end_time;
        
        if (!startTime || !endTime) {
            return { overlaps: true, isFirstSlot: true, slotCount: 1 };
        }
        
        const slot = this.timeSlots[slotIndex - 1];
        if (!slot) return { overlaps: false, isFirstSlot: false, slotCount: 0 };
        
        const todoStart = this.timeToMinutes(startTime);
        const todoEnd = this.timeToMinutes(endTime);
        const slotStart = this.timeToMinutes(slot.start);
        const slotEnd = this.timeToMinutes(slot.end);
        
        const overlaps = todoStart < slotEnd && todoEnd > slotStart;
        
        if (!overlaps) {
            return { overlaps: false, isFirstSlot: false, slotCount: 0 };
        }
        
        let firstSlot = -1;
        let lastSlot = -1;
        
        for (let i = 0; i < this.timeSlots.length; i++) {
            const s = this.timeSlots[i];
            const sStart = this.timeToMinutes(s.start);
            const sEnd = this.timeToMinutes(s.end);
            
            if (todoStart < sEnd && todoEnd > sStart) {
                if (firstSlot === -1) firstSlot = i + 1;
                lastSlot = i + 1;
            }
        }
        
        const isFirstSlot = (slotIndex === firstSlot);
        const slotCount = lastSlot - firstSlot + 1;
        
        return { overlaps: true, isFirstSlot, slotCount };
    }

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, mins] = timeStr.split(':').map(Number);
        return hours * 60 + mins;
    }

    getTimeSlot(slotIndex) {
        if (slotIndex < 1 || slotIndex > this.timeSlots.length) return '';
        const slot = this.timeSlots[slotIndex - 1];
        return `${slot.start}-${slot.end}`;
    }

    getTimeSlotRange(startSlot, endSlot) {
        if (startSlot === endSlot) {
            return this.getTimeSlot(startSlot);
        }
        const startTime = this.timeSlots[startSlot - 1]?.start;
        const endTime = this.timeSlots[endSlot - 1]?.end;
        return `${startTime}-${endTime}`;
    }

    getTimeSlotRangeForItem(item, currentTimeSlot) {
        if (item.type === 'fixed' || item.type === 'modified') {
            // 课程类型：显示整个课程的时间范围
            const startSlot = item.originalCourse?.timeStart || item.timeStart;
            const endSlot = item.originalCourse?.timeEnd || item.timeEnd;
            return this.getTimeSlotRange(startSlot, endSlot);
        } else if (item.type === 'todo-item' && item.todo?.startTime && item.todo?.endTime) {
            // 待办事项：显示具体的时间
            return `${item.todo.startTime}-${item.todo.endTime}`;
        } else if (item.type === 'ai-suggestion') {
            // AI建议：根据当前时间槽显示时间段
            if (item.slotCount && item.slotCount > 1) {
                const startSlot = currentTimeSlot;
                const endSlot = currentTimeSlot + item.slotCount - 1;
                return this.getTimeSlotRange(startSlot, endSlot);
            } else {
                return this.getTimeSlot(currentTimeSlot);
            }
        } else {
            // 默认：显示当前时间槽
            return this.getTimeSlot(currentTimeSlot);
        }
    }

    getAIItemsForSlot(day, time, dateStr) {
        const items = [];
        
        if (this.currentSuggestion && this.currentSuggestion.type === 'todo_suggestion') {
            const todoData = this.currentSuggestion.data;
            const suggestionDate = new Date(todoData.date);
            const currentDate = new Date(dateStr);
            
            // 检查日期是否匹配（单次待办事项）
            if (suggestionDate.toDateString() === currentDate.toDateString()) {
                const overlapInfo = this.todoOverlapsSlotWithInfo({
                    startTime: todoData.startTime,
                    endTime: todoData.endTime
                }, time);
                
                if (overlapInfo.overlaps) {
                    items.push({
                        type: 'ai-suggestion',
                        id: 'ai-todo-suggestion',
                        name: todoData.name,
                        location: todoData.location,
                        badge: 'AI建议',
                        isFirstSlot: overlapInfo.isFirstSlot,
                        slotCount: overlapInfo.slotCount,
                        suggestion: this.currentSuggestion
                    });
                }
            }
        }
        
        if (this.currentSuggestion && this.currentSuggestion.type === 'course_mod_suggestion') {
            const courseData = this.currentSuggestion.data;
            
            // 检查是否是固定课程设置
            if (courseData.modType === 'fixed' && courseData.courses) {
                courseData.courses.forEach(course => {
                    // 固定课程设置：显示在所有周次上
                    if (course.day === day && time >= course.timeStart && time <= course.timeEnd) {
                        items.push({
                            type: 'ai-suggestion',
                            id: `ai-course-suggestion-${course.day}-${course.timeStart}`,
                            name: courseData.courseName,
                            location: course.location || '',
                            badge: 'AI建议',
                            isFirstSlot: time === course.timeStart,
                            slotCount: course.timeEnd - course.timeStart + 1,
                            suggestion: this.currentSuggestion
                        });
                    }
                });
            }
            
            // 检查是否是临时修改
            if (courseData.modType === 'temporary' && courseData.newDay === day && 
                time >= courseData.newTimeStart && time <= courseData.newTimeEnd) {
                
                // 临时修改：显示在指定周次上
                if (courseData.week === this.currentWeek) {
                    items.push({
                        type: 'ai-suggestion',
                        id: 'ai-course-mod-suggestion',
                        name: courseData.courseName,
                        location: courseData.newLocation || courseData.oldLocation || '',
                        badge: '临时修改(AI建议)',
                        isFirstSlot: time === courseData.newTimeStart,
                        slotCount: courseData.newTimeEnd - courseData.newTimeStart + 1,
                        suggestion: this.currentSuggestion
                    });
                }
            }
        }
        
        if (this.currentSuggestion && this.currentSuggestion.type === 'long_term_plan') {
            const planData = this.currentSuggestion.data;
            
            // 检查长期规划实例
            if (planData.instances && planData.instances.length > 0) {
                planData.instances.forEach(instance => {
                    const instanceDate = new Date(instance.date);
                    const currentDate = new Date(dateStr);
                    
                    // 检查日期是否匹配
                    if (instanceDate.toDateString() === currentDate.toDateString()) {
                        const overlapInfo = this.todoOverlapsSlotWithInfo({
                            startTime: instance.startTime,
                            endTime: instance.endTime
                        }, time);
                        
                        if (overlapInfo.overlaps) {
                            items.push({
                                type: 'ai-suggestion',
                                id: `ai-plan-instance-${instance.date}-${instance.startTime}`,
                                name: planData.activityName,
                                location: instance.location || planData.location || '',
                                badge: '长期规划',
                                isFirstSlot: overlapInfo.isFirstSlot,
                                slotCount: overlapInfo.slotCount,
                                suggestion: this.currentSuggestion
                            });
                        }
                    }
                });
            }
        }
        
        return items;
    }

    renderCourseList() {
        const container = document.getElementById('courseList');
        
        if (this.courses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无课程，点击"添加课程"开始创建</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.courses.map(course => `
            <div class="course-card" data-id="${course.id}">
                <div class="course-info">
                    <div class="course-name">${course.name}</div>
                    <div class="course-details">
                        <span>${this.getDayName(course.day)}</span>
                        <span>${this.getTimeSlotRange(course.timeStart, course.timeEnd)}</span>
                        <span>${course.location || '未设置'}</span>
                    </div>
                </div>
                <div class="course-actions">
                    <button class="btn-secondary" onclick="app.openModifyModal('${course.id}')">临时修改</button>
                    <button class="btn-secondary" onclick="app.openCourseModal('${course.id}')">编辑</button>
                    <button class="btn-danger" onclick="app.deleteCourse('${course.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    renderTodoList() {
        const container = document.getElementById('todoList');
        
        if (this.todos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无待办事项，点击"添加待办"开始创建</p>
                </div>
            `;
            return;
        }
        
        const sortedTodos = [...this.todos].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        container.innerHTML = sortedTodos.map(todo => `
            <div class="todo-card" data-id="${todo.id}">
                <div class="todo-info">
                    <div class="todo-name">
                        ${todo.name}
                        ${todo.alarm ? '<span class="alarm-badge">已设闹钟</span>' : ''}
                    </div>
                    <div class="todo-details">
                        <span>${todo.date}</span>
                        ${todo.startTime && todo.endTime ? `<span>${todo.startTime}-${todo.endTime}</span>` : ''}
                        ${todo.location ? `<span>${todo.location}</span>` : ''}
                    </div>
                    ${todo.note ? `<div style="margin-top: 8px; color: #64748b; font-size: 14px;">${todo.note}</div>` : ''}
                </div>
                <div class="todo-actions">
                    <button class="btn-secondary" onclick="app.openTodoModal('${todo.id}')">编辑</button>
                    <button class="btn-danger" onclick="app.deleteTodo('${todo.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    renderTimeSlotsSettings() {
        const container = document.getElementById('timeSlotsContainer');
        const slotsPerDayInput = document.getElementById('slotsPerDay');
        
        slotsPerDayInput.value = this.timeSlots.length;
        container.innerHTML = '';
        
        this.timeSlots.forEach((slot, index) => {
            const row = document.createElement('div');
            row.className = 'time-slot-row';
            row.innerHTML = `
                <span class="slot-number">第${index + 1}节</span>
                <input type="time" value="${slot.start}" data-index="${index}" data-field="start">
                <span class="separator">-</span>
                <input type="time" value="${slot.end}" data-index="${index}" data-field="end">
                <button type="button" class="delete-slot-btn" data-index="${index}">删除</button>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll('input[type="time"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                this.timeSlots[index][field] = e.target.value;
            });
        });

        container.querySelectorAll('.delete-slot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (this.timeSlots.length > 1) {
                    this.timeSlots.splice(index, 1);
                    this.renderTimeSlotsSettings();
                } else {
                    alert('至少需要保留一个时间段');
                }
            });
        });
    }

    adjustTimeSlots(count) {
        while (this.timeSlots.length < count) {
            const lastSlot = this.timeSlots[this.timeSlots.length - 1];
            const newStart = this.addMinutes(lastSlot.end, 20);
            const newEnd = this.addMinutes(newStart, 95);
            this.timeSlots.push({ start: newStart, end: newEnd });
        }
        while (this.timeSlots.length > count) {
            this.timeSlots.pop();
        }
        this.renderTimeSlotsSettings();
    }

    addTimeSlot() {
        if (this.timeSlots.length >= 12) {
            alert('最多支持12个时间段');
            return;
        }
        const lastSlot = this.timeSlots[this.timeSlots.length - 1];
        const newStart = this.addMinutes(lastSlot.end, 20);
        const newEnd = this.addMinutes(newStart, 95);
        this.timeSlots.push({ start: newStart, end: newEnd });
        this.renderTimeSlotsSettings();
        document.getElementById('slotsPerDay').value = this.timeSlots.length;
    }

    addMinutes(timeStr, minutes) {
        const [hours, mins] = timeStr.split(':').map(Number);
        let totalMins = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMins / 60);
        const newMins = totalMins % 60;
        return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
    }

    async saveTimeSlots() {
        await supabaseClient
            .from('time_slots')
            .delete()
            .eq('user_id', this.user.id);

        const slotsData = this.timeSlots.map((slot, index) => ({
            user_id: this.user.id,
            slot_index: index,
            start_time: slot.start,
            end_time: slot.end
        }));

        const { error } = await supabaseClient
            .from('time_slots')
            .insert(slotsData);

        if (error) {
            alert('保存失败：' + error.message);
            return;
        }

        alert('时间设置已保存！');
        this.updateTimeSelects();
        this.renderWeekView();
    }

    updateTimeSelects() {
        const timeSelects = ['courseTimeStart', 'courseTimeEnd', 'modifyTimeStart', 'modifyTimeEnd'];
        
        timeSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            const isModifySelect = selectId.includes('modify');
            
            select.innerHTML = isModifySelect ? '<option value="">不修改</option>' : '';
            
            this.timeSlots.forEach((slot, index) => {
                const option = document.createElement('option');
                option.value = index + 1;
                option.textContent = this.getTimeSlot(index + 1);
                select.appendChild(option);
            });
            
            if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                select.value = currentValue;
            }
        });
    }

    openCourseModal(courseId = null) {
        const modal = document.getElementById('courseModal');
        const title = document.getElementById('courseModalTitle');
        const form = document.getElementById('courseForm');
        
        form.reset();
        document.getElementById('courseId').value = '';
        
        this.updateTimeSelects();
        
        if (courseId) {
            const course = this.courses.find(c => c.id === courseId);
            if (course) {
                title.textContent = '编辑课程';
                document.getElementById('courseId').value = course.id;
                document.getElementById('courseName').value = course.name;
                document.getElementById('courseDay').value = course.day;
                document.getElementById('courseTimeStart').value = course.timeStart;
                document.getElementById('courseTimeEnd').value = course.timeEnd;
                document.getElementById('courseLocation').value = course.location || '';
                document.getElementById('courseWeeks').value = course.weeks || '';
            }
        } else {
            title.textContent = '添加课程';
            document.getElementById('courseTimeEnd').value = '1';
        }
        
        modal.classList.add('active');
    }

    openModifyModal(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;
        
        const modal = document.getElementById('modifyModal');
        const form = document.getElementById('modifyForm');
        
        form.reset();
        document.getElementById('modifyCourseId').value = courseId;
        document.getElementById('modifyWeek').value = this.currentWeek;
        
        document.getElementById('originalCourseInfo').innerHTML = `
            <strong>${course.name}</strong><br>
            时间: ${this.getDayName(course.day)} ${this.getTimeSlotRange(course.timeStart, course.timeEnd)}<br>
            地点: ${course.location || '未设置'}
        `;
        
        this.updateTimeSelects();
        
        const modKey = `${courseId}_${this.currentWeek}`;
        const existingMod = this.modifications[modKey];
        
        if (existingMod) {
            document.getElementById('modifyDay').value = existingMod.newDay || '';
            document.getElementById('modifyTimeStart').value = existingMod.newTimeStart || '';
            document.getElementById('modifyTimeEnd').value = existingMod.newTimeEnd || '';
            document.getElementById('modifyLocation').value = existingMod.newLocation || '';
        }
        
        modal.classList.add('active');
    }

    openTodoModal(todoId = null) {
        const modal = document.getElementById('todoModal');
        const title = document.getElementById('todoModalTitle');
        const form = document.getElementById('todoForm');
        
        form.reset();
        document.getElementById('todoId').value = '';
        
        if (todoId) {
            const todo = this.todos.find(t => t.id === todoId);
            if (todo) {
                title.textContent = '编辑待办事项';
                document.getElementById('todoId').value = todo.id;
                document.getElementById('todoName').value = todo.name;
                document.getElementById('todoDate').value = todo.date;
                document.getElementById('todoTimeStart').value = todo.startTime || '';
                document.getElementById('todoTimeEnd').value = todo.endTime || '';
                document.getElementById('todoLocation').value = todo.location || '';
                document.getElementById('todoNote').value = todo.note || '';
                document.getElementById('todoAlarm').checked = todo.alarm;
            }
        } else {
            title.textContent = '添加待办事项';
            const weekDates = this.getWeekDates(this.currentWeek);
            document.getElementById('todoDate').value = this.formatDate(weekDates[0]);
        }
        
        modal.classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    async saveCourse() {
        const id = document.getElementById('courseId').value;
        const name = document.getElementById('courseName').value.trim();
        const day = parseInt(document.getElementById('courseDay').value);
        const timeStart = parseInt(document.getElementById('courseTimeStart').value);
        const timeEnd = parseInt(document.getElementById('courseTimeEnd').value);
        const location = document.getElementById('courseLocation').value.trim();
        const weeks = document.getElementById('courseWeeks').value.trim();
        
        if (timeStart > timeEnd) {
            alert('开始节次不能大于结束节次');
            return;
        }
        
        const courseData = { 
            user_id: this.user.id,
            name, 
            day, 
            time_start: timeStart,
            time_end: timeEnd,
            location, 
            weeks
        };

        let error;
        if (id) {
            const result = await supabaseClient
                .from('courses')
                .update({ name, day, time_start: timeStart, time_end: timeEnd, location, weeks })
                .eq('id', id);
            error = result.error;
            
            if (!error) {
                const index = this.courses.findIndex(c => c.id === id);
                if (index >= 0) {
                    this.courses[index] = { id, name, day, timeStart, timeEnd, location, weeks };
                }
            }
        } else {
            const result = await supabaseClient
                .from('courses')
                .insert(courseData)
                .select()
                .single();
            error = result.error;
            
            if (!error && result.data) {
                this.courses.push({
                    id: result.data.id,
                    name, day, timeStart, timeEnd, location, weeks
                });
            }
        }

        if (error) {
            alert('保存失败：' + error.message);
            return;
        }

        this.closeAllModals();
        this.renderCourseList();
        this.renderWeekView();
    }

    async saveModification() {
        const courseId = document.getElementById('modifyCourseId').value;
        const week = parseInt(document.getElementById('modifyWeek').value);
        const newDay = document.getElementById('modifyDay').value;
        const newTimeStart = document.getElementById('modifyTimeStart').value;
        const newTimeEnd = document.getElementById('modifyTimeEnd').value;
        const newLocation = document.getElementById('modifyLocation').value.trim();
        
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;
        
        const modKey = `${courseId}_${week}`;
        
        if (!newDay && !newTimeStart && !newTimeEnd && !newLocation) {
            await supabaseClient
                .from('course_modifications')
                .delete()
                .eq('course_id', courseId)
                .eq('week', week);
            delete this.modifications[modKey];
        } else {
            const modData = {
                user_id: this.user.id,
                course_id: courseId,
                week,
                new_day: newDay ? parseInt(newDay) : course.day,
                new_time_start: newTimeStart ? parseInt(newTimeStart) : course.timeStart,
                new_time_end: newTimeEnd ? parseInt(newTimeEnd) : course.timeEnd,
                new_location: newLocation || null
            };

            const { error } = await supabaseClient
                .from('course_modifications')
                .upsert(modData, { onConflict: 'course_id,week' });

            if (error) {
                alert('保存失败：' + error.message);
                return;
            }

            this.modifications[modKey] = {
                courseId,
                week,
                newDay: modData.new_day,
                newTimeStart: modData.new_time_start,
                newTimeEnd: modData.new_time_end,
                newLocation: modData.new_location
            };
        }

        this.closeAllModals();
        this.renderWeekView();
    }

    async saveTodo() {
        const id = document.getElementById('todoId').value;
        const name = document.getElementById('todoName').value.trim();
        const date = document.getElementById('todoDate').value;
        const startTime = document.getElementById('todoTimeStart').value;
        const endTime = document.getElementById('todoTimeEnd').value;
        const location = document.getElementById('todoLocation').value.trim();
        const note = document.getElementById('todoNote').value.trim();
        const alarm = document.getElementById('todoAlarm').checked;
        
        const todoData = {
            user_id: this.user.id,
            name,
            date,
            start_time: startTime || null,
            end_time: endTime || null,
            location: location || null,
            note: note || null,
            alarm
        };

        let error;
        if (id) {
            const result = await supabaseClient
                .from('todos')
                .update({ 
                    name, 
                    date, 
                    start_time: startTime || null, 
                    end_time: endTime || null, 
                    location, 
                    note, 
                    alarm 
                })
                .eq('id', id);
            error = result.error;
            
            if (!error) {
                const index = this.todos.findIndex(t => t.id === id);
                if (index >= 0) {
                    this.todos[index] = { id, name, date, startTime, endTime, location, note, alarm };
                }
            }
        } else {
            const result = await supabaseClient
                .from('todos')
                .insert(todoData)
                .select()
                .single();
            error = result.error;
            
            if (!error && result.data) {
                this.todos.push({
                    id: result.data.id,
                    name, date, startTime, endTime, location, note, alarm
                });
            }
        }

        if (error) {
            alert('保存失败：' + error.message);
            return;
        }

        this.closeAllModals();
        this.renderTodoList();
        this.renderWeekView();
    }

    async deleteCourse(courseId) {
        if (!confirm('确定要删除这门课程吗？')) return;
        
        const { error } = await supabaseClient
            .from('courses')
            .delete()
            .eq('id', courseId);

        if (error) {
            alert('删除失败：' + error.message);
            return;
        }

        this.courses = this.courses.filter(c => c.id !== courseId);
        
        Object.keys(this.modifications).forEach(key => {
            if (key.startsWith(courseId + '_')) {
                delete this.modifications[key];
            }
        });

        this.renderCourseList();
        this.renderWeekView();
    }

    async deleteTodo(todoId) {
        if (!confirm('确定要删除这个待办事项吗？')) return;
        
        const { error } = await supabaseClient
            .from('todos')
            .delete()
            .eq('id', todoId);

        if (error) {
            alert('删除失败：' + error.message);
            return;
        }

        this.todos = this.todos.filter(t => t.id !== todoId);
        this.renderTodoList();
        this.renderWeekView();
    }

    showItemDetail(item) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailContent');
        const actions = document.getElementById('detailActions');
        
        let html = '';
        
        if (item.type === 'fixed') {
            html = `
                <div class="info-box">
                    <strong>类型:</strong> 固定课程<br>
                    <strong>课程名称:</strong> ${item.name}<br>
                    <strong>时间:</strong> ${this.getDayName(item.originalCourse.day)} ${this.getTimeSlotRange(item.originalCourse.timeStart, item.originalCourse.timeEnd)}<br>
                    <strong>地点:</strong> ${item.location || '未设置'}<br>
                    <strong>周次:</strong> ${item.originalCourse.weeks || '全学期'}
                </div>
            `;
            actions.innerHTML = `
                <button class="btn-secondary" onclick="app.closeAllModals(); app.openModifyModal('${item.id}')">临时修改</button>
                <button class="btn-secondary" onclick="app.closeAllModals(); app.switchTab('courses')">管理课程</button>
            `;
        } else if (item.type === 'modified') {
            html = `
                <div class="info-box">
                    <strong>类型:</strong> 临时修改课程<br>
                    <strong>课程名称:</strong> ${item.name}<br>
                    <strong>原时间:</strong> ${this.getDayName(item.originalCourse.day)} ${this.getTimeSlotRange(item.originalCourse.timeStart, item.originalCourse.timeEnd)}<br>
                    <strong>新时间:</strong> ${this.getDayName(item.modification.newDay)} ${this.getTimeSlotRange(item.modification.newTimeStart, item.modification.newTimeEnd)}<br>
                    <strong>地点:</strong> ${item.location || '未设置'}
                </div>
            `;
            actions.innerHTML = `
                <button class="btn-danger" onclick="app.removeModification('${item.id}', ${this.currentWeek})">取消修改</button>
                <button class="btn-secondary" onclick="app.closeAllModals()">关闭</button>
            `;
        } else if (item.type === 'todo-item') {
            html = `
                <div class="info-box">
                    <strong>类型:</strong> 待办事项<br>
                    <strong>名称:</strong> ${item.name}<br>
                    <strong>日期:</strong> ${item.todo.date}<br>
                    ${item.todo.startTime && item.todo.endTime ? `<strong>时间:</strong> ${item.todo.startTime}-${item.todo.endTime}<br>` : ''}
                    <strong>地点:</strong> ${item.location || '未设置'}<br>
                    ${item.todo.note ? `<strong>备注:</strong> ${item.todo.note}<br>` : ''}
                    <strong>闹钟:</strong> ${item.todo.alarm ? '已设置' : '未设置'}
                </div>
            `;
            actions.innerHTML = `
                <button class="btn-secondary" onclick="app.closeAllModals(); app.openTodoModal('${item.id}')">编辑</button>
                <button class="btn-danger" onclick="app.deleteTodo('${item.id}'); app.closeAllModals();">删除</button>
            `;
        }
        
        if (item.hasConflict) {
            html = `<div class="conflict-warning">该时间段存在冲突</div>` + html;
        }
        
        content.innerHTML = html;
        modal.classList.add('active');
    }

    async removeModification(courseId, week) {
        const modKey = `${courseId}_${week}`;
        
        await supabaseClient
            .from('course_modifications')
            .delete()
            .eq('course_id', courseId)
            .eq('week', week);

        delete this.modifications[modKey];
        this.closeAllModals();
        this.renderWeekView();
    }










    // AI对话功能
    initAIChat() {
        this.currentChatMode = null;
        this.currentConversationId = null;
        this.chatHistory = [];
        
        // 绑定事件
        document.getElementById('newChatBtn').addEventListener('click', () => this.startNewChat());
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // 绑定模式选择按钮
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectChatMode(btn.dataset.mode);
            });
        });
    }

    startNewChat() {
        this.currentChatMode = null;
        this.currentConversationId = null;
        this.chatHistory = [];
        document.getElementById('chatMessages').innerHTML = '';
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        this.addSystemMessage('欢迎使用AI对话功能！请选择一个对话模式开始。');
    }

    selectChatMode(mode) {
        this.currentChatMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active');
        
        let welcomeMessage = '';
        switch (mode) {
            case 'single_todo':
                welcomeMessage = '您选择了单次待办模式。请告诉我您的待办事项，例如："下周一下午3点到5点在图书馆做志愿"。';
                break;
            case 'course_modification':
                welcomeMessage = '您选择了课表设置模式。请告诉我您需要设置或修改的课程，例如："我想添加一门新的高等数学课"或"将周二的数学课改到周三下午"。';
                break;
            case 'long_term_plan':
                welcomeMessage = '您选择了长期规划模式。请告诉我您的长期规划，例如："我想要持续健身，请帮我规划时间"。';
                break;
        }
        this.addAIMessage(welcomeMessage);
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addUserMessage(message);
        input.value = '';
        
        this.processUserMessage(message);
    }

    addUserMessage(message) {
        const messagesDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user-message';
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        this.chatHistory.push({ role: 'user', content: message });
    }

    addAIMessage(message) {
        const messagesDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ai-message';
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        this.chatHistory.push({ role: 'assistant', content: message });
    }

    addSystemMessage(message) {
        const messagesDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system-message';
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async processUserMessage(message) {
        if (!this.currentChatMode) {
            this.addAIMessage('请先选择一个对话模式。');
            return;
        }

        // 检查是否是确认/取消回复
        if (this.waitingForConfirmation) {
            this.handleUserConfirmation(message);
            return;
        }

        // 显示加载状态
        const messagesDiv = document.getElementById('chatMessages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message ai-message loading';
        loadingDiv.textContent = 'AI正在思考...';
        messagesDiv.appendChild(loadingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        try {
            const response = await this.callAIChat(message);
            loadingDiv.remove();
            this.handleAIMessage(response);
        } catch (error) {
            loadingDiv.remove();
            
            let errorMessage = '抱歉，AI服务暂时不可用，请稍后再试。';
            
            if (error.message.includes('API调用失败')) {
                errorMessage = '网络连接异常，请检查网络后重试。';
            } else if (error.message.includes('JSON解析失败')) {
                errorMessage = 'AI回复格式异常，请重新描述您的需求。';
            } else if (error.message.includes('401')) {
                errorMessage = 'API密钥无效，请联系管理员检查配置。';
            } else if (error.message.includes('429')) {
                errorMessage = '请求过于频繁，请稍后再试。';
            }
            
            this.addAIMessage(errorMessage);
            console.error('AI对话错误：', error);
        }
    }

    async callAIChat(message) {
        const apiKey = window.APP_CONFIG.DEEPSEEK_API_KEY;
        const messages = [
            {
                role: 'system',
                content: this.getSystemPrompt()
            },
            ...this.chatHistory,
            {
                role: 'user',
                content: message
            }
        ];

        let lastError;
        
        // 重试机制（最多3次）
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 2048,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    throw new Error(`API调用失败，状态码：${response.status}`);
                }

                const data = await response.json();
                const aiResponse = data.choices[0].message.content;
                
                // DeepSeek API直接返回JSON，无需提取Markdown
                try {
                    return JSON.parse(aiResponse);
                } catch (parseError) {
                    throw new Error(`JSON解析失败：${parseError.message}`);
                }
                
            } catch (error) {
                lastError = error;
                console.warn(`AI API调用第${attempt}次失败：`, error);
                
                if (attempt < 3) {
                    // 等待一段时间后重试（指数退避）
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        throw lastError;
    }

    getSystemPrompt() {
        let prompt = `你是一个智能日程管理助手，帮助用户管理课程表和待办事项。

## 重要说明：
你必须严格按照指定的JSON格式返回数据，直接返回JSON对象，不要包含任何Markdown格式。

当前用户信息：
- 用户ID: ${this.user.id}
- 当前周次: ${this.currentWeek}

课程表：
${JSON.stringify(this.courses, null, 2)}

待办事项：
${JSON.stringify(this.todos, null, 2)}

时间段设置：
${JSON.stringify(this.timeSlots, null, 2)}

`;

        switch (this.currentChatMode) {
            case 'single_todo':
                prompt += `
对话模式：单次待办
任务：帮助用户添加一次性待办事项

重要规则：
1. 必须从用户输入中提取以下信息：
   - 待办事项名称（必填）
   - 日期（必填，格式：YYYY-MM-DD）
   - 开始时间（必填，格式：HH:MM）
   - 结束时间（必填，格式：HH:MM）
   - 地点（可选）
   - 备注（可选）

2. 时间处理：
   - 如果用户说"下午3点"，转换为"15:00"
   - 如果用户说"明天"，计算为明天的日期
   - 如果用户说"下周一"，计算为下周一的日期

3. 冲突检测：
   - 检查与固定课程的时间冲突
   - 检查与待办事项的时间冲突
   - 检查与临时修改的时间冲突

4. 引导策略：
   - 如果信息不完整，必须引导用户补充缺失信息
   - 如果检测到冲突，必须告知用户并提供调整建议

## 输出格式要求：
你必须严格按照以下JSON格式返回数据，将JSON代码块用\`\`\`json和\`\`\`包裹起来。

\`\`\`json
{
  "type": "todo_suggestion",
  "status": "complete|incomplete",
  "message": "回复用户的消息",
  "data": {
    "name": "待办事项名称",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "地点",
    "note": "备注",
    "conflict": false,
    "conflictDetails": []
  }
}

## 示例：
用户："明天下午3点到5点在图书馆学习"

直接返回以下JSON对象：

{
  "type": "todo_suggestion",
  "status": "complete",
  "message": "已为您创建待办事项：明天（${this.getTomorrowDate()}）下午3点到5点在图书馆学习。请确认是否添加。",
  "data": {
    "name": "学习",
    "date": "${this.getTomorrowDate()}",
    "startTime": "15:00",
    "endTime": "17:00",
    "location": "图书馆",
    "note": "",
    "conflict": false,
    "conflictDetails": []
  }
}
`;
                break;
            case 'course_modification':
                prompt += `
对话模式：课表设置
任务：帮助用户设置或修改课程

## 第一步：确定修改类型
你必须首先询问用户是要进行固定课程设置还是临时修改：
- 固定课程设置：添加新的固定课程到课表
- 临时修改：临时调整现有课程的时间或地点

重要规则：
1. 当用户首次在课表设置模式下发送消息时，你必须首先询问修改类型
2. 只有在用户明确选择了修改类型后，才能进行后续处理
3. 如果用户的消息中已经明确指定了修改类型，可以跳过询问

## 第二步：根据类型处理

### 如果是固定课程设置：
重要规则：
1. 必须从用户输入中提取以下信息：
   - 课程名称（必填）
   - 上课日期和时间段（必填，支持多天设置）
   - 上课地点（可选，支持不同天数的不同地点）
   - 生效周次（可选，默认1-20）

2. 多天课程处理：
   - 如果一门课程一周有两天要上，且时间段和地点不同，必须自动分解为多个课程设置
   - 每个课程设置包含：日期（1-7）、开始节次（1-${this.timeSlots.length}）、结束节次（1-${this.timeSlots.length}）、地点
   - 课程名称保持不变，系统会自动处理多天设置

3. 冲突检测：
   - 检查与固定课程的时间冲突
   - 检查与待办事项的时间冲突

### 如果是临时修改：
重要规则：
1. 必须从用户输入中提取以下信息：
   - 课程名称（必填，必须与现有课程匹配）
   - 新日期（必填，1-7表示周一到周日）
   - 新开始节次（必填，1-${this.timeSlots.length}）
   - 新结束节次（必填，1-${this.timeSlots.length}）
   - 新地点（可选）

2. 临时修改特点：
   - 临时修改只针对单个现有课程
   - 修改后的课程会显示为临时修改状态
   - 原课程安排会被临时覆盖

3. 课程匹配：
   - 使用模糊匹配查找课程
   - 如果找不到匹配课程，必须询问用户确认课程名称

4. 冲突检测：
   - 检查与固定课程的时间冲突（排除自身）
   - 检查与待办事项的时间冲突

## 通用引导策略：
- 如果信息不完整，必须引导用户补充
- 如果检测到冲突，必须告知用户并提供调整建议

## 输出格式要求：
你必须严格按照以下JSON格式返回数据，直接返回JSON对象。

{
  "type": "course_mod_suggestion",
  "status": "complete|incomplete",
  "message": "回复用户的消息",
  "data": {
    "modType": "fixed|temporary",
    "courseName": "课程名称",
    "courses": [
      {
        "day": 1,
        "timeStart": 1,
        "timeEnd": 2,
        "location": "地点"
      }
    ],
    "weeks": "1-20",
    "conflict": false,
    "conflictDetails": []
  }
}

## 示例：
用户："我想添加一门新的高等数学课"

直接返回以下JSON对象：

{
  "type": "course_mod_suggestion",
  "status": "incomplete",
  "message": "好的，我来帮您添加高等数学课。请问您希望进行固定课程设置还是临时修改？\n\n1. 固定课程设置：将这门课添加到固定课表中\n2. 临时修改：临时调整这门课的时间或地点\n\n请回复1或2选择修改类型。",
  "data": {
    "modType": "",
    "courseName": "高等数学",
    "courses": [],
    "weeks": "1-20",
    "conflict": false,
    "conflictDetails": []
  }
}
`;
                break;
            case 'long_term_plan':
                prompt += `
对话模式：长期规划
任务：帮助用户创建长期规划（如健身、学习等）

重要规则：
1. 必须从用户输入中提取以下信息：
   - 活动名称（必填，如"健身"、"学习"）
   - 频率（必填："每天"、"每周"、"周末"）
   - 持续时间（可选，默认4周）
   - 偏好时间（可选："上午"、"下午"、"晚上"）
   - 偏好日期（可选，1-7表示周一到周日）
   - 地点（可选）

2. 规划生成：
   - 必须将长期规划分解为具体的待办事项实例
   - 根据频率和持续时间生成具体的时间安排
   - 每个实例必须包含具体的日期、开始时间、结束时间和地点

3. 引导策略：
   - 如果信息不完整，必须引导用户补充
   - 如果检测到冲突，必须告知用户并提供调整建议

## 输出格式要求：
你必须严格按照以下JSON格式返回数据，将JSON代码块用\`\`\`json和\`\`\`包裹起来。

\`\`\`json
{
  "type": "long_term_plan",
  "status": "complete|incomplete",
  "message": "回复用户的消息",
  "data": {
    "activityName": "活动名称",
    "frequency": "daily|weekly|weekend",
    "duration": 4,
    "preferredTime": "morning|afternoon|evening",
    "preferredDays": [2, 4, 6],
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "地点",
    "instances": [
      {
        "date": "YYYY-MM-DD",
        "startTime": "HH:MM",
        "endTime": "HH:MM",
        "location": "地点"
      }
    ]
  }
}
\`\`\`

## 示例：
用户："我想要持续健身，请帮我规划时间"

直接返回以下JSON对象：

{
  "type": "long_term_plan",
  "status": "complete",
  "message": "已为您生成为期4周的健身规划。建议每周二、四、六下午4点到6点在健身房进行锻炼。请确认是否创建此规划。",
  "data": {
    "activityName": "健身",
    "frequency": "weekly",
    "duration": 4,
    "preferredTime": "afternoon",
    "preferredDays": [2, 4, 6],
    "startTime": "16:00",
    "endTime": "18:00",
    "location": "健身房",
    "instances": [
      {
        "date": "2026-03-25",
        "startTime": "16:00",
        "endTime": "18:00",
        "location": "健身房"
      },
      {
        "date": "2026-03-27",
        "startTime": "16:00",
        "endTime": "18:00",
        "location": "健身房"
      },
      {
        "date": "2026-03-29",
        "startTime": "16:00",
        "endTime": "18:00",
        "location": "健身房"
      }
    ]
  }
}
`;
                break;
        }

        return prompt;
    }

    handleAIMessage(response) {
        if (!response) {
            this.addAIMessage('抱歉，AI回复格式不正确，请稍后再试。');
            return;
        }

        this.addAIMessage(response.message);

        if (response.status === 'complete') {
            switch (response.type) {
                case 'todo_suggestion':
                    this.previewTodo(response.data);
                    break;
                case 'course_mod_suggestion':
                    this.previewCourseModification(response.data);
                    break;
                case 'long_term_plan':
                    this.previewLongTermPlan(response.data);
                    break;
            }
        }
    }

    handleUserConfirmation(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        // 检查是否是修改类型选择（1或2）
        if (this.currentSuggestion && this.currentSuggestion.type === 'course_mod_suggestion' && 
            this.currentSuggestion.data && !this.currentSuggestion.data.modType) {
            
            if (lowerMessage === '1' || lowerMessage === '固定' || lowerMessage === '固定课程') {
                this.currentSuggestion.data.modType = 'fixed';
                this.previewCourseModification(this.currentSuggestion.data);
                return;
            } else if (lowerMessage === '2' || lowerMessage === '临时' || lowerMessage === '临时修改') {
                this.currentSuggestion.data.modType = 'temporary';
                this.previewCourseModification(this.currentSuggestion.data);
                return;
            }
        }
        
        if (lowerMessage === '确认' || lowerMessage === '是' || lowerMessage === 'yes' || lowerMessage === 'y') {
            this.confirmCurrentSuggestion();
        } else if (lowerMessage === '取消' || lowerMessage === '否' || lowerMessage === 'no' || lowerMessage === 'n') {
            this.cancelCurrentSuggestion();
        } else {
            this.addAIMessage('请回复"确认"或"取消"来确认或取消当前建议。');
            return;
        }
        
        this.waitingForConfirmation = false;
    }

    async confirmCurrentSuggestion() {
        if (!this.currentSuggestion) {
            this.addAIMessage('没有可确认的建议。');
            return;
        }

        try {
            switch (this.currentSuggestion.type) {
                case 'todo_suggestion':
                    await this.confirmTodoSuggestion(this.currentSuggestion.data);
                    break;
                case 'course_mod_suggestion':
                    await this.confirmCourseModSuggestion(this.currentSuggestion.data);
                    break;
                case 'long_term_plan':
                    await this.confirmLongTermPlan(this.currentSuggestion.data);
                    break;
            }
            
            this.currentSuggestion = null;
            this.renderWeekView();
        } catch (error) {
            this.addAIMessage('确认失败，请稍后再试。');
            console.error('确认建议失败：', error);
        }
    }

    cancelCurrentSuggestion() {
        this.addAIMessage('已取消当前建议。');
        this.currentSuggestion = null;
        this.renderWeekView();
    }

    async confirmTodoSuggestion(todoData) {
        const { data: newTodo } = await supabaseClient
            .from('todos')
            .insert({
                user_id: this.user.id,
                name: todoData.name,
                date: todoData.date,
                start_time: todoData.startTime,
                end_time: todoData.endTime,
                location: todoData.location,
                note: todoData.note,
                status: 'pending'
            })
            .select()
            .single();
        
        if (newTodo) {
            this.todos.push(newTodo);
            this.addAIMessage('待办事项已成功添加！');
            
            // 保存对话到数据库
            await this.saveConversationToDB('todo_suggestion', 'confirmed');
        }
    }

    async confirmCourseModSuggestion(courseData) {
        try {
            if (courseData.modType === 'fixed') {
                // 固定课程设置 - 处理多天课程
                if (courseData.courses && courseData.courses.length > 0) {
                    const coursePromises = courseData.courses.map(async (course) => {
                        // 创建固定课程
                        const { data: newCourse, error } = await supabaseClient
                            .from('courses')
                            .insert({
                                user_id: this.user.id,
                                name: courseData.courseName,
                                day: course.day,
                                time_start: course.timeStart,
                                time_end: course.timeEnd,
                                location: course.location || '',
                                weeks: courseData.weeks || '1-20'
                            })
                            .select()
                            .single();
                        
                        if (error) throw error;
                        return newCourse;
                    });
                    
                    const newCourses = await Promise.all(coursePromises);
                    
                    // 添加到本地课程列表
                    newCourses.forEach(course => {
                        this.courses.push(course);
                    });
                    
                    this.addAIMessage(`固定课程设置已成功应用！共添加了${newCourses.length}个课程安排。`);
                    await this.saveConversationToDB('course_mod_suggestion', 'confirmed');
                } else {
                    this.addAIMessage('没有可添加的课程安排。');
                }
            } else if (courseData.modType === 'temporary') {
                // 临时修改
                // 创建临时修改记录
                const modificationKey = `${courseData.courseId}_${this.currentWeek}`;
                
                this.modifications[modificationKey] = {
                    courseId: courseData.courseId,
                    newDay: courseData.newDay,
                    newTimeStart: courseData.newTimeStart,
                    newTimeEnd: courseData.newTimeEnd,
                    newLocation: courseData.newLocation || courseData.oldLocation,
                    week: this.currentWeek
                };
                
                // 保存到数据库
                const { data: modSuggestion } = await supabaseClient
                    .from('course_mod_suggestions')
                    .insert({
                        conversation_id: this.currentConversationId,
                        user_id: this.user.id,
                        course_id: courseData.courseId,
                        course_name: courseData.courseName,
                        old_day: courseData.oldDay,
                        old_time_start: courseData.oldTimeStart,
                        old_time_end: courseData.oldTimeEnd,
                        new_day: courseData.newDay,
                        new_time_start: courseData.newTimeStart,
                        new_time_end: courseData.newTimeEnd,
                        new_location: courseData.newLocation || courseData.oldLocation,
                        conflict: false, // 实际应该根据冲突检测结果设置
                        conflict_details: null,
                        status: 'confirmed'
                    })
                    .select()
                    .single();
                
                if (modSuggestion) {
                    this.addAIMessage('课程修改已成功应用！');
                    await this.saveConversationToDB('course_mod_suggestion', 'confirmed');
                    
                    // 立即重新渲染日程，显示临时修改
                    this.renderWeekView();
                }
            }
            
            this.renderWeekView();
        } catch (error) {
            this.addAIMessage('课程设置失败，请稍后再试。');
            console.error('课程设置失败：', error);
        }
    }

    async confirmLongTermPlan(planData) {
        try {
            // 创建长期规划记录
            const { data: longTermPlan, error: planError } = await supabaseClient
                .from('ai_plans')
                .insert({
                    user_id: this.user.id,
                    plan_type: 'long_term',
                    plan_scope: 'semester',
                    plan_summary: `${planData.activityName} - ${planData.frequency} - ${planData.duration || 4}周`,
                    plan_data: planData,
                    status: 'confirmed'
                })
                .select()
                .single();
            
            if (planError) throw planError;
            
            if (longTermPlan) {
                // 创建规划实例（待办事项）- 使用Promise.all进行批量操作
                if (planData.instances && planData.instances.length > 0) {
                    const todoPromises = planData.instances.map(async (instance) => {
                        const { data: newTodo, error } = await supabaseClient
                            .from('todos')
                            .insert({
                                user_id: this.user.id,
                                name: planData.activityName,
                                type: 'long_term',
                                date: instance.date,
                                start_time: instance.startTime,
                                end_time: instance.endTime,
                                location: instance.location || planData.location || '',
                                note: `长期规划：${planData.activityName}`,
                                status: 'pending',
                                plan_id: longTermPlan.id
                            })
                            .select()
                            .single();
                        
                        if (error) throw error;
                        return newTodo;
                    });
                    
                    const newTodos = await Promise.all(todoPromises);
                    
                    // 添加到本地待办事项列表
                    newTodos.forEach(todo => {
                        this.todos.push(todo);
                    });
                    
                    this.addAIMessage(`长期规划已成功创建！共添加${newTodos.length}个待办事项。`);
                    this.renderWeekView();
                    await this.saveConversationToDB('long_term_plan', 'confirmed');
                } else {
                    this.addAIMessage('没有可添加的规划实例。');
                }
            }
        } catch (error) {
            this.addAIMessage(`长期规划创建失败：${error.message || '未知错误'}，请稍后再试。`);
            console.error('长期规划创建失败：', error);
        }
    }

    previewTodo(todoData) {
        // 检查冲突
        const conflictResult = this.checkScheduleConflict(
            todoData.date, 
            todoData.startTime, 
            todoData.endTime
        );
        
        // 设置当前建议
        this.currentSuggestion = {
            type: 'todo_suggestion',
            data: todoData
        };
        
        // 预显示在日程页面
        this.renderWeekView();
        
        let message = '待办事项已在日程页面预显示（黄色虚线框），请查看。';
        
        if (conflictResult.conflict) {
            message += '\n?? 检测到时间冲突：';
            conflictResult.details.forEach(detail => {
                message += `\n- ${detail.type}: ${detail.name} (${detail.time})`;
            });
            message += '\n建议调整时间或确认后覆盖。';
        }
        
        message += '\n如果确认添加，请回复"确认"，否则回复"取消"。';
        
        this.addAIMessage(message);
        this.waitingForConfirmation = true;
    }

    previewCourseModification(courseData) {
        // 检查修改类型
        if (!courseData.modType) {
            // 需要用户选择修改类型
            this.currentSuggestion = {
                type: 'course_mod_suggestion',
                data: courseData
            };
            return;
        }

        if (courseData.modType === 'fixed') {
            // 固定课程设置 - 支持多天课程
            const conflictResults = [];
            let hasConflict = false;
            
            // 检查每个课程的冲突
            if (courseData.courses && courseData.courses.length > 0) {
                courseData.courses.forEach(course => {
                    const conflictResult = this.checkScheduleConflict(
                        this.getDateForDay(course.day, this.currentWeek),
                        this.timeSlots[course.timeStart - 1].start,
                        this.timeSlots[course.timeEnd - 1].end
                    );
                    
                    if (conflictResult.conflict) {
                        hasConflict = true;
                        conflictResults.push({
                            course: course,
                            conflict: conflictResult
                        });
                    }
                });
            }
            
            // 设置当前建议
            this.currentSuggestion = {
                type: 'course_mod_suggestion',
                data: {
                    ...courseData,
                    conflict: hasConflict,
                    conflictDetails: conflictResults
                }
            };
            
            // 预显示在日程页面
            this.renderWeekView();
            
            let message = `固定课程设置已在日程页面预显示：\n`;
            message += `课程名称：${courseData.courseName}\n`;
            
            // 显示每个课程的时间安排
            if (courseData.courses && courseData.courses.length > 0) {
                courseData.courses.forEach((course, index) => {
                    message += `课程${index + 1}：${this.getDayName(course.day)} ${this.getTimeSlotRange(course.timeStart, course.timeEnd)} ${course.location || ''}\n`;
                });
            }
            
            message += `生效周次：${courseData.weeks || '1-20'}\n`;
            
            if (hasConflict) {
                message += '?? 检测到时间冲突：';
                conflictResults.forEach(result => {
                    message += `\n- ${this.getDayName(result.course.day)} ${this.getTimeSlotRange(result.course.timeStart, result.course.timeEnd)}：`;
                    result.conflict.details.forEach(detail => {
                        message += `\n  ${detail.type}: ${detail.name} (${detail.time})`;
                    });
                });
                message += '\n建议调整时间或确认后覆盖。';
            }
            
            message += '\n如果确认添加，请回复"确认"，否则回复"取消"。';
            
            this.addAIMessage(message);
            this.waitingForConfirmation = true;
            
        } else if (courseData.modType === 'temporary') {
            // 临时修改
            const matchedCourse = this.findCourseByName(courseData.courseName);
            
            if (!matchedCourse) {
                this.addAIMessage(`未找到课程"${courseData.courseName}"，请检查课程名称是否正确。`);
                return;
            }
            
            // 检查冲突
            const conflictResult = this.checkCourseModificationConflict(
                matchedCourse, 
                courseData.newDay, 
                courseData.newTimeStart, 
                courseData.newTimeEnd
            );
            
            // 设置当前建议
            this.currentSuggestion = {
                type: 'course_mod_suggestion',
                data: {
                    ...courseData,
                    courseId: matchedCourse.id,
                    oldDay: matchedCourse.day,
                    oldTimeStart: matchedCourse.timeStart,
                    oldTimeEnd: matchedCourse.timeEnd,
                    oldLocation: matchedCourse.location,
                    conflict: conflictResult.conflict,
                    conflictDetails: conflictResult.details
                }
            };
            
            // 预显示在日程页面
            this.renderWeekView();
            
            let message = `课程修改已在日程页面预显示：\n`;
            message += `原安排：${this.getDayName(matchedCourse.day)} ${this.getTimeSlotRange(matchedCourse.timeStart, matchedCourse.timeEnd)} ${matchedCourse.location || ''}\n`;
            message += `新安排：${this.getDayName(courseData.newDay)} ${this.getTimeSlotRange(courseData.newTimeStart, courseData.newTimeEnd)} ${courseData.newLocation || '原地点'}\n`;
            
            if (conflictResult.conflict) {
                message += '?? 检测到时间冲突：';
                conflictResult.details.forEach(detail => {
                    message += `\n- ${detail.type}: ${detail.name} (${detail.time})`;
                });
                message += '\n建议调整时间或确认后覆盖。';
            }
            
            message += '\n如果确认修改，请回复"确认"，否则回复"取消"。';
            
            this.addAIMessage(message);
            this.waitingForConfirmation = true;
        }
    }

    previewLongTermPlan(planData) {
        // 使用AI生成的实例或本地生成实例
        let planInstances = planData.instances || [];
        
        // 如果没有AI生成的实例，使用本地生成逻辑
        if (planInstances.length === 0) {

        }
        
        // 检查冲突
        const conflictResults = [];
        planInstances.forEach(instance => {
            const conflictResult = this.checkScheduleConflict(
                instance.date, 
                instance.startTime, 
                instance.endTime
            );
            if (conflictResult.conflict) {
                conflictResults.push({
                    date: instance.date,
                    conflicts: conflictResult.details
                });
            }
        });
        
        // 设置当前建议
        this.currentSuggestion = {
            type: 'long_term_plan',
            data: {
                ...planData,
                instances: planInstances
            }
        };
        
        // 预显示在日程页面
        this.renderWeekView();
        
        let message = `长期规划已在日程页面预显示，共生成${planInstances.length}个实例。\n`;
        message += `规划内容：${planData.activityName}，频率：${planData.frequency}，持续${planData.duration || 1}周\n`;
        
        // 显示前5个实例作为示例
        if (planInstances.length > 0) {
            message += '\n前5个实例：\n';
            planInstances.slice(0, 5).forEach((instance, index) => {
                const date = new Date(instance.date);
                const dayName = this.getDayName(date.getDay() || 7);
                message += `${index + 1}. ${dayName} ${instance.date} ${instance.startTime}-${instance.endTime} ${instance.location || ''}\n`;
            });
            if (planInstances.length > 5) {
                message += `... 还有${planInstances.length - 5}个实例\n`;
            }
        }
        
        if (conflictResults.length > 0) {
            message += '\n?? 检测到以下时间冲突：';
            conflictResults.forEach(result => {
                message += `\n${result.date}：`;
                result.conflicts.forEach(conflict => {
                    message += `\n- ${conflict.type}: ${conflict.name} (${conflict.time})`;
                });
            });
            message += '\n建议调整时间或确认后覆盖。';
        }
        
        message += '\n如果确认添加，请回复"确认"，否则回复"取消"。';
        
        this.addAIMessage(message);
        this.waitingForConfirmation = true;
    }

    async confirmAIRecommendation(data, type) {
        switch (type) {
            case 'todo':
                // 添加待办事项
                const { data: newTodo } = await supabaseClient
                    .from('todos')
                    .insert({
                        user_id: this.user.id,
                        name: data.name,
                        date: data.date,
                        start_time: data.startTime,
                        end_time: data.endTime,
                        location: data.location,
                        note: data.note,
                        status: 'pending'
                    })
                    .select()
                    .single();
                
                if (newTodo) {
                    this.todos.push(newTodo);
                    this.renderWeekView();
                    this.addAIMessage('待办事项已成功添加！');
                }
                break;
            case 'course_mod':
                // 临时修改课程
                // 这里需要实现课程临时修改的逻辑
                this.addAIMessage('课程修改已成功应用！');
                break;
            case 'long_term_plan':
                // 创建长期规划
                // 这里需要实现长期规划的逻辑
                this.addAIMessage('长期规划已成功创建！');
                break;
        }
    }

    checkScheduleConflict(date, startTime, endTime) {
        if (!startTime || !endTime) {
            return { conflict: false, details: [] };
        }
        
        const conflictDetails = [];
        const targetDate = new Date(date);
        const targetStart = this.timeToMinutes(startTime);
        const targetEnd = this.timeToMinutes(endTime);
        
        // 检查固定课程冲突
        this.courses.forEach(course => {
            const courseDay = course.day;
            const targetDay = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
            
            if (courseDay === targetDay) {
                const courseStart = this.timeToMinutes(this.timeSlots[course.timeStart - 1]?.start);
                const courseEnd = this.timeToMinutes(this.timeSlots[course.timeEnd - 1]?.end);
                
                if (this.timeOverlaps(targetStart, targetEnd, courseStart, courseEnd)) {
                    conflictDetails.push({
                        type: '固定课程',
                        name: course.name,
                        time: `${this.timeSlots[course.timeStart - 1]?.start}-${this.timeSlots[course.timeEnd - 1]?.end}`,
                        location: course.location
                    });
                }
            }
        });
        
        // 检查待办事项冲突
        this.todos.forEach(todo => {
            if (todo.date === date && todo.startTime && todo.endTime) {
                const todoStart = this.timeToMinutes(todo.startTime);
                const todoEnd = this.timeToMinutes(todo.endTime);
                
                if (this.timeOverlaps(targetStart, targetEnd, todoStart, todoEnd)) {
                    conflictDetails.push({
                        type: '待办事项',
                        name: todo.name,
                        time: `${todo.startTime}-${todo.endTime}`,
                        location: todo.location
                    });
                }
            }
        });
        
        // 检查临时修改冲突
        Object.values(this.modifications).forEach(mod => {
            const modDate = this.getDateForDay(mod.newDay, this.currentWeek);
            if (modDate.toDateString() === targetDate.toDateString()) {
                const modStart = this.timeToMinutes(this.timeSlots[mod.newTimeStart - 1]?.start);
                const modEnd = this.timeToMinutes(this.timeSlots[mod.newTimeEnd - 1]?.end);
                
                if (this.timeOverlaps(targetStart, targetEnd, modStart, modEnd)) {
                    const course = this.courses.find(c => c.id === mod.courseId);
                    conflictDetails.push({
                        type: '临时修改',
                        name: course?.name || '未知课程',
                        time: `${this.timeSlots[mod.newTimeStart - 1]?.start}-${this.timeSlots[mod.newTimeEnd - 1]?.end}`,
                        location: mod.newLocation
                    });
                }
            }
        });
        
        return {
            conflict: conflictDetails.length > 0,
            details: conflictDetails
        };
    }
    
    timeOverlaps(start1, end1, start2, end2) {
        return start1 < end2 && end1 > start2;
    }

    findCourseByName(courseName) {
        return this.courses.find(course => 
            course.name.toLowerCase().includes(courseName.toLowerCase()) ||
            courseName.toLowerCase().includes(course.name.toLowerCase())
        );
    }

    checkCourseModificationConflict(course, newDay, newTimeStart, newTimeEnd) {
        const conflictDetails = [];
        
        // 检查与固定课程的冲突（排除自身）
        this.courses.forEach(otherCourse => {
            if (otherCourse.id !== course.id && otherCourse.day === newDay) {
                const overlap = this.timeOverlaps(
                    newTimeStart, newTimeEnd,
                    otherCourse.timeStart, otherCourse.timeEnd
                );
                
                if (overlap) {
                    conflictDetails.push({
                        type: '固定课程',
                        name: otherCourse.name,
                        time: `${this.getTimeSlotRange(otherCourse.timeStart, otherCourse.timeEnd)}`,
                        location: otherCourse.location
                    });
                }
            }
        });
        
        // 检查与待办事项的冲突
        const targetDate = this.getDateForDay(newDay, this.currentWeek);
        const dateStr = this.formatDate(targetDate);
        
        this.todos.forEach(todo => {
            if (todo.date === dateStr && todo.startTime && todo.endTime) {
                const todoStart = this.timeToMinutes(todo.startTime);
                const todoEnd = this.timeToMinutes(todo.endTime);
                const newStart = this.timeToMinutes(this.timeSlots[newTimeStart - 1]?.start);
                const newEnd = this.timeToMinutes(this.timeSlots[newTimeEnd - 1]?.end);
                
                if (this.timeOverlaps(newStart, newEnd, todoStart, todoEnd)) {
                    conflictDetails.push({
                        type: '待办事项',
                        name: todo.name,
                        time: `${todo.startTime}-${todo.endTime}`,
                        location: todo.location
                    });
                }
            }
        });
        
        return {
            conflict: conflictDetails.length > 0,
            details: conflictDetails
        };
    }

    generatePlanInstances(planData) {
        const instances = [];
        const duration = planData.duration || 4; // 默认4周
        const startDate = new Date();
        
        for (let week = 0; week < duration; week++) {
            const currentWeekDate = new Date(startDate);
            currentWeekDate.setDate(startDate.getDate() + week * 7);
            
            // 根据频率生成实例
            if (planData.frequency === 'daily' || planData.frequency === '每天') {
                // 每天生成
                for (let day = 1; day <= 7; day++) {
                    const instanceDate = new Date(currentWeekDate);
                    instanceDate.setDate(currentWeekDate.getDate() + (day - 1));
                    
                    instances.push({
                        date: this.formatDate(instanceDate),
                        startTime: planData.startTime || '14:00',
                        endTime: planData.endTime || '16:00',
                        name: planData.activityName,
                        location: planData.location || '待定'
                    });
                }
            } else if (planData.frequency === 'weekly' || planData.frequency === '每周') {
                // 每周生成（根据偏好日期）
                const preferredDays = planData.preferredDays || [2, 4, 6]; // 默认周二、四、六
                
                preferredDays.forEach(day => {
                    const instanceDate = new Date(currentWeekDate);
                    instanceDate.setDate(currentWeekDate.getDate() + (day - 1));
                    
                    instances.push({
                        date: this.formatDate(instanceDate),
                        startTime: planData.startTime || '14:00',
                        endTime: planData.endTime || '16:00',
                        name: planData.activityName,
                        location: planData.location || '待定'
                    });
                });
            } else if (planData.frequency === 'weekend' || planData.frequency === '周末') {
                // 周末生成
                for (let day = 6; day <= 7; day++) {
                    const instanceDate = new Date(currentWeekDate);
                    instanceDate.setDate(currentWeekDate.getDate() + (day - 1));
                    
                    instances.push({
                        date: this.formatDate(instanceDate),
                        startTime: planData.startTime || '14:00',
                        endTime: planData.endTime || '16:00',
                        name: planData.activityName,
                        location: planData.location || '待定'
                    });
                }
            }
        }
        
        return instances;
    }

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return this.formatDate(tomorrow);
    }

    // 对话持久化功能
    async saveConversationToDB(suggestionType, status) {
        try {
            // 保存对话记录
            const { data: conversation } = await supabaseClient
                .from('ai_conversations')
                .insert({
                    user_id: this.user.id,
                    conversation_type: this.currentChatMode,
                    status: status,
                    current_step: 'completed',
                    context: JSON.stringify(this.currentSuggestion)
                })
                .select()
                .single();

            if (!conversation) return;

            // 保存所有消息
            for (const message of this.chatHistory) {
                await supabaseClient
                    .from('ai_messages')
                    .insert({
                        conversation_id: conversation.id,
                        user_id: this.user.id,
                        role: message.role,
                        content: message.content,
                        message_type: message.role === 'assistant' ? suggestionType : 'text'
                    });
            }

            // 保存建议
            if (this.currentSuggestion) {
                switch (suggestionType) {
                    case 'todo_suggestion':
                        await this.saveTodoSuggestion(conversation.id, this.currentSuggestion.data);
                        break;
                    case 'course_mod_suggestion':
                        await this.saveCourseModSuggestion(conversation.id, this.currentSuggestion.data);
                        break;
                    case 'long_term_plan':
                        await this.saveLongTermPlan(conversation.id, this.currentSuggestion.data);
                        break;
                }
            }

            console.log('对话已保存到数据库');
        } catch (error) {
            console.error('保存对话失败：', error);
        }
    }

    async saveTodoSuggestion(conversationId, todoData) {
        await supabaseClient
            .from('todo_suggestions')
            .insert({
                conversation_id: conversationId,
                user_id: this.user.id,
                name: todoData.name,
                date: todoData.date,
                start_time: todoData.startTime,
                end_time: todoData.endTime,
                location: todoData.location,
                note: todoData.note,
                conflict: false, // 实际应该根据冲突检测结果设置
                conflict_details: null,
                status: 'confirmed'
            });
    }

    async saveCourseModSuggestion(conversationId, courseData) {
        try {
            // 检查是固定课程设置还是临时修改
            if (courseData.modType === 'fixed') {
                // 固定课程设置 - 添加到固定课程表
                const { error } = await supabaseClient
                    .from('courses')
                    .insert({
                        user_id: this.user.id,
                        name: courseData.courseName,
                        day: courseData.newDay,
                        time_start: courseData.newTimeStart,
                        time_end: courseData.newTimeEnd,
                        location: courseData.newLocation || '',
                        weeks: courseData.weeks || '1-20'
                    });

                if (error) throw error;
                
                // 重新加载课程数据
                await this.loadCourses();
                
            } else if (courseData.modType === 'temporary') {
                // 临时修改 - 添加到临时修改表
                const { error } = await supabaseClient
                    .from('course_modifications')
                    .insert({
                        user_id: this.user.id,
                        course_id: courseData.courseId,
                        week: this.currentWeek,
                        new_day: courseData.newDay,
                        new_time_start: courseData.newTimeStart,
                        new_time_end: courseData.newTimeEnd,
                        new_location: courseData.newLocation || '',
                        status: 'active'
                    });

                if (error) throw error;
                
                // 重新加载临时修改数据
                await this.loadModifications();
            }

            // 保存对话记录
            await supabaseClient
                .from('ai_conversations')
                .update({ status: 'completed' })
                .eq('id', conversationId);

            console.log('课程设置已保存到数据库');
        } catch (error) {
            console.error('保存课程设置失败：', error);
            throw error;
        }
    }

    async saveLongTermPlan(conversationId, planData) {
        // 长期规划保存逻辑
        console.log('保存长期规划：', planData);
    }

    // 时间设置相关方法
    initSettings() {
        this.bindSettingsEvents();
        this.loadSettings();
    }

    bindSettingsEvents() {
        // 学期设置相关事件
        document.getElementById('semesterStart').addEventListener('change', () => {
            this.calculateSemesterEnd();
        });
        
        document.getElementById('totalWeeks').addEventListener('change', () => {
            this.calculateSemesterEnd();
        });

        // 保存学期设置
        document.getElementById('saveSemesterSettings').addEventListener('click', () => {
            this.saveSemesterSettings();
        });

        // 添加时间节次
        document.getElementById('addTimeSlotBtn').addEventListener('click', () => {
            this.addTimeSlot();
        });

        // 保存时间设置
        document.getElementById('saveTimeSlots').addEventListener('click', () => {
            this.saveTimeSlots();
        });
    }

    async loadSettings() {
        // 加载学期设置
        const { data } = await supabaseClient
            .from('semester_settings')
            .select('*')
            .eq('user_id', this.user.id)
            .single();

        if (data) {
            document.getElementById('semesterStart').value = data.semester_start;
            document.getElementById('totalWeeks').value = data.total_weeks || 20;
            
            // 计算学期结束日期
            this.calculateSemesterEnd();
        }

        // 加载时间节次设置
        this.renderTimeSlots();
    }

    calculateSemesterEnd() {
        const semesterStart = document.getElementById('semesterStart').value;
        const totalWeeks = parseInt(document.getElementById('totalWeeks').value) || 20;
        
        if (semesterStart) {
            const startDate = new Date(semesterStart);
            
            // 验证是否为周一（1表示周一，0表示周日）
            const dayOfWeek = startDate.getDay();
            const isMonday = dayOfWeek === 1;
            
            // 更新提示信息
            const hintElement = document.querySelector('.form-hint');
            if (hintElement) {
                if (isMonday) {
                    hintElement.style.color = '#10b981';
                    hintElement.innerHTML = ' 学期开始日期为周一，设置正确';
                } else {
                    hintElement.style.color = '#ef4444';
                    hintElement.innerHTML = ' 提示：学期开始日期应为第一周的周一（当前选择的是' + this.getChineseDayName(dayOfWeek) + '）';
                }
            }
            
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (totalWeeks * 7) - 1); // 减去1天，因为从开始日期算起
            
            const year = endDate.getFullYear();
            const month = String(endDate.getMonth() + 1).padStart(2, '0');
            const day = String(endDate.getDate()).padStart(2, '0');
            
            document.getElementById('semesterEnd').value = `${year}-${month}-${day}`;
        }
    }

    getChineseDayName(dayOfWeek) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[dayOfWeek];
    }

    async saveSemesterSettings() {
        const semesterStart = document.getElementById('semesterStart').value;
        const totalWeeks = parseInt(document.getElementById('totalWeeks').value) || 20;

        if (!semesterStart || !totalWeeks) {
            alert('请填写学期开始日期和总周数');
            return;
        }

        // 验证是否为周一
        const startDate = new Date(semesterStart);
        const dayOfWeek = startDate.getDay();
        const isMonday = dayOfWeek === 1;
        
        if (!isMonday) {
            const confirmSave = confirm('您选择的学期开始日期是' + this.getChineseDayName(dayOfWeek) + '，不是周一。\n\n建议选择周一作为学期开始日期，以确保周次计算准确。\n\n是否继续保存？');
            if (!confirmSave) {
                return;
            }
        }

        // 自动计算学期结束日期
        this.calculateSemesterEnd();
        const semesterEnd = document.getElementById('semesterEnd').value;

        try {
            const { error } = await supabaseClient
                .from('semester_settings')
                .upsert({
                    user_id: this.user.id,
                    semester_start: semesterStart,
                    semester_end: semesterEnd,
                    total_weeks: totalWeeks
                });

            if (error) throw error;

            // 更新学期设置
            this.semesterStart = new Date(semesterStart);
            this.totalWeeks = totalWeeks;
            
            // 仅重新计算当前显示的周次在学期内的对应周次（不影响当前显示的日期）
            if (this.currentMonday) {
                this.currentWeek = this.calculateWeekForDate(this.currentMonday);
            } else {
                this.currentWeek = this.calculateWeekForDate(this.getCurrentMonday());
            }
            
            // 重新加载所有数据并刷新显示
            await this.loadAllData();
            this.renderWeekView();
            this.renderCourseList();
            this.renderTodoList();
            this.updateWeekDisplay();
            
            alert('学期设置保存成功');
        } catch (error) {
            console.error('保存学期设置失败：', error);
            alert('保存失败，请重试');
        }
    }

    renderTimeSlots() {
        const container = document.getElementById('timeSlotsContainer');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const slotElement = document.createElement('div');
            slotElement.className = 'time-slot-item';
            slotElement.innerHTML = `
                <div class="form-group">
                    <label>节次 ${index + 1}</label>
                    <div class="time-inputs">
                        <input type="time" class="time-start" value="${slot.start}" data-index="${index}">
                        <span>至</span>
                        <input type="time" class="time-end" value="${slot.end}" data-index="${index}">
                        <button type="button" class="btn-danger remove-slot" data-index="${index}">删除</button>
                    </div>
                </div>
            `;
            container.appendChild(slotElement);
        });

        // 绑定删除事件
        container.querySelectorAll('.remove-slot').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeTimeSlot(index);
            });
        });
    }

    addTimeSlot() {
        this.timeSlots.push({ start: '08:00', end: '08:45' });
        this.renderTimeSlots();
    }

    removeTimeSlot(index) {
        if (this.timeSlots.length > 1) {
            this.timeSlots.splice(index, 1);
            this.renderTimeSlots();
        } else {
            alert('至少需要保留一个时间节次');
        }
    }

    async saveTimeSlots() {
        // 更新所有时间节次的值
        const startInputs = document.querySelectorAll('.time-start');
        const endInputs = document.querySelectorAll('.time-end');

        this.timeSlots = this.timeSlots.map((_, index) => ({
            start: startInputs[index].value,
            end: endInputs[index].value
        }));

        try {
            const { error } = await supabaseClient
                .from('user_preferences')
                .upsert({
                    user_id: this.user.id,
                    time_slots: this.timeSlots
                });

            if (error) throw error;

            // 刷新日程显示
            this.renderWeekSchedule();
            
            alert('时间设置保存成功');
        } catch (error) {
            console.error('保存时间设置失败：', error);
            alert('保存失败，请重试');
        }
    }
}

const app = new ScheduleManager();

// 初始化AI对话功能
document.addEventListener('DOMContentLoaded', () => {
    // 等待app初始化完成后再初始化AI对话
    setTimeout(() => {
        if (app.initAIChat) {
            app.initAIChat();
        }
        if (app.initSettings) {
            app.initSettings();
        }
    }, 1000);
});
