document.addEventListener('DOMContentLoaded', () => {
    // --- ダッシュボード全体の管理オブジェクト ---
    const Dashboard = {
        state: { weather: null, calendar: null, localEvents: [] },
        // 利用可能な全ウィジェットの定義
        widgets: {
            'weather': { name: '天気', default: true, init: fetchWeather },
            'news': { name: 'ニュース', default: true, init: fetchNews },
            'traffic': { name: '交通情報', default: false, init: fetchTrainInfo },
            'calendar': { name: 'カレンダー', default: false, init: fetchCalendarEvents },
            'notification': { name: '通知', default: false, init: loadNotificationContent },
            'reminder': { name: 'リマインダー', default: false, init: setupTaskInput },
            'music': { name: '音楽', default: false, init: () => {} },
            'photo': { name: 'フォトフレーム', default: false, init: setupPhotoWidget },
            'media': { name: 'メディアプレイヤー', default: false, init: setupMediaPlayerWidget },
        },
        init() {
            // 基本機能の初期化
            this.updateClock();
            setInterval(() => this.updateClock(), 1000);
            this.setupThemeSwitcher();
            this.setupEventListeners();
            
            // ウィジェットの表示状態を読み込んで適用
            this.loadWidgetVisibility();
            this.renderWidgets();

            // 定期的なデータ更新
            setInterval(() => this.refreshData(), 1000 * 60 * 15);
        },
        refreshData() {
            const visibility = this.getWidgetVisibility();
            Object.keys(this.widgets).forEach(id => {
                if (visibility[id]) {
                    try { this.widgets[id].init(); } catch(e) { console.error(`Failed to refresh widget: ${id}`, e); }
                }
            });
        },
        updateClock() {
            const now = new Date();
            document.getElementById('clock').textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('current-date').textContent = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        },
        setupThemeSwitcher() {
            const btn = document.getElementById('theme-toggle-btn');
            if (!btn) return;
            const applyTheme = theme => {
                document.body.dataset.theme = theme;
                btn.innerHTML = theme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
            };
            btn.addEventListener('click', () => {
                const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
                localStorage.setItem('dashboardTheme', newTheme);
                applyTheme(newTheme);
            });
            applyTheme(localStorage.getItem('dashboardTheme') || 'dark');
        },
        setupEventListeners() {
            // API設定モーダル
            const settingsModal = document.getElementById('settings-modal');
            document.getElementById('settings-btn')?.addEventListener('click', () => settingsModal.classList.add('visible'));
            document.getElementById('close-settings-btn')?.addEventListener('click', () => settingsModal.classList.remove('visible'));
            document.getElementById('save-settings-btn')?.addEventListener('click', () => {
                localStorage.setItem('googleApiKey', document.getElementById('google-api-key').value);
                localStorage.setItem('googleCalendarId', document.getElementById('google-calendar-id').value);
                settingsModal.classList.remove('visible');
                this.refreshData();
            });
            // ウィジェット設定モーダル
            const tabSettingsModal = document.getElementById('tab-settings-modal');
            document.getElementById('add-tab-btn')?.addEventListener('click', () => tabSettingsModal.classList.add('visible'));
            document.getElementById('close-tab-settings-btn')?.addEventListener('click', () => tabSettingsModal.classList.remove('visible'));
            // 通知タブ
            setupNotificationTabs();
        },
        getWidgetVisibility() {
            return JSON.parse(localStorage.getItem('widgetVisibility')) || {};
        },
        loadWidgetVisibility() {
            let visibility = this.getWidgetVisibility();
            let updated = false;
            Object.keys(this.widgets).forEach(id => {
                if (visibility[id] === undefined) {
                    visibility[id] = this.widgets[id].default;
                    updated = true;
                }
            });
            if (updated) localStorage.setItem('widgetVisibility', JSON.stringify(visibility));
            this.populateWidgetToggleList();
        },
        populateWidgetToggleList() {
            const listEl = document.getElementById('widget-toggle-list');
            const visibility = this.getWidgetVisibility();
            if(!listEl) return;
            listEl.innerHTML = '';
            Object.keys(this.widgets).filter(id => !this.widgets[id].default).forEach(id => {
                const isVisible = visibility[id];
                const item = document.createElement('label');
                item.className = 'widget-toggle-label';
                item.innerHTML = `<input type="checkbox" data-widget-id="${id}" ${isVisible ? 'checked' : ''}> ${this.widgets[id].name}`;
                listEl.appendChild(item);
                item.querySelector('input').addEventListener('change', (e) => {
                    const currentVisibility = this.getWidgetVisibility();
                    currentVisibility[id] = e.target.checked;
                    localStorage.setItem('widgetVisibility', JSON.stringify(currentVisibility));
                    this.renderWidgets();
                });
            });
        },
        renderWidgets() {
            const visibility = this.getWidgetVisibility();
            const initPromises = [];

            Object.keys(visibility).forEach(id => {
                const widgetEl = document.getElementById(`${id}-widget`);
                if (widgetEl) {
                    const shouldBeVisible = visibility[id];
                    if (shouldBeVisible) {
                        widgetEl.classList.remove('hidden');
                        // init関数をPromiseとして扱う
                        initPromises.push(Promise.resolve(this.widgets[id].init()));
                    } else {
                        widgetEl.classList.add('hidden');
                    }
                }
            });
            // すべてのウィジェットが初期化された後に挨拶を更新
            Promise.all(initPromises).then(() => updateDynamicGreeting());
        }
    };
    
    // グローバルアクセス用にDashboardオブジェクトをwindowに割り当て
    window.Dashboard = Dashboard;
    Dashboard.init();
});

