// ==================== DOM ELEMENTS ====================
const uploadTab = document.getElementById('tab-upload');
const recordTab = document.getElementById('tab-record');
const meetingsTab = document.getElementById('tab-meetings');
const uploadView = document.getElementById('upload-view');
const recordView = document.getElementById('record-view');
const meetingsView = document.getElementById('meetings-view');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFileBtn = document.getElementById('remove-file');
const audioPreview = document.getElementById('audio-preview');
const transcriptionOptions = document.getElementById('transcription-options');
const startTranscriptionBtn = document.getElementById('start-transcription');
const transcriptionProgress = document.getElementById('transcription-progress');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const transcriptionResult = document.getElementById('transcription-result');
const fullTranscript = document.getElementById('full-transcript');
const segmentsContainer = document.getElementById('segments-container');
const detectedLanguage = document.getElementById('detected-language');
const languageProbability = document.getElementById('language-probability');
const processingTime = document.getElementById('processing-time');
const audioDuration = document.getElementById('audio-duration');
const modelInfo = document.getElementById('model-info');
const downloadTxtBtn = document.getElementById('download-txt');
const downloadSrtBtn = document.getElementById('download-srt');
const downloadJsonBtn = document.getElementById('download-json');
const summarizeBtn = document.getElementById('summarize-btn');

// Result Tab Elements
const tabTranscript = document.getElementById('tab-transcript');
const tabSegments = document.getElementById('tab-segments');
const tabSummary = document.getElementById('tab-summary');
const tabInfo = document.getElementById('tab-info');
const contentTranscript = document.getElementById('content-transcript');
const contentSegments = document.getElementById('content-segments');
const contentSummary = document.getElementById('content-summary');
const contentInfo = document.getElementById('content-info');
const summaryContent = document.getElementById('summary-content');

// Recording Elements
const startRecordBtn = document.getElementById('start-record-btn');
const stopRecordBtn = document.getElementById('stop-record-btn');
const recordingTimeEl = document.getElementById('recording-time');
const micStatusEl = document.getElementById('mic-status');
const recordingIndicator = document.querySelector('.recording-indicator');
const recordingMessageEl = document.getElementById('recording-message');

// Meeting Elements
const meetingForm = document.getElementById('meeting-form');
const meetingTitle = document.getElementById('meeting-title');
const meetingDesc = document.getElementById('meeting-desc');
const meetingStart = document.getElementById('meeting-start');
const meetingEnd = document.getElementById('meeting-end');
const meetingLocationType = document.getElementById('meeting-location-type');
const meetingLocation = document.getElementById('meeting-location');
const meetingOrganizer = document.getElementById('meeting-organizer');
const addParticipantBtn = document.getElementById('add-participant');
const calendarEl = document.getElementById('calendar');
const meetingsList = document.getElementById('meetings-list');
const statsTotal = document.getElementById('stats-total');
const statsUpcoming = document.getElementById('stats-upcoming');

// ==================== GLOBAL VARIABLES ====================
let selectedFile = null;
let currentTaskId = null;
let pollingInterval = null;
let transcriptionData = null;
let recorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = 0;
let mediaStream = null;

// Meeting variables
let calendar = null;
let currentParticipants = [];
let meetingRecordingInProgress = false;
let meetingRecorder = null;
let meetingAudioChunks = [];
let meetingRefreshInterval = null;
let activeMeetingId = null;

// API Base URL
const API_BASE_URL = window.location.origin;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Whisper Pro App Initializing...');
    
    // File Upload Events
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    removeFileBtn.addEventListener('click', resetFileUpload);
    
    // Transcription Events
    startTranscriptionBtn.addEventListener('click', startTranscription);
    
    // Download Events
    downloadTxtBtn.addEventListener('click', () => downloadTranscript('txt'));
    downloadSrtBtn.addEventListener('click', () => downloadTranscript('srt'));
    downloadJsonBtn.addEventListener('click', () => downloadTranscript('json'));
    summarizeBtn.addEventListener('click', generateSummary);
    
    // Recording Events
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    
    // Tab switching
    uploadTab.addEventListener('click', () => switchInputTab('upload'));
    recordTab.addEventListener('click', () => switchInputTab('record'));
    meetingsTab.addEventListener('click', () => switchInputTab('meetings'));
    
    // Result Tab switching
    tabTranscript.addEventListener('click', () => switchResultTab('transcript'));
    tabSegments.addEventListener('click', () => switchResultTab('segments'));
    tabSummary.addEventListener('click', () => switchResultTab('summary'));
    tabInfo.addEventListener('click', () => switchResultTab('info'));
    
    // Meeting Events
    meetingForm.addEventListener('submit', createMeeting);
    addParticipantBtn.addEventListener('click', addParticipant);
    meetingLocationType.addEventListener('change', updateLocationPlaceholder);
    
    // Initialize
    switchInputTab('upload');
    switchResultTab('transcript');
    initializeToggleSwitches();
    setDefaultMeetingTimes();
    updateLocationPlaceholder();
    checkServerStatus();
    
    // Auto-refresh meetings if we're already on meetings tab
    if (!meetingsView.classList.contains('hidden')) {
        startAutoRefreshMeetings();
    }
    
    console.log('✅ App Initialized Successfully');
});

// ==================== TAB MANAGEMENT ====================
function switchInputTab(tab) {
    console.log(`🔘 Switching to tab: ${tab}`);
    
    // Stop auto-refresh if leaving meetings tab
    if (tab !== 'meetings') {
        stopAutoRefreshMeetings();
    }
    
    // Update tab UI
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        button.classList.remove('border-b-2', 'border-indigo-500');
    });
    
    // Hide all views
    uploadView.classList.add('hidden');
    recordView.classList.add('hidden');
    meetingsView.classList.add('hidden');
    
    // Show selected view
    switch(tab) {
        case 'upload':
            uploadTab.classList.add('active');
            uploadTab.classList.add('border-b-2', 'border-indigo-500');
            uploadView.classList.remove('hidden');
            console.log('📁 Upload tab active');
            break;
        case 'record':
            recordTab.classList.add('active');
            recordTab.classList.add('border-b-2', 'border-indigo-500');
            recordView.classList.remove('hidden');
            checkMicrophoneAccess();
            console.log('🎤 Record tab active');
            break;
        case 'meetings':
            meetingsTab.classList.add('active');
            meetingsTab.classList.add('border-b-2', 'border-indigo-500');
            meetingsView.classList.remove('hidden');
            initCalendar();
            loadMeetingsList();
            startAutoRefreshMeetings();
            console.log('📅 Meetings tab active');
            break;
    }
    
    // Cleanup if leaving record tab
    if (tab !== 'record' && mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
        console.log('🎤 Microphone stream released');
    }
}

