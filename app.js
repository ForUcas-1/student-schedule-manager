const SUPABASE_URL = 'https://lmvmctknyfmnukfsqbig.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtdm1jdGtueWZtbnVrZnNxYmlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODYzNDEsImV4cCI6MjA4ODI2MjM0MX0.7i30kmg5k6GV3PE4GLuGWOR_YlV5SC6NnyhCmw5ZpiM';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        this.isSignUp = false;
        this.timeSlots = [...DEFAULT_TIME_SLOTS];
        
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
        this.currentWeek = this.getCurrentWeek();
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
            .select('semester_start')
            .eq('user_id', this.user.id)
            .single();

        if (data) {
            this.semesterStart = new Date(data.semester_start);
        } else {
            const now = new Date();
            this.semesterStart = new Date(now.getFullYear(), now.getMonth(), 1);
            await supabaseClient
                .from('semester_settings')
                .insert({
                    user_id: this.user.id,
                    semester_start: this.semesterStart.toISOString().split('T')[0]
                });
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
            .order('time', { ascending: true });

        if (data) {
            this.courses = data.map(c => ({
                id: c.id,
                name: c.name,
                day: c.day,
                time: c.time,
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
                    newTime: m.new_time,
                    newLocation: m.new_location
                };
            });
        }
    }

    getCurrentWeek() {
        if (!this.semesterStart) return 1;
        const now = new Date();
        const diff = now - this.semesterStart;
        const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
        return Math.max(1, week);
    }

    getWeekDates(weekNum) {
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

    getTimeSlot(time) {
        if (!time || time < 1 || time > this.timeSlots.length) return '';
        const slot = this.timeSlots[time - 1];
        return `第${time}节 (${slot.start}-${slot.end})`;
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            if (this.currentWeek > 1) {
                this.currentWeek--;
                this.updateWeekDisplay();
                this.renderWeekView();
            }
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            if (this.currentWeek < 25) {
                this.currentWeek++;
                this.updateWeekDisplay();
                this.renderWeekView();
            }
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
    }

    updateWeekDisplay() {
        document.getElementById('currentWeek').textContent = `第 ${this.currentWeek} 周`;
    }

    renderWeekView() {
        const weekDates = this.getWeekDates(this.currentWeek);
        
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
        const weekDates = this.getWeekDates(this.currentWeek);
        
        for (let day = 1; day <= 7; day++) {
            const column = document.querySelector(`.day-column[data-day="${day}"]`);
            const slots = column.querySelectorAll('.slot');
            
            slots.forEach((slot, timeIndex) => {
                const time = timeIndex + 1;
                const items = this.getItemsForSlot(day, time, weekDates[day - 1]);
                
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = `schedule-item ${item.type}`;
                    if (item.hasConflict) div.classList.add('conflict');
                    
                    div.innerHTML = `
                        <div class="item-name">${item.name}</div>
                        ${item.location ? `<div class="item-location">${item.location}</div>` : ''}
                        ${item.badge ? `<span class="item-badge">${item.badge}</span>` : ''}
                    `;
                    
                    div.addEventListener('click', () => this.showItemDetail(item));
                    slot.appendChild(div);
                });
            });
        }
    }

    getItemsForSlot(day, time, date) {
        const items = [];
        const dateStr = this.formatDate(date);
        
        this.courses.forEach(course => {
            if (course.day === day && course.time === time) {
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
                            originalCourse: course
                        });
                    }
                }
            }
        });
        
        Object.keys(this.modifications).forEach(key => {
            const mod = this.modifications[key];
            if (mod.week === this.currentWeek && mod.newDay === day && mod.newTime === time) {
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
                            modification: mod
                        });
                    }
                }
            }
        });
        
        this.todos.forEach(todo => {
            if (todo.date === dateStr) {
                if (this.todoOverlapsSlot(todo, time)) {
                    items.push({
                        type: 'todo-item',
                        id: todo.id,
                        name: todo.name,
                        location: todo.location,
                        todo: todo
                    });
                }
            }
        });
        
        items.forEach(item => {
            item.hasConflict = items.length > 1;
        });
        
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

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, mins] = timeStr.split(':').map(Number);
        return hours * 60 + mins;
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
                        <span>? ${this.getDayName(course.day)}</span>
                        <span>? ${this.getTimeSlot(course.time)}</span>
                        <span>? ${course.location || '未设置'}</span>
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
                        ${todo.alarm ? '<span class="alarm-badge">? 已设闹钟</span>' : ''}
                    </div>
                    <div class="todo-details">
                        <span>? ${todo.date}</span>
                        ${todo.startTime && todo.endTime ? `<span>? ${todo.startTime}-${todo.endTime}</span>` : ''}
                        ${todo.location ? `<span>? ${todo.location}</span>` : ''}
                    </div>
                    ${todo.note ? `<div style="margin-top: 8px; color: #64748b; font-size: 14px;">? ${todo.note}</div>` : ''}
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
        const timeSelects = ['courseTime', 'modifyTime', 'todoTime'];
        
        timeSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            const isTodoSelect = selectId === 'todoTime';
            
            select.innerHTML = isTodoSelect ? '<option value="">全天</option>' : '';
            
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
                document.getElementById('courseTime').value = course.time;
                document.getElementById('courseLocation').value = course.location || '';
                document.getElementById('courseWeeks').value = course.weeks || '';
            }
        } else {
            title.textContent = '添加课程';
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
            时间: ${this.getDayName(course.day)} ${this.getTimeSlot(course.time)}<br>
            地点: ${course.location || '未设置'}
        `;
        
        this.updateTimeSelects();
        
        const modKey = `${courseId}_${this.currentWeek}`;
        const existingMod = this.modifications[modKey];
        
        if (existingMod) {
            document.getElementById('modifyDay').value = existingMod.newDay || '';
            document.getElementById('modifyTime').value = existingMod.newTime || '';
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
        const time = parseInt(document.getElementById('courseTime').value);
        const location = document.getElementById('courseLocation').value.trim();
        const weeks = document.getElementById('courseWeeks').value.trim();
        
        const courseData = { 
            user_id: this.user.id,
            name, 
            day, 
            time, 
            location, 
            weeks 
        };

        let error;
        if (id) {
            const result = await supabaseClient
                .from('courses')
                .update({ name, day, time, location, weeks })
                .eq('id', id);
            error = result.error;
            
            if (!error) {
                const index = this.courses.findIndex(c => c.id === id);
                if (index >= 0) {
                    this.courses[index] = { id, name, day, time, location, weeks };
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
                    name, day, time, location, weeks
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
        const newTime = document.getElementById('modifyTime').value;
        const newLocation = document.getElementById('modifyLocation').value.trim();
        
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;
        
        const modKey = `${courseId}_${week}`;
        
        if (!newDay && !newTime && !newLocation) {
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
                new_time: newTime ? parseInt(newTime) : course.time,
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
                newTime: modData.new_time,
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
                    <strong>时间:</strong> ${this.getDayName(item.originalCourse.day)} ${this.getTimeSlot(item.originalCourse.time)}<br>
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
                    <strong>原时间:</strong> ${this.getDayName(item.originalCourse.day)} ${this.getTimeSlot(item.originalCourse.time)}<br>
                    <strong>新时间:</strong> ${this.getDayName(item.modification.newDay)} ${this.getTimeSlot(item.modification.newTime)}<br>
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
            html = `<div class="conflict-warning">?? 该时间段存在冲突</div>` + html;
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
}

const app = new ScheduleManager();