// --- 動的メッセージ ---
function updateDynamicGreeting() {
    const greetingEl = document.getElementById('dynamic-greeting');
    if (!greetingEl) return;
    let messages = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // 天気
    if (Dashboard.state.weather && Dashboard.state.weather.description.match(/rain|drizzle|showers|雨/i)) {
        messages.push('<i class="fas fa-cloud-showers-heavy text-blue-400 mr-2"></i>今日は雨の予報です。傘を忘れずに。');
    }

    // 今日のイベント
    const todaysEvents = [];
    if (Dashboard.state.calendar) {
        Dashboard.state.calendar.forEach(event => {
            const eventDate = new Date(event.start.dateTime || event.start.date);
            if (new Date(eventDate.toDateString()).getTime() === new Date(today.toDateString()).getTime()) {
                todaysEvents.push(event.summary);
            }
        });
    }
    if (Dashboard.state.localEvents) {
        todaysEvents.push(...Dashboard.state.localEvents.map(e => e.text));
    }
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.forEach(task => { if (!task.completed) todaysEvents.push(task.text); });
    
    if (todaysEvents.length > 0) {
        messages.push(`<i class="fas fa-star text-yellow-400 mr-2"></i>今日は「${todaysEvents[0]}」の予定があります！`);
    }
    
    if (messages.length === 0) {
        const hour = new Date().getHours();
        if (hour < 5 || hour >= 18) messages.push('こんばんは');
        else if (hour < 12) messages.push('おはようございます');
        else messages.push('こんにちは');
    }
    greetingEl.innerHTML = messages.join('<br>');
}