function switchResultTab(tab) {
    console.log(`📊 Switching result tab to: ${tab}`);
    
    // Update tab UI
    document.querySelectorAll('[data-result-tab]').forEach(button => {
        button.classList.remove('active');
        button.classList.remove('border-b-2', 'border-indigo-500');
    });
    
    // Hide all content
    contentTranscript.classList.add('hidden');
    contentSegments.classList.add('hidden');
    contentSummary.classList.add('hidden');
    contentInfo.classList.add('hidden');
    
    // Show selected content
    switch(tab) {
        case 'transcript':
            tabTranscript.classList.add('active');
            tabTranscript.classList.add('border-b-2', 'border-indigo-500');
            contentTranscript.classList.remove('hidden');
            break;
        case 'segments':
            tabSegments.classList.add('active');
            tabSegments.classList.add('border-b-2', 'border-indigo-500');
            contentSegments.classList.remove('hidden');
            break;
        case 'summary':
            tabSummary.classList.add('active');
            tabSummary.classList.add('border-b-2', 'border-indigo-500');
            contentSummary.classList.remove('hidden');
            break;
        case 'info':
            tabInfo.classList.add('active');
            tabInfo.classList.add('border-b-2', 'border-indigo-500');
            contentInfo.classList.remove('hidden');
            break;
    }
}

// ==================== MEETING MANAGEMENT ====================
function initCalendar() {
    if (calendar) {
        calendar.destroy();
        calendar = null;
    }
    
    console.log('📅 Initializing calendar...');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [],
        eventClick: function(info) {
            console.log('📌 Calendar event clicked:', info.event.id);
            showMeetingDetail(info.event.id);
        },
        dateClick: function(info) {
            console.log('📌 Calendar date clicked:', info.dateStr);
            const startTime = new Date(info.date);
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(startTime);
            endTime.setHours(11, 0, 0, 0);
            
            meetingStart.value = startTime.toISOString().slice(0, 16);
            meetingEnd.value = endTime.toISOString().slice(0, 16);
            
            meetingTitle.focus();
            showAlert('✅ Đã điền thời gian tự động!', 'success');
        },
        height: 500,
        editable: false,
        selectable: true,
        eventDisplay: 'block',
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
        }
    });
    
    calendar.render();
    loadCalendarEvents();
}

async function loadCalendarEvents() {
    try {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
        
        const response = await fetch(
            `${API_BASE_URL}/api/meetings/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
        );
        
        if (response.ok) {
            const events = await response.json();
            
            // Clear existing events
            calendar.getEvents().forEach(event => event.remove());
            
            // Add new events
            events.forEach(event => {
                calendar.addEvent({
                    id: event.id,
                    title: event.title,
                    start: event.start,
                    end: event.end,
                    backgroundColor: event.color,
                    borderColor: event.color,
                    textColor: '#ffffff',
                    extendedProps: event.extendedProps
                });
            });
            
            console.log(`📅 Loaded ${events.length} calendar events`);
        }
    } catch (error) {
        console.error('❌ Error loading calendar events:', error);
    }
}

function setDefaultMeetingTimes() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(now.getHours() + 1, 0, 0, 0);
    
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    
    meetingStart.value = start.toISOString().slice(0, 16);
    meetingEnd.value = end.toISOString().slice(0, 16);
}

function updateLocationPlaceholder() {
    const isOnline = meetingLocationType.value === 'online';
    meetingLocation.placeholder = isOnline 
        ? 'https://meet.google.com/xxx-yyyy-zzz hoặc Zoom link...' 
        : 'Phòng A1, Tầng 5, Tòa nhà X...';
}

async function createMeeting(e) {
    e.preventDefault();
    
    console.log('📝 Creating meeting...');
    
    const meetingData = {
        title: meetingTitle.value.trim(),
        description: meetingDesc.value.trim(),
        start_time: meetingStart.value + ':00',
        end_time: meetingEnd.value + ':00',
        location_type: meetingLocationType.value,
        location: meetingLocation.value.trim(),
        organizer: meetingOrganizer.value.trim(),
        participants: currentParticipants,
        status: 'scheduled'
    };
    
    // Validate required fields
    if (!meetingData.title || !meetingData.organizer || !meetingData.location) {
        showAlert('❌ Vui lòng điền đầy đủ thông tin bắt buộc', 'danger');
        return;
    }
    
    try {
        showAlert('⏳ Đang tạo cuộc họp...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/meetings`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(meetingData)
        });
        
        if (response.ok) {
            const meeting = await response.json();
            showAlert(`✅ Đã tạo cuộc họp "${meeting.title}" thành công!`, 'success');
            
            // Reset form
            meetingForm.reset();
            currentParticipants = [];
            setDefaultMeetingTimes();
            updateLocationPlaceholder();
            
            // Refresh calendar and list
            await Promise.all([
                loadMeetingsList(),
                loadCalendarEvents()
            ]);
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Lỗi tạo cuộc họp');
        }
    } catch (error) {
        console.error('❌ Error creating meeting:', error);
        showAlert(`❌ Lỗi: ${error.message}`, 'danger');
    }
}

async function addParticipant() {
    const result = await showParticipantModal();
    
    if (result && result.name) {
        currentParticipants.push({
            name: result.name,
            email: result.email || null,
            role: result.role || null,
            department: result.department || null,
            is_required: true
        });
        
        showAlert(`👥 Đã thêm "${result.name}" vào danh sách tham dự`, 'success');
        console.log('👥 Participant added:', result);
    }
}

async function showParticipantModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-md w-full">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Thêm người tham dự</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
                        <input type="text" id="participant-name" 
                               class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                               placeholder="Nguyễn Văn A" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" id="participant-email" 
                               class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                               placeholder="example@company.com">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                            <input type="text" id="participant-role" 
                                   class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   placeholder="Project Manager">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                            <input type="text" id="participant-department" 
                                   class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   placeholder="IT Department">
                        </div>
                    </div>
                </div>
                
                <div class="flex space-x-3 justify-end mt-6">
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); resolve(null)"
                            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                        Hủy
                    </button>
                    <button onclick="submitParticipant(this)"
                            class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                        Thêm
                    </button>
                </div>
            </div>
        `;
        
        window.submitParticipant = function(button) {
            const name = document.getElementById('participant-name').value.trim();
            if (!name) {
                alert('Vui lòng nhập tên người tham dự');
                return;
            }
            
            const result = {
                name: name,
                email: document.getElementById('participant-email').value.trim() || null,
                role: document.getElementById('participant-role').value.trim() || null,
                department: document.getElementById('participant-department').value.trim() || null
            };
            
            modal.remove();
            resolve(result);
        };
        
        document.body.appendChild(modal);
        document.getElementById('participant-name').focus();
    });
}

async function loadMeetingsList() {
    console.log('📋 Loading meetings list...');
    
    try {
        // Show loading state
        meetingsList.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                <p class="text-gray-600">Đang tải danh sách cuộc họp...</p>
            </div>
        `;
        
        // Load recent meetings (load all statuses — remove status filter)
        const response = await fetch(`${API_BASE_URL}/api/meetings?limit=50`);
        
        if (response.ok) {
            let meetings = await response.json();

            // Diagnostic log for debugging if empty
            console.debug('Loaded meetings (primary):', meetings ? meetings.length : 0);

            // Fallback: if primary fetch returned none, try loading all meetings (include past/completed)
            if (!meetings || meetings.length === 0) {
                try {
                    const fallbackResp = await fetch(`${API_BASE_URL}/api/meetings?limit=100`);
                    if (fallbackResp.ok) {
                        meetings = await fallbackResp.json();
                        console.debug('Loaded meetings (fallback):', meetings ? meetings.length : 0);
                    }
                } catch (e) {
                    console.debug('Fallback fetch failed', e);
                }
            }

            displayMeetingsList(meetings || []);

            // Load stats
            const statsResponse = await fetch(`${API_BASE_URL}/api/meetings?limit=100`);
            if (statsResponse.ok) {
                const allMeetings = await statsResponse.json();
                statsTotal.textContent = allMeetings.length;
                
                const upcoming = allMeetings.filter(m => {
                    const meetingTime = new Date(m.start_time);
                    const now = new Date();
                    return meetingTime > now && m.status === 'scheduled';
                }).length;
                
                statsUpcoming.textContent = upcoming;
            }
            
            console.log(`📋 Loaded ${meetings.length} meetings`);
        } else {
            throw new Error('Không thể tải danh sách cuộc họp');
        }
    } catch (error) {
        console.error('❌ Lỗi tải danh sách cuộc họp:', error);
        meetingsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <div class="text-red-500 mb-2">
                    <svg class="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <p class="text-red-500 font-medium mb-4">❌ Lỗi tải danh sách: ${error.message}</p>
                <button onclick="loadMeetingsList()" 
                        class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition">
                    🔄 Thử lại
                </button>
            </div>
        `;
    }
}

function displayMeetingsList(meetings) {
    if (!meetings || meetings.length === 0) {
        meetingsList.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <div class="w-20 h-20 mx-auto mb-4 text-gray-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h4 class="text-lg font-medium text-gray-700 mb-2">Chưa có cuộc họp nào</h4>
                <p class="text-gray-500 mb-6">Tạo cuộc họp đầu tiên của bạn!</p>
                <button onclick="document.getElementById('meeting-title').focus()"
                        class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition">
                    <svg class="w-5 h-5 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                    </svg>
                    Tạo cuộc họp mới
                </button>
            </div>
        `;
        return;
    }
    
    meetingsList.innerHTML = meetings.map(meeting => {
        // Determine status
        const status = meeting.status;
        const hasAudio = !!(meeting.audio_file_path || meeting.audio_file_name);
        const hasTranscription = !!meeting.transcription_id;
        const isProcessing = status === 'in_progress';
        const canRecord = !hasAudio && (status === 'scheduled' || status === 'in_progress');
        
        // Calculate time status
        const startTime = new Date(meeting.start_time);
        const now = new Date();
        const timeDiff = startTime - now;
        const hoursUntilMeeting = Math.floor(timeDiff / (1000 * 60 * 60));
        
        // Create status badges
        let statusBadges = `
            <span class="status-badge ${getStatusClass(status)}">
                ${getStatusText(status)}
            </span>
        `;
        
        // Add audio status badge
        if (isProcessing) {
            statusBadges += `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                    <span class="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                    ⏳ Đang xử lý...
                </span>
            `;
        } else if (hasTranscription) {
            statusBadges += `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    ✅ Đã phiên âm
                </span>
            `;
        } else if (hasAudio) {
            statusBadges += `
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                    </svg>
                    🎤 Có ghi âm
                </span>
            `;
        }
        
        // Time indicator
        let timeIndicator = '';
        if (hoursUntilMeeting > 0 && hoursUntilMeeting <= 24) {
            timeIndicator = `
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                    ⏰ ${hoursUntilMeeting}h tới
                </span>
            `;
        } else if (hoursUntilMeeting <= 0 && hoursUntilMeeting >= -2) {
            timeIndicator = `
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                    🔥 Đang diễn ra
                </span>
            `;
        }
        
        // Create buttons based on meeting state
        const buttons = [];
        
        // Record button
        if (canRecord) {
            buttons.push(`
                <button onclick="startMeetingRecording('${meeting.id}', '${meeting.title}')" 
                        class="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
                        title="Bắt đầu ghi âm cuộc họp">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                    </svg>
                    Ghi âm
                </button>
            `);
        }
        
        // Play button
        if (hasAudio) {
            buttons.push(`
                <button onclick="playMeetingAudio('${meeting.id}')" 
                        class="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
                        title="Nghe lại bản ghi âm">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                    </svg>
                    Nghe lại
                </button>
            `);
        }
        
        // Transcription button
        if (hasTranscription) {
            buttons.push(`
                <button onclick="viewMeetingTranscription('${meeting.id}')" 
                        class="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
                        title="Xem bản phiên âm">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
                    </svg>
                    Phiên âm
                </button>
            `);
        }
        
        // Details button
        buttons.push(`
            <button onclick="showMeetingDetail('${meeting.id}')" 
                    class="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white text-sm font-medium rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
                    title="Xem chi tiết cuộc họp">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                Chi tiết
            </button>
        `);
        
        return `
        <div class="meetings-list-card glass-effect p-5 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all duration-200 hover:shadow-md mb-4">
            <div class="flex flex-col lg:flex-row lg:items-center gap-4">
                <!-- Meeting Info -->
                <div class="flex-1 min-w-0">
                    <!-- Status & Time Badges -->
                    <div class="flex flex-wrap items-center gap-2 mb-3">
                        ${statusBadges}
                        ${timeIndicator}
                    </div>
                    
                    <!-- Title -->
                    <h4 class="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                        ${meeting.title}
                    </h4>
                    
                    <!-- Meeting Details -->
                    <div class="space-y-1 text-sm text-gray-600">
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clip-rule="evenodd"/>
                            </svg>
                            <span>${new Date(meeting.start_time).toLocaleString('vi-VN', { 
                                weekday: 'short',
                                year: 'numeric', 
                                month: 'numeric', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </div>
                        
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                            </svg>
                            <span>Chủ trì: ${meeting.organizer}</span>
                        </div>
                        
                        ${meeting.location ? `
                            <div class="flex items-center">
                                <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                                </svg>
                                <span>${meeting.location_type === 'online' ? '🔗 Online' : '🏢 Trực tiếp'}: ${meeting.location}</span>
                            </div>
                        ` : ''}
                        
                        ${meeting.description ? `
                            <div class="flex items-start pt-1">
                                <svg class="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd"/>
                                </svg>
                                <span class="line-clamp-2">${meeting.description}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Processing Indicator -->
                    ${isProcessing ? `
                        <div class="mt-3 flex items-center text-sm text-yellow-600">
                            <div class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse mr-2"></div>
                            <span>Đang xử lý ghi âm và phiên âm...</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Action Buttons -->
                <div class="flex flex-wrap gap-2 lg:flex-col lg:w-auto lg:min-w-[200px]">
                    ${buttons.join('')}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

async function showMeetingDetail(meetingId) {
    try {
        showAlert('⏳ Đang tải thông tin cuộc họp...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`);
        
        if (response.ok) {
            const meeting = await response.json();
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
            
            let audioSection = '';
            let transcriptionSection = '';
            let summarySection = '';
            
            // Audio section
            if (meeting.audio_file_path) {
                let processingInfo = '';
                if (meeting.status === 'in_progress') {
                    processingInfo = `
                        <div class="mt-2 text-sm text-yellow-600">
                            <div class="flex items-center">
                                <div class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse mr-2"></div>
                                <span>Đang xử lý ghi âm và phiên âm...</span>
                            </div>
                        </div>
                    `;
                }
                
                audioSection = `
                    <div class="mt-6 pt-6 border-t border-gray-200">
                        <h4 class="font-semibold text-gray-900 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                            </svg>
                            📁 File ghi âm
                        </h4>
                        <div class="space-y-3">
                            ${meeting.audio_file_name ? `
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Tên file:</span>
                                    <span class="font-medium">${meeting.audio_file_name}</span>
                                </div>
                            ` : ''}
                            
                            ${meeting.audio_file_size ? `
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Kích thước:</span>
                                    <span class="font-medium">${meeting.audio_file_size.toFixed(2)} MB</span>
                                </div>
                            ` : ''}
                            
                            ${processingInfo}
                            
                            <div class="flex space-x-3 pt-2">
                                <button onclick="playMeetingAudio('${meeting.id}')" 
                                        class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                    </svg>
                                    Nghe ghi âm
                                </button>
                                
                                <button onclick="downloadMeetingAudio('${meeting.id}')" 
                                        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                                    </svg>
                                    Tải xuống
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Transcription section
            if (meeting.transcription_id) {
                transcriptionSection = `
                    <div class="mt-6 pt-6 border-t border-gray-200">
                        <h4 class="font-semibold text-gray-900 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                            </svg>
                            📝 Phiên âm
                        </h4>
                        <div class="flex space-x-3">
                            <button onclick="viewMeetingTranscription('${meeting.id}')" 
                                    class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                </svg>
                                Xem phiên âm
                            </button>
                            
                            <div class="flex space-x-2">
                                <button onclick="downloadMeetingTranscription('${meeting.id}', 'txt')" 
                                        class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                                    TXT
                                </button>
                                <button onclick="downloadMeetingTranscription('${meeting.id}', 'json')" 
                                        class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                                    JSON
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Summary section
            if (meeting.summary) {
                summarySection = `
                    <div class="mt-6 pt-6 border-t border-gray-200">
                        <h4 class="font-semibold text-gray-900 mb-2">📋 Tóm tắt</h4>
                        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p class="text-gray-700">${meeting.summary}</p>
                        </div>
                    </div>
                `;
            }
            
            modal.innerHTML = `
                <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h3 class="text-xl font-bold text-gray-900 mb-1">${meeting.title}</h3>
                            <p class="text-gray-600">${meeting.description || 'Không có mô tả'}</p>
                        </div>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600 p-1">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Meeting Info -->
                    <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600 font-medium">Thời gian:</span>
                            <span class="font-semibold">${new Date(meeting.start_time).toLocaleString('vi-VN')}</span>
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600 font-medium">Địa điểm:</span>
                            <span class="font-semibold">${meeting.location_type === 'online' ? '🔗 Online' : '🏢 Trực tiếp'}: ${meeting.location || 'Chưa xác định'}</span>
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600 font-medium">Chủ trì:</span>
                            <span class="font-semibold">${meeting.organizer}</span>
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600 font-medium">Trạng thái:</span>
                            <span class="status-badge ${getStatusClass(meeting.status)}">${getStatusText(meeting.status)}</span>
                        </div>
                    </div>
                    
                    <!-- Audio Section -->
                    ${audioSection}
                    
                    <!-- Transcription Section -->
                    ${transcriptionSection}
                    
                    <!-- Summary Section -->
                    ${summarySection}
                    
                    <!-- Action Buttons -->
                    <div class="mt-6 pt-6 border-t border-gray-200 flex justify-between">
                        <div>
                            ${(!meeting.audio_file_path && (meeting.status === 'scheduled' || meeting.status === 'in_progress')) ? `
                                <button onclick="startMeetingRecording('${meeting.id}', '${meeting.title}')" 
                                        class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors mr-3">
                                    <svg class="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                                    </svg>
                                    Ghi âm
                                </button>
                            ` : ''}
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            showAlert('✅ Đã tải thông tin cuộc họp', 'success');
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Không thể tải thông tin cuộc họp');
        }
    } catch (error) {
        console.error('❌ Error loading meeting detail:', error);
        showAlert(`❌ Lỗi: ${error.message}`, 'danger');
    }
}

// ==================== MEETING RECORDING FUNCTIONS ====================
async function startMeetingRecording(meetingId, meetingTitle) {
    if (meetingRecordingInProgress) {
        showAlert('⚠️ Đang ghi âm cuộc họp khác. Vui lòng dừng ghi âm trước khi bắt đầu mới.', 'warning');
        return;
    }
    
    // Confirmation modal
    const confirmed = await showConfirmationModal(
        '🎤 Bắt đầu ghi âm cuộc họp',
        `Bạn có chắc chắn muốn bắt đầu ghi âm cho cuộc họp:<br><strong>"${meetingTitle}"</strong>?<br><br>
        <span class="text-sm text-gray-600">• Hệ thống sẽ yêu cầu quyền truy cập microphone<br>
        • Bấm "Bắt đầu ghi âm" để tiếp tục</span>`,
        'Bắt đầu ghi âm',
        'bg-red-500 hover:bg-red-600'
    );
    
    if (!confirmed) return;
    
    try {
        activeMeetingId = meetingId;
        showAlert('🔍 Đang yêu cầu quyền truy cập microphone...', 'info');
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
                channelCount: 1
            }
        });
        
        meetingRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });
        
        meetingAudioChunks = [];
        
        meetingRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                meetingAudioChunks.push(event.data);
            }
        };
        
        meetingRecorder.onstop = async () => {
            try {
                if (meetingAudioChunks.length === 0) {
                    showAlert('❌ Không có dữ liệu ghi âm', 'danger');
                    return;
                }
                
                showAlert('💾 Đang lưu bản ghi âm...', 'info');
                
                const audioBlob = new Blob(meetingAudioChunks, { type: 'audio/webm' });
                
                // Create FormData
                const formData = new FormData();
                const fileName = `meeting_${meetingId}_${Date.now()}.webm`;
                formData.append('file', audioBlob, fileName);
                
                // Upload to server
                const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/record-audio`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    showAlert(`✅ Đã lưu ghi âm cho: "${meetingTitle}"`, 'success');
                    
                    // Update UI
                    setTimeout(() => {
                        loadMeetingsList();
                        loadCalendarEvents();
                    }, 1000);
                    
                } else {
                    const error = await response.json();
                    throw new Error(error.detail || 'Lỗi upload file ghi âm');
                }
                
            } catch (error) {
                console.error('❌ Error saving recording:', error);
                showAlert(`❌ Lỗi lưu ghi âm: ${error.message}`, 'danger');
            } finally {
                // Cleanup
                stream.getTracks().forEach(track => track.stop());
                meetingRecordingInProgress = false;
                activeMeetingId = null;
                const stopBtn = document.querySelector('.stop-recording-floating');
                if (stopBtn) stopBtn.remove();
            }
        };
        
        meetingRecorder.start(1000); // Collect data every second
        meetingRecordingInProgress = true;
        
        showAlert(`🎤 Đang ghi âm: "${meetingTitle}"`, 'info');
        
        // Create floating stop button
        createStopRecordingButton();
        
    } catch (error) {
        console.error('❌ Error starting recording:', error);
        
        if (error.name === 'NotAllowedError') {
            showAlert('❌ Quyền truy cập microphone bị từ chối. Vui lòng cấp quyền trong trình duyệt.', 'danger');
        } else if (error.name === 'NotFoundError') {
            showAlert('❌ Không tìm thấy thiết bị microphone. Vui lòng kiểm tra kết nối.', 'danger');
        } else if (error.name === 'NotReadableError') {
            showAlert('❌ Không thể truy cập microphone. Thiết bị có thể đang được sử dụng bởi ứng dụng khác.', 'danger');
        } else {
            showAlert(`❌ Lỗi: ${error.message}`, 'danger');
        }
    }
}