// --- 各ウィジェットのロジック ---
function fetchWeather() {
    return new Promise((resolve) => {
        const weatherInfoEl = document.getElementById('weather-info');
        if (!weatherInfoEl) return resolve();
        const getWeather = (location) => {
            fetch(`https://wttr.in/${location}?format=j1`)
                .then(res => res.ok ? res.json() : Promise.reject('Weather fetch failed'))
                .then(data => {
                    const condition = data.current_condition[0];
                    const area = data.nearest_area[0];
                    Dashboard.state.weather = { description: condition.weatherDesc[0].value };
                    weatherInfoEl.innerHTML = `<p class="text-5xl font-bold">${condition.temp_C}°C</p><p class="text-lg">${condition.weatherDesc[0].value}</p><p class="text-gray-400 mt-2">${area.areaName[0].value}</p>`;
                    resolve();
                }).catch(err => {
                    console.error("Weather fetch failed:", err);
                    weatherInfoEl.innerHTML = `<p class="text-red-400">天気取得に失敗</p>`;
                    resolve();
                });
        };
        navigator.geolocation.getCurrentPosition(
            pos => getWeather(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => getWeather('Sakata'),
            { timeout: 10000 }
        );
    });
}

function fetchNews() {
    const newsWidget = document.getElementById('news-content');
    if (!newsWidget) return;
    const rssUrl = 'https://www.nhk.or.jp/rss/news/cat0.xml';
    const converterUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    fetch(converterUrl)
        .then(res => res.ok ? res.json() : Promise.reject('News fetch failed'))
        .then(data => {
            if (data.items && data.items.length > 0) {
                 newsWidget.innerHTML = data.items.slice(0, 10).map(article => `<a href="${article.link}" target="_blank" rel="noopener noreferrer" class="block p-2 bg-item-bg rounded-md hover:bg-item-bg-hover"><p class="font-semibold text-sm">${article.title}</p></a>`).join('<div class="my-1"></div>');
            } else {
                 throw new Error("No news items found");
            }
        }).catch(err => {
            console.error(err);
            newsWidget.innerHTML = `<p class="text-red-400">ニュース取得に失敗</p>`;
        });
}

function fetchTrainInfo() {
    const trafficInfoEl = document.getElementById('traffic-info');
    if (!trafficInfoEl) return;
    const rssUrl = 'https://traininfo.jreast.co.jp/train_info/rss/tohoku.xml';
    const converterUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    fetch(converterUrl)
        .then(res => res.ok ? res.json() : Promise.reject('Traffic fetch failed'))
        .then(data => {
            const delayInfo = data.items.filter(item => !item.title.includes('平常運転'));
            if (delayInfo.length > 0) {
                trafficInfoEl.innerHTML = delayInfo.map(item => `<div class="p-3 bg-item-bg rounded-md"><h3 class="font-semibold text-yellow-400">${item.title}</h3><p class="text-sm mt-1">${item.description}</p></div>`).join('');
            } else {
                trafficInfoEl.innerHTML = `<div class="p-3 bg-item-bg rounded-md text-center"><p class="text-green-400 font-semibold">東北エリアの路線は平常通り運転しています。</p></div>`;
            }
        }).catch(err => {
            console.error(err);
            trafficInfoEl.innerHTML = `<div class="p-3 bg-item-bg rounded-md text-center"><p class="text-red-400">運行情報の取得に失敗しました。</p><a href="https://traininfo.jreast.co.jp/train_info/tohoku.aspx" target="_blank" class="text-blue-400 hover:underline mt-2 inline-block">公式サイトで確認</a></div>`;
        });
}

function fetchCalendarEvents() {
    return new Promise((resolve) => {
        const apiKey = localStorage.getItem('googleApiKey');
        const calendarId = localStorage.getItem('googleCalendarId');
        if (apiKey && calendarId) {
            document.getElementById('local-event-adder').classList.add('hidden');
            const timeMin = new Date().toISOString();
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&maxResults=7&singleEvents=true&orderBy=startTime`;
            fetch(url)
                .then(res => res.ok ? res.json() : Promise.reject('Calendar API Error'))
                .then(data => {
                    Dashboard.state.calendar = data.items;
                    const widget = document.getElementById('calendar-content');
                    if (data.items && data.items.length > 0) {
                        widget.innerHTML = '<div class="space-y-3">' + data.items.map(event => {
                            const start = new Date(event.start.dateTime || event.start.date);
                            const isAllDay = !event.start.dateTime;
                            const date = `${start.getMonth() + 1}/${start.getDate()}(${['日','月','火','水','木','金','土'][start.getDay()]})`;
                            const time = isAllDay ? '終日' : start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                            return `<div class="flex items-center p-2 bg-item-bg rounded-md"><div class="text-center w-20 mr-4"><p class="font-bold text-lg">${date}</p><p class="text-sm">${time}</p></div><p class="flex-grow font-medium">${event.summary}</p></div>`;
                        }).join('') + '</div>';
                    } else {
                        widget.innerHTML = `<p class="p-4">Google Calendarに今後の予定はありません。</p>`;
                    }
                    resolve();
                }).catch(err => {
                    console.error(err);
                    renderLocalCalendar('Google Calendar同期失敗');
                    resolve();
                });
        } else {
            renderLocalCalendar();
            resolve();
        }
    });
}

function renderLocalCalendar(message = '') {
    const widget = document.getElementById('calendar-content');
    document.getElementById('local-event-adder').classList.remove('hidden');
    let events = getLocalEvents();
    Dashboard.state.localEvents = events;
    Dashboard.state.calendar = []; 
    let html = message ? `<p class="text-yellow-400 text-sm mb-2">${message}</p>` : '';
    if (events.length === 0) {
        html += `<p class="text-center py-4">今日の予定はありません</p>`;
    } else {
        html += events.map(event => `<div class="event-item" data-id="${event.id}"><span class="flex-grow">${event.text}</span><button class="delete-btn ml-4"><i class="fas fa-trash-alt"></i></button></div>`).join('');
    }
    widget.innerHTML = html;
    widget.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => {
        const id = e.currentTarget.closest('.event-item').dataset.id;
        saveLocalEvents(getLocalEvents().filter(ev => ev.id != id));
        renderLocalCalendar();
    }));
}

function getLocalEvents() {
    const today = new Date().toLocaleDateString('ja-JP');
    const data = JSON.parse(localStorage.getItem('localEvents')) || {};
    return data[today] || [];
}
function saveLocalEvents(events) {
    const today = new Date().toLocaleDateString('ja-JP');
    localStorage.setItem('localEvents', JSON.stringify({ [today]: events }));
}
function setupLocalCalendarInput() {
    const eventInput = document.getElementById('event-input');
    const addEventBtn = document.getElementById('add-event-btn');
    if (!eventInput || !addEventBtn) return;
    const addEvent = () => {
        const text = eventInput.value.trim();
        if (text) {
            const events = getLocalEvents();
            events.push({ text: text, id: Date.now() });
            saveLocalEvents(events);
            renderLocalCalendar();
            eventInput.value = '';
        }
    };
    addEventBtn.addEventListener('click', addEvent);
    eventInput.addEventListener('keypress', e => { if (e.key === 'Enter') addEvent(); });
}
function setupNotificationTabs() {
    const tabs = document.querySelectorAll('.notification-tab');
    const contents = document.querySelectorAll('.notification-content');
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-content').classList.add('active');
    }));
}
function loadNotificationContent() {
    document.getElementById('gmail-content').innerHTML = `<a href="https://mail.google.com/mail/u/0/#inbox?q=is:unread" target="_blank" rel="noopener noreferrer" class="block p-4 bg-item-bg rounded-md hover:bg-item-bg-hover text-center"><p class="font-semibold text-lg"><i class="fas fa-envelope mr-2"></i>未読メールを確認</p><p class="text-xs mt-1">Gmailサイトで未読メールを直接開きます。</p></a>`;
    document.getElementById('line-content').innerHTML = `<p class="p-4 text-center">LINE連携は現在サポートされていません。</p>`;
    document.getElementById('discord-content').innerHTML = `<p class="p-4 text-center">Discord連携は現在サポートされていません。</p>`;
}
function setupTaskInput() {
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    if (!taskInput || !addTaskBtn) return;
    const addTask = () => {
        const text = taskInput.value.trim();
        if (text) { createTaskElement(text); saveTasks(); taskInput.value = ''; }
    };
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });
    loadTasks();
}
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    taskList.innerHTML = '';
    tasks.forEach(task => createTaskElement(task.text, task.completed));
}
function saveTasks() {
    const tasks = [];
    document.querySelectorAll('#task-list .task-item').forEach(item => {
        tasks.push({ text: item.querySelector('span').textContent, completed: item.classList.contains('completed') });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
}
function createTaskElement(text, completed = false) {
    const taskList = document.getElementById('task-list');
    const item = document.createElement('div');
    item.className = 'task-item';
    if (completed) item.classList.add('completed');
    item.innerHTML = `<input type="checkbox" ${completed ? 'checked' : ''}><span class="flex-grow">${text}</span><button class="delete-btn ml-4"><i class="fas fa-trash-alt"></i></button>`;
    item.querySelector('input').addEventListener('change', () => { item.classList.toggle('completed'); saveTasks(); });
    item.querySelector('button').addEventListener('click', () => { item.remove(); saveTasks(); });
    taskList.appendChild(item);
}
function setupPhotoWidget() {
    const input = document.getElementById('photo-input');
    const content = document.getElementById('photo-content');
    if (!input || !content) return;
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            content.innerHTML = `<img src="${url}" class="max-w-full max-h-full object-contain cursor-pointer" title="クリックして変更">`;
            content.querySelector('img').addEventListener('click', () => input.click());
        }
    });
}
function setupMediaPlayerWidget() {
    const input = document.getElementById('media-input');
    const container = document.getElementById('media-player-container');
    if (!input || !container) return;
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('video/')) {
                container.innerHTML = `<video src="${url}" controls class="max-w-full max-h-[200px]"></video>`;
            } else if (file.type.startsWith('audio/')) {
                container.innerHTML = `<audio src="${url}" controls></audio>`;
            }
        }
    });
}