function createStopRecordingButton() {
    // Remove existing button
    const existingBtn = document.querySelector('.stop-recording-floating');
    if (existingBtn) existingBtn.remove();
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'stop-recording-floating fixed bottom-6 right-6 px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full shadow-xl z-50 flex items-center space-x-3 animate-pulse hover:from-red-700 hover:to-red-800 transition-all duration-200';
    stopBtn.innerHTML = `
        <div class="relative">
            <div class="w-4 h-4 bg-white rounded-full"></div>
            <div class="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-75"></div>
        </div>
        <span class="font-medium">Dừng ghi âm</span>
    `;
    stopBtn.onclick = () => {
        if (meetingRecorder && meetingRecorder.state === 'recording') {
            meetingRecorder.stop();
            stopBtn.remove();
            showAlert('⏸️ Đã dừng ghi âm. Đang xử lý...', 'info');
        }
    };
    
    document.body.appendChild(stopBtn);
}

async function playMeetingAudio(meetingId) {
    try {
        const audioUrl = `${API_BASE_URL}/api/meetings/${meetingId}/audio`;

        // Fetch meeting details to determine file extension / mime type
        let mediaType = 'audio/mpeg';
        try {
            const metaResp = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`);
            if (metaResp.ok) {
                const meta = await metaResp.json();
                const fname = meta.audio_file_name || '';
                const ext = fname.split('.').pop().toLowerCase();
                if (ext === 'mp3') mediaType = 'audio/mpeg';
                else if (ext === 'wav') mediaType = 'audio/wav';
                else if (ext === 'webm') mediaType = 'audio/webm';
                else if (ext === 'ogg') mediaType = 'audio/ogg';
            }
        } catch (e) {
            console.debug('Could not fetch meeting metadata for audio mime type', e);
        }

        // Create audio player modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 audio-player-modal';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-md w-full">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">🎵 Phát lại ghi âm</h3>
                        <p class="text-sm text-gray-600 mt-1">Nghe lại bản ghi âm cuộc họp</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="text-gray-400 hover:text-gray-600 p-1">
                        ✕
                    </button>
                </div>
                
                <div class="mb-6">
                    <audio controls class="w-full rounded-lg" id="meeting-audio-player">
                        <source src="${audioUrl}" type="${mediaType}">
                        Trình duyệt của bạn không hỗ trợ phát audio.
                    </audio>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <a href="${audioUrl}" download 
                       class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Tải xuống
                    </a>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-play after a short delay
        setTimeout(() => {
            const audioPlayer = modal.querySelector('#meeting-audio-player');
            if (audioPlayer) {
                audioPlayer.play().catch(e => {
                    console.log('Auto-play prevented:', e);
                    showAlert('🔇 Bấm nút play để phát audio', 'info');
                });
            }
        }, 300);
        
    } catch (error) {
        console.error('❌ Error playing meeting audio:', error);
        showAlert('❌ Không thể phát ghi âm', 'danger');
    }
}

async function viewMeetingTranscription(meetingId) {
    try {
        showAlert('⏳ Đang tải nội dung phiên âm...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/transcription`);
        
        if (response.ok) {
            const transcription = await response.json();
            
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
            
            // Create segments HTML
            let segmentsHtml = '';
            if (transcription.segments && transcription.segments.length > 0) {
                segmentsHtml = transcription.segments.map((seg, index) => `
                    <div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-sm font-medium text-gray-500 bg-white px-2 py-1 rounded">
                                #${index + 1}
                            </span>
                            <span class="text-sm text-indigo-600 font-medium">
                                ${formatTime(seg.start)} → ${formatTime(seg.end)}
                            </span>
                        </div>
                        <div class="text-gray-800 leading-relaxed">${seg.text}</div>
                    </div>
                `).join('');
            }
            
            modal.innerHTML = `
                <div class="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h3 class="text-xl font-bold text-gray-900 mb-1">📝 Phiên âm cuộc họp</h3>
                            <p class="text-gray-600">${transcription.meeting_info?.title || 'Không có tiêu đề'}</p>
                        </div>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600 p-1">
                            ✕
                        </button>
                    </div>
                    
                    <!-- Full Text -->
                    <div class="mb-8">
                        <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                            </svg>
                            Toàn bộ văn bản:
                        </h4>
                        <div class="bg-gray-50 p-5 rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
                            <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">${transcription.full_text || 'Không có văn bản'}</p>
                        </div>
                    </div>
                    
                    <!-- Segments -->
                    <div class="mb-8">
                        <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
                            </svg>
                            Phân đoạn theo thời gian:
                        </h4>
                        <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                            ${segmentsHtml || '<p class="text-gray-500 text-center py-8">Không có phân đoạn</p>'}
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex justify-between items-center pt-6 border-t border-gray-200">
                        <div class="text-sm text-gray-500">
                            Ngôn ngữ: ${transcription.language || 'Không xác định'}
                            ${transcription.meeting_info?.start_time ? `
                                <span class="mx-2">•</span>
                                Thời gian: ${new Date(transcription.meeting_info.start_time).toLocaleString('vi-VN')}
                            ` : ''}
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="downloadMeetingTranscription('${meetingId}', 'txt')" 
                                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                                </svg>
                                Tải TXT
                            </button>
                            
                            <button onclick="downloadMeetingTranscription('${meetingId}', 'json')" 
                                    class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                Tải JSON
                            </button>
                            
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            showAlert('✅ Đã tải nội dung phiên âm', 'success');
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Không thể tải transcription');
        }
        
    } catch (error) {
        console.error('❌ Error loading transcription:', error);
        showAlert(`❌ Lỗi: ${error.message}`, 'danger');
    }
}

async function downloadMeetingAudio(meetingId) {
    try {
        const audioUrl = `${API_BASE_URL}/api/meetings/${meetingId}/audio`;
        const response = await fetch(audioUrl);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meeting_audio_${meetingId}_${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showAlert('✅ Đã tải file audio thành công', 'success');
        } else {
            throw new Error('Không thể tải file audio');
        }
    } catch (error) {
        console.error('❌ Error downloading audio:', error);
        showAlert(`❌ Lỗi tải file: ${error.message}`, 'danger');
    }
}

async function downloadMeetingTranscription(meetingId, format) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/transcription`);
        
        if (response.ok) {
            const transcription = await response.json();
            let content = '';
            let filename = `transcription_${meetingId}_${Date.now()}.${format}`;
            
            if (format === 'txt') {
                content = transcription.full_text || 'Không có nội dung';
            } else if (format === 'json') {
                content = JSON.stringify(transcription, null, 2);
            }
            
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showAlert(`✅ Đã tải file: ${filename}`, 'success');
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Không thể tải transcription');
        }
    } catch (error) {
        showAlert(`❌ Lỗi tải file: ${error.message}`, 'danger');
    }
}

// ==================== AUTO-REFRESH FUNCTIONS ====================
function startAutoRefreshMeetings() {
    if (meetingRefreshInterval) {
        clearInterval(meetingRefreshInterval);
    }
    
    meetingRefreshInterval = setInterval(() => {
        if (!meetingsView.classList.contains('hidden')) {
            loadMeetingsList();
            loadCalendarEvents();
            console.log('🔄 Auto-refreshed meetings list');
        }
    }, 30000); // 30 seconds
}

function stopAutoRefreshMeetings() {
    if (meetingRefreshInterval) {
        clearInterval(meetingRefreshInterval);
        meetingRefreshInterval = null;
        console.log('⏹️ Stopped auto-refresh');
    }
}

// ==================== TRANSCRIPTION FUNCTIONS ====================
async function startTranscription() {
    if (!selectedFile) {
        showAlert('❌ Vui lòng chọn hoặc ghi âm một file audio trước.', 'warning');
        return;
    }
    
    try {
        // Hide result, show progress
        transcriptionResult.classList.add('hidden');
        transcriptionProgress.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Đang khởi tạo...';
        
        // Get transcription options
        const modelSize = document.getElementById('model-size').value;
        const language = document.getElementById('language').value;
        const wordTimestamps = document.getElementById('word-timestamps').classList.contains('checked');
        const vadFilter = document.getElementById('vad-filter').classList.contains('checked');
        
        // Create FormData
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('model_size', modelSize);
        formData.append('language', language || '');
        formData.append('word_timestamps', wordTimestamps.toString());
        formData.append('vad_filter', vadFilter.toString());
        
        // Upload progress
        progressBar.style.width = '30%';
        progressStatus.textContent = 'Đang upload file audio...';
        
        // Start transcription
        console.log('🚀 Starting transcription...');
        const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            let errMsg = 'Lỗi upload file';
            try {
                const error = await response.json();
                errMsg = error.detail || JSON.stringify(error) || errMsg;
            } catch (e) {
                try {
                    const text = await response.text();
                    errMsg = text || errMsg;
                } catch (e2) {}
            }
            throw new Error(errMsg);
        }
        
        progressBar.style.width = '50%';
        progressStatus.textContent = 'Đang xử lý...';
        
        const task = await response.json();
        currentTaskId = task.id;
        
        console.log(`📝 Transcription task started: ${task.id}`);
        
        // Poll for results
        pollTranscriptionResult(task.id);
        
    } catch (error) {
        console.error('❌ Transcription error:', error);
        showAlert(`❌ Lỗi: ${error.message}`, 'danger');
        progressStatus.textContent = `❌ Lỗi: ${error.message}`;
        transcriptionProgress.classList.add('hidden');
    }
}

async function pollTranscriptionResult(taskId) {
    console.log(`🔄 Polling for task: ${taskId}`);
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
            
            if (!response.ok) {
                throw new Error('Không thể lấy trạng thái task');
            }
            
            const task = await response.json();
            console.log(`📊 Task status: ${task.status}`);
            
            // Update progress
            if (task.status === 'processing') {
                progressBar.style.width = '70%';
                progressStatus.textContent = 'Đang phiên âm...';
            }
            
            // Completed
            if (task.status === 'completed') {
                clearInterval(pollingInterval);
                
                progressBar.style.width = '100%';
                progressStatus.textContent = 'Phiên âm hoàn thành!';
                
                // Show results
                setTimeout(() => {
                    transcriptionProgress.classList.add('hidden');
                    transcriptionResult.classList.remove('hidden');
                    
                    // Display results
                    displayTranscriptionResults(task.result);
                    transcriptionData = task.result;
                    
                    showAlert('✅ Phiên âm thành công!', 'success');
                }, 500);
            }
            
            // Failed
            if (task.status === 'failed') {
                clearInterval(pollingInterval);
                const errorText = task.error || 'Không rõ lỗi';
                progressBar.style.width = '0%';
                progressStatus.textContent = `❌ Phiên âm thất bại: ${errorText}`;
                showAlert(`❌ Phiên âm thất bại: ${errorText}`, 'danger');
            }
            
        } catch (error) {
            console.error('❌ Polling error:', error);
            clearInterval(pollingInterval);
            showAlert('❌ Lỗi kiểm tra trạng thái phiên âm', 'danger');
            transcriptionProgress.classList.add('hidden');
        }
    }, 2000);
}

function displayTranscriptionResults(result) {
    if (!result) {
        showAlert('❌ Không có dữ liệu phiên âm', 'warning');
        return;
    }
    
    // Update model info
    const modelSize = document.getElementById('model-size').value;
    const device = document.getElementById('device').value;
    modelInfo.textContent = `${modelSize} (${device})`;
    
    // Update language info
    detectedLanguage.textContent = getLanguageName(result.language) + ' (' + result.language + ')';
    languageProbability.textContent = (result.language_probability * 100).toFixed(1) + '%';
    
    // Update timing info
    if (result.processing_time) {
        processingTime.textContent = result.processing_time.toFixed(2) + ' giây';
    }
    
    if (result.audio_duration) {
        audioDuration.textContent = formatTime(result.audio_duration) + ' (' + result.audio_duration.toFixed(2) + ' giây)';
    }
    
    // Display full transcript
    if (result.segments && result.segments.length > 0) {
        let fullText = '';
        result.segments.forEach(segment => {
            fullText += segment.text + ' ';
        });
        fullTranscript.textContent = fullText.trim();
    } else {
        fullTranscript.textContent = 'Không có văn bản được phiên âm';
    }
    
    // Display segments
    segmentsContainer.innerHTML = '';
    if (result.segments && result.segments.length > 0) {
        result.segments.forEach((segment, index) => {
            const segmentEl = document.createElement('div');
            segmentEl.className = 'segment-item p-5 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 mb-4 hover:border-indigo-200 transition-colors';
            
            segmentEl.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <span class="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                        #${index + 1}
                    </span>
                    <span class="text-sm text-gray-500 font-medium">
                        ${formatTime(segment.start)} → ${formatTime(segment.end)}
                    </span>
                </div>
                <div class="text-gray-800 leading-relaxed">${segment.text}</div>
                ${segment.words && segment.words.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <div class="flex flex-wrap gap-1">
                            ${segment.words.map(word => `
                                <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded" 
                                      title="${word.probability ? 'Độ tin cậy: ' + (word.probability * 100).toFixed(1) + '%' : ''}">
                                    ${word.word}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
            
            segmentsContainer.appendChild(segmentEl);
        });
    }
}

async function generateSummary() {
    if (!fullTranscript.textContent.trim()) {
        showAlert('❌ Không có văn bản để tóm tắt.', 'warning');
        return;
    }
    
    try {
        summarizeBtn.disabled = true;
        summarizeBtn.innerHTML = '<span class="animate-spin mr-2">⟳</span> Đang tóm tắt...';
        
        // Call summarization API
        const response = await fetch(`${API_BASE_URL}/api/summarize`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                full_transcript: fullTranscript.textContent,
                language_code: 'vi'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            summaryContent.innerHTML = `
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                    <h3 class="font-semibold text-green-800 mb-3 flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2h6a2 2 0 002-2V8a2 2 0 00-2-2H4zm2 6a1 1 0 01-1-1V7a1 1 0 011-1h1a1 1 0 011 1v2a1 1 0 01-1 1H6zm5-1a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2z" clip-rule="evenodd"/>
                        </svg>
                        Bản Tóm Tắt
                    </h3>
                    <p class="text-gray-700 leading-relaxed">${result.summary}</p>
                </div>
            `;
            
            switchResultTab('summary');
            showAlert('✅ Tóm tắt hoàn thành!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Lỗi tạo tóm tắt');
        }
    } catch (error) {
        console.error('❌ Lỗi tóm tắt:', error);
        summaryContent.innerHTML = `
            <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                <p class="text-red-700">❌ Lỗi khi tạo tóm tắt: ${error.message}</p>
            </div>
        `;
        showAlert(`❌ Lỗi khi tạo tóm tắt: ${error.message}`, 'danger');
    } finally {
        summarizeBtn.disabled = false;
        summarizeBtn.innerHTML = 'Tóm Tắt';
    }
}

// ==================== FILE HANDLING ====================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processSelectedFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('border-indigo-500', 'bg-gradient-to-br', 'from-indigo-100', 'to-purple-100');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('border-indigo-500', 'bg-gradient-to-br', 'from-indigo-100', 'to-purple-100');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('border-indigo-500', 'bg-gradient-to-br', 'from-indigo-100', 'to-purple-100');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        processSelectedFile(file);
    } else {
        showAlert('❌ Vui lòng chọn một file audio hợp lệ (MP3, WAV, M4A, etc.).', 'danger');
    }
}

function processSelectedFile(file) {
    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
        showAlert('❌ File quá lớn. Vui lòng chọn file nhỏ hơn 50MB.', 'danger');
        return;
    }
    
    selectedFile = file;
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    transcriptionOptions.classList.remove('hidden');
    
    const fileURL = URL.createObjectURL(file);
    audioPreview.src = fileURL;
    
    // Cleanup recording stream if exists
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    showAlert(`✅ Đã chọn file: ${file.name}`, 'success');
    console.log(`📁 File selected: ${file.name} (${formatFileSize(file.size)})`);
}

function resetFileUpload() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    transcriptionOptions.classList.add('hidden');
    audioPreview.src = '';
    transcriptionProgress.classList.add('hidden');
    transcriptionResult.classList.add('hidden');
    
    // Clear polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    // Cleanup recording
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = true;
    micStatusEl.textContent = 'Sẵn sàng ghi âm';
    recordingTimeEl.textContent = '00:00';
    recordingMessageEl.classList.add('hidden');
    
    console.log('🗑️ File upload reset');
}

// ==================== RECORDING FUNCTIONS ====================
async function checkMicrophoneAccess() {
    micStatusEl.textContent = '🔍 Đang kiểm tra microphone...';
    
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        micStatusEl.textContent = '✅ Microphone đã sẵn sàng';
        startRecordBtn.disabled = false;
        startRecordBtn.innerHTML = '<span class="recording-indicator hidden"></span><span>🎤 Bắt đầu Ghi</span>';
        
        console.log('🎤 Microphone access granted');
    } catch (err) {
        micStatusEl.textContent = '❌ Lỗi: Không thể truy cập microphone';
        startRecordBtn.disabled = true;
        showAlert('❌ Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.', 'danger');
        console.error('🎤 Microphone access error:', err);
    }
}

function startRecording() {
    audioChunks = [];
    recorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
    });
    
    recorder.ondataavailable = event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };
    
    recorder.onstop = () => {
        const mimeType = recorder.mimeType.split(';')[0];
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        
        const recordedFile = new File([audioBlob], `ghi_am_${Date.now()}.webm`, { 
            type: mimeType, 
            lastModified: Date.now() 
        });
        
        processRecordedFile(recordedFile);
        
        // Reset UI
        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordingIndicator.classList.add('hidden');
        recordingTimeEl.textContent = '00:00';
        micStatusEl.textContent = '✅ Ghi âm hoàn thành';
        recordingMessageEl.classList.add('hidden');
        
        console.log('🎤 Recording completed');
    };
    
    recorder.start();
    recordingStartTime = Date.now();
    recordingTimer = setInterval(updateRecordingTime, 1000);
    
    // Update UI
    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    recordingIndicator.classList.remove('hidden');
    micStatusEl.textContent = '🎤 Đang ghi âm...';
    recordingMessageEl.classList.remove('hidden');
    
    showAlert('🎤 Đã bắt đầu ghi âm', 'info');
    console.log('🎤 Recording started');
}

function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        clearInterval(recordingTimer);
        showAlert('⏸️ Đã dừng ghi âm', 'info');
    }
}

function updateRecordingTime() {
    const elapsedTime = Date.now() - recordingStartTime;
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    recordingTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function processRecordedFile(file) {
    selectedFile = file;
    
    // Switch to upload tab to show file
    switchInputTab('upload');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    transcriptionOptions.classList.remove('hidden');
    
    const fileURL = URL.createObjectURL(file);
    audioPreview.src = fileURL;
    
    showAlert('✅ Ghi âm hoàn tất! Sẵn sàng phiên âm.', 'success');
    console.log(`🎤 Recorded file: ${file.name} (${formatFileSize(file.size)})`);
}

// ==================== UTILITY FUNCTIONS ====================
function initializeToggleSwitches() {
    const toggleSwitches = document.querySelectorAll('.toggle-switch');
    console.log(`🔘 Initializing ${toggleSwitches.length} toggle switches`);
    
    toggleSwitches.forEach(switchEl => {
        switchEl.addEventListener('click', function() {
            this.classList.toggle('checked');
            console.log(`🔘 Toggle switched: ${this.id} = ${this.classList.contains('checked')}`);
        });
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

function getLanguageName(code) {
    const languages = {
        'en': 'English',
        'vi': 'Tiếng Việt',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'it': 'Italian'
    };
    
    return languages[code] || code;
}

function downloadTranscript(format) {
    if (!transcriptionData || !fullTranscript.textContent.trim()) {
        showAlert('❌ Không có dữ liệu phiên âm để tải về', 'warning');
        return;
    }
    
    let content = '';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    let filename = `transcript_${timestamp}.${format}`;
    
    switch (format) {
        case 'txt':
            content = `PHIÊN ÂM VĂN BẢN\n`;
            content += `Ngày: ${new Date().toLocaleString('vi-VN')}\n`;
            content += `Ngôn ngữ: ${transcriptionData.language}\n`;
            content += `Độ tin cậy: ${(transcriptionData.language_probability * 100).toFixed(1)}%\n`;
            content += `Thời gian xử lý: ${transcriptionData.processing_time?.toFixed(2) || 'N/A'} giây\n`;
            content += `Độ dài audio: ${formatTime(transcriptionData.audio_duration || 0)}\n\n`;
            content += '='.repeat(50) + '\n\n';
            content += fullTranscript.textContent;
            break;
            
        case 'srt':
            if (transcriptionData.segments) {
                content = transcriptionData.segments.map((segment, index) => {
                    const start = formatSrtTime(segment.start);
                    const end = formatSrtTime(segment.end);
                    return `${index + 1}\n${start} --> ${end}\n${segment.text}\n`;
                }).join('\n');
            }
            break;
            
        case 'json':
            content = JSON.stringify(transcriptionData, null, 2);
            break;
    }
    
    if (!content) {
        showAlert('❌ Không thể tạo file', 'warning');
        return;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert(`✅ Đã tải xuống: ${filename}`, 'success');
    console.log(`📥 Downloaded transcript: ${filename}`);
}

function formatSrtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function showAlert(message, type) {
    // Remove existing alerts
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <span class="mr-3 text-lg">${getAlertIcon(type)}</span>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    class="ml-4 text-white/80 hover:text-white">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
        </div>
    `;
    
    const container = document.querySelector('.max-w-7xl');
    if (container) {
        container.insertBefore(alertEl, container.firstChild);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertEl.parentNode) {
            alertEl.remove();
        }
    }, 5000);
    
    console.log(`📢 Alert: ${type} - ${message}`);
}

function getAlertIcon(type) {
    const icons = {
        'success': '✅',
        'danger': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || '💡';
}

async function showConfirmationModal(title, message, confirmText, confirmColor = 'bg-indigo-500 hover:bg-indigo-600') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-md w-full transform transition-all">
                <div class="mb-5">
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>
                    <div class="text-gray-600">${message}</div>
                </div>
                
                <div class="flex space-x-3 justify-end">
                    <button onclick="closeConfirmationModal(this, false)"
                            class="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                        Hủy
                    </button>
                    <button onclick="closeConfirmationModal(this, true)"
                            class="px-4 py-2.5 ${confirmColor} text-white rounded-lg transition-colors font-medium">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        window.closeConfirmationModal = function(button, result) {
            modal.remove();
            resolve(result);
        };
        
        document.body.appendChild(modal);
    });
}

function getStatusClass(status) {
    const classes = {
        'scheduled': 'status-scheduled',
        'in_progress': 'status-in-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled',
        'draft': 'status-draft'
    };
    return classes[status] || 'status-scheduled';
}

function getStatusText(status) {
    const texts = {
        'scheduled': '📅 Đã lên lịch',
        'in_progress': '🎤 Đang diễn ra',
        'completed': '✅ Đã hoàn thành',
        'cancelled': '❌ Đã hủy',
        'draft': '📝 Nháp'
    };
    return texts[status] || status;
}

async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('🏥 Server health:', health);
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Server not responding:', error);
        if (API_BASE_URL !== 'http://localhost:8000') {
            setTimeout(() => {
                showAlert('⚠️ Không thể kết nối đến server. Vui lòng kiểm tra lại kết nối.', 'warning');
            }, 1000);
        }
    }
    return false;
}

// ==================== EXPORT FUNCTIONS FOR GLOBAL USE ====================
window.loadMeetingsList = loadMeetingsList;
window.startMeetingRecording = startMeetingRecording;
window.playMeetingAudio = playMeetingAudio;
window.viewMeetingTranscription = viewMeetingTranscription;
window.downloadMeetingTranscription = downloadMeetingTranscription;
window.showMeetingDetail = showMeetingDetail;
window.switchInputTab = switchInputTab;