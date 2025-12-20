// DOM Elements - ORIGINAL
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

// DOM Elements - MEETING MANAGEMENT (NEW)
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

// Global variables - ORIGINAL
let selectedFile = null;
let currentTaskId = null;
let pollingInterval = null;
let transcriptionData = null;
let recorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = 0;
let mediaStream = null;

// Global variables - MEETINGS (NEW)
let calendar = null;
let currentParticipants = [];

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    
    // File Upload Events
    browseBtn.addEventListener('click', () => {
        console.log('Browse button clicked');
        fileInput.click();
    });
    
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
    
    // Tab switching for Upload/Record/Meetings - FIXED
    uploadTab.addEventListener('click', () => {
        console.log('Upload tab clicked');
        switchInputTab('upload');
    });
    
    recordTab.addEventListener('click', () => {
        console.log('Record tab clicked');
        switchInputTab('record');
    });
    
    meetingsTab.addEventListener('click', () => {
        console.log('Meetings tab clicked');
        switchInputTab('meetings');
    });
    
    // Tab switching for Result
    tabTranscript.addEventListener('click', () => switchResultTab('transcript'));
    tabSegments.addEventListener('click', () => switchResultTab('segments'));
    tabSummary.addEventListener('click', () => switchResultTab('summary'));
    tabInfo.addEventListener('click', () => switchResultTab('info'));
    
    // Meeting Events (NEW)
    meetingForm.addEventListener('submit', createMeeting);
    addParticipantBtn.addEventListener('click', addParticipant);
    meetingLocationType.addEventListener('change', updateLocationPlaceholder);
    
    // Initialize
    console.log('Initializing tabs...');
    switchInputTab('upload');
    switchResultTab('transcript');
    
    // Initialize toggle switches
    initializeToggleSwitches();
    
    // Set default datetime for meeting form
    setDefaultMeetingTimes();
    
    // Initialize logo
    initializeLogo();
    
    console.log('Application initialized successfully');
});

// --- Tab switching functions - FIXED VERSION ---
function switchInputTab(tab) {
    console.log(`Switching to tab: ${tab}`);
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Hide all views
    uploadView.classList.add('hidden');
    recordView.classList.add('hidden');
    meetingsView.classList.add('hidden');
    
    // Show selected view and activate tab
    switch(tab) {
        case 'upload':
            uploadTab.classList.add('active');
            uploadView.classList.remove('hidden');
            console.log('Upload view shown');
            break;
        case 'record':
            recordTab.classList.add('active');
            recordView.classList.remove('hidden');
            console.log('Record view shown');
            checkMicrophoneAccess();
            break;
        case 'meetings':
            meetingsTab.classList.add('active');
            meetingsView.classList.remove('hidden');
            console.log('Meetings view shown');
            initCalendar();
            loadMeetingsList();
            break;
    }
    
    // Reset file info if switching from upload tab
    if (tab !== 'upload') {
        resetFileUpload();
    }
    
    // Stop media stream if switching away from record tab
    if (tab !== 'record' && mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

function switchResultTab(tab) {
    console.log(`Switching result tab to: ${tab}`);
    
    // Remove active class from all result tabs
    document.querySelectorAll('[data-result-tab]').forEach(button => {
        button.classList.remove('active');
    });
    
    // Hide all content
    contentTranscript.classList.add('hidden');
    contentSegments.classList.add('hidden');
    contentSummary.classList.add('hidden');
    contentInfo.classList.add('hidden');
    
    // Show selected content and activate tab
    switch(tab) {
        case 'transcript':
            tabTranscript.classList.add('active');
            contentTranscript.classList.remove('hidden');
            break;
        case 'segments':
            tabSegments.classList.add('active');
            contentSegments.classList.remove('hidden');
            break;
        case 'summary':
            tabSummary.classList.add('active');
            contentSummary.classList.remove('hidden');
            break;
        case 'info':
            tabInfo.classList.add('active');
            contentInfo.classList.remove('hidden');
            break;
    }
}

// --- Initialize Toggle Switches ---
function initializeToggleSwitches() {
    const toggleSwitches = document.querySelectorAll('.toggle-switch');
    console.log(`Initializing ${toggleSwitches.length} toggle switches`);
    
    toggleSwitches.forEach(switchEl => {
        switchEl.addEventListener('click', function() {
            this.classList.toggle('checked');
            console.log(`Toggle switch clicked, checked: ${this.classList.contains('checked')}`);
        });
    });
}

// --- MEETING MANAGEMENT FUNCTIONS ---

function initCalendar() {
    if (calendar) {
        calendar.destroy();
        calendar = null;
    }
    
    console.log('Initializing calendar...');
    
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
            console.log('Calendar event clicked:', info.event.id);
            showMeetingDetail(info.event.id);
        },
        dateClick: function(info) {
            console.log('Calendar date clicked:', info.dateStr);
            const dateStr = info.dateStr;
            const startTime = new Date(info.date);
            startTime.setHours(10, 0, 0);
            const endTime = new Date(info.date);
            endTime.setHours(11, 0, 0);
            
            meetingStart.value = startTime.toISOString().slice(0, 16);
            meetingEnd.value = endTime.toISOString().slice(0, 16);
            
            // Switch to form view
            meetingTitle.focus();
            
            showAlert('Đã điền thời gian tự động!', 'success');
        },
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        height: 600,
        editable: false,
        selectable: true,
        businessHours: {
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '18:00',
        }
    });
    
    calendar.render();
    console.log('Calendar rendered');
    
    // Load demo events for testing
    loadDemoEvents();
}

function loadDemoEvents() {
    const events = [
        {
            id: '1',
            title: 'Họp triển khai dự án Q2',
            start: new Date(new Date().setHours(10, 0)),
            end: new Date(new Date().setHours(11, 30)),
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6'
        },
        {
            id: '2',
            title: 'Review kết quả tháng',
            start: new Date(new Date().setDate(new Date().getDate() + 1)),
            end: new Date(new Date().setDate(new Date().getDate() + 1)),
            allDay: true,
            backgroundColor: '#10b981',
            borderColor: '#10b981'
        }
    ];
    
    events.forEach(event => calendar.addEvent(event));
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
    meetingLocation.placeholder = isOnline ? 'https://meet.google.com/xxx-yyyy-zzz' : 'Phòng A1, Tầng 5, Tòa nhà B';
}

async function createMeeting(e) {
    e.preventDefault();
    console.log('Creating meeting...');
    
    const meetingData = {
        title: meetingTitle.value,
        description: meetingDesc.value,
        start_time: meetingStart.value + ':00',
        end_time: meetingEnd.value + ':00',
        location_type: meetingLocationType.value,
        location: meetingLocation.value,
        organizer: meetingOrganizer.value,
        participants: currentParticipants,
        status: 'scheduled'
    };
    
    console.log('Meeting data:', meetingData);
    
    try {
        showAlert('⏳ Đang tạo cuộc họp...', 'info');
        
        // Demo: Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate demo meeting
        const demoMeeting = {
            id: 'meeting_' + Date.now(),
            ...meetingData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        showAlert('✅ Đã tạo cuộc họp thành công!', 'success');
        
        // Reset form
        meetingForm.reset();
        currentParticipants = [];
        setDefaultMeetingTimes();
        updateLocationPlaceholder();
        
        // Refresh calendar and list
        loadDemoEvents();
        loadMeetingsList();
        
    } catch (error) {
        console.error('Error creating meeting:', error);
        showAlert('❌ Lỗi: ' + error.message, 'danger');
    }
}

function addParticipant() {
    const name = prompt('Nhập tên người tham dự:');
    if (!name) return;
    
    const role = prompt('Vai trò (tuỳ chọn):');
    const email = prompt('Email (tuỳ chọn):');
    
    currentParticipants.push({
        name: name,
        role: role || null,
        email: email || null,
        is_required: true
    });
    
    showAlert(`Đã thêm ${name} vào danh sách tham dự`, 'success');
}

async function loadMeetingsList() {
    console.log('Loading meetings list...');
    
    try {
        // Demo data
        const meetings = [
            {
                id: '1',
                title: 'Họp triển khai dự án Q2',
                description: 'Thảo luận về kế hoạch triển khai dự án quý 2',
                start_time: new Date(new Date().setHours(10, 0)).toISOString(),
                end_time: new Date(new Date().setHours(11, 30)).toISOString(),
                location_type: 'physical',
                location: 'Phòng họp A1',
                organizer: 'Nguyễn Văn A',
                participants: [
                    { name: 'Nguyễn Văn A', role: 'Trưởng phòng' },
                    { name: 'Trần Thị B', role: 'Thành viên' }
                ],
                status: 'scheduled',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '2',
                title: 'Review kết quả tháng',
                description: 'Đánh giá kết quả công việc tháng vừa qua',
                start_time: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
                end_time: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
                location_type: 'online',
                location: 'https://meet.google.com/abc-xyz-123',
                organizer: 'Trần Thị B',
                participants: [
                    { name: 'Trần Thị B', role: 'Chủ trì' },
                    { name: 'Lê Văn C', role: 'Thành viên' }
                ],
                status: 'scheduled',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];
        
        displayMeetingsList(meetings);
        
        // Update stats
        statsTotal.textContent = meetings.length;
        statsUpcoming.textContent = meetings.filter(m => m.status === 'scheduled').length;
        
    } catch (error) {
        console.error('Lỗi tải danh sách cuộc họp:', error);
        meetingsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>Lỗi tải danh sách cuộc họp</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

function displayMeetingsList(meetings) {
    if (meetings.length === 0) {
        meetingsList.innerHTML = `
            <div class="text-center py-12">
                <div class="w-20 h-20 mx-auto mb-4 text-gray-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h4 class="text-lg font-medium text-gray-700 mb-2">Chưa có cuộc họp nào</h4>
                <p class="text-gray-500 mb-6">Hãy tạo cuộc họp đầu tiên của bạn!</p>
                <button onclick="meetingTitle.focus()" 
                        class="btn-primary px-6 py-3 rounded-lg">
                    <span class="flex items-center space-x-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                        </svg>
                        <span>Tạo Cuộc họp Đầu tiên</span>
                    </span>
                </button>
            </div>
        `;
        return;
    }
    
    meetingsList.innerHTML = meetings.map(meeting => `
        <div class="glass-effect p-5 rounded-xl hover-lift cursor-pointer border border-transparent hover:border-indigo-100">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center mb-3">
                        <span class="status-badge ${getStatusClass(meeting.status)}">
                            ${getStatusText(meeting.status)}
                        </span>
                        <span class="text-xs text-gray-500 ml-3">
                            ID: ${meeting.id.substring(0, 8)}...
                        </span>
                    </div>
                    
                    <h4 class="font-semibold text-lg text-gray-900 mb-2">${meeting.title}</h4>
                    
                    <div class="space-y-2">
                        <p class="text-sm text-gray-600 flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clip-rule="evenodd"/>
                            </svg>
                            ${new Date(meeting.start_time).toLocaleString('vi-VN')}
                        </p>
                        
                        <p class="text-sm text-gray-600 flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                            </svg>
                            ${meeting.location_type === 'online' ? '🔗 Online' : '🏢 '} ${meeting.location || 'Chưa xác định'}
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center space-x-4">
                    <div class="flex items-center text-sm text-gray-500">
                        <svg class="w-4 h-4 mr-1 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                        </svg>
                        ${meeting.organizer}
                    </div>
                    <div class="flex items-center text-sm text-gray-500">
                        <svg class="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        ${meeting.participants?.length || 0} người
                    </div>
                </div>
                
                <div class="flex space-x-2">
                    <button onclick="showMeetingDetail('${meeting.id}')" 
                            class="btn-secondary px-4 py-2 text-sm rounded-lg flex items-center space-x-1">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                        <span>Xem</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusClass(status) {
    const classes = {
        'draft': 'status-scheduled',
        'scheduled': 'status-scheduled',
        'in_progress': 'status-in-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-scheduled';
}

function getStatusText(status) {
    const texts = {
        'draft': 'Bản nháp',
        'scheduled': 'Đã lên lịch',
        'in_progress': 'Đang diễn ra',
        'completed': 'Đã hoàn thành',
        'cancelled': 'Đã hủy'
    };
    return texts[status] || status;
}

async function showMeetingDetail(meetingId) {
    console.log('Showing meeting detail:', meetingId);
    
    try {
        // Demo data
        const meeting = {
            id: meetingId,
            title: 'Họp triển khai dự án Q2',
            description: 'Thảo luận về kế hoạch triển khai dự án quý 2 với các bộ phận liên quan',
            start_time: new Date(new Date().setHours(10, 0)).toISOString(),
            end_time: new Date(new Date().setHours(11, 30)).toISOString(),
            location_type: 'physical',
            location: 'Phòng họp A1, Tầng 5',
            organizer: 'Nguyễn Văn A',
            participants: [
                { name: 'Nguyễn Văn A', role: 'Trưởng phòng' },
                { name: 'Trần Thị B', role: 'Thành viên' },
                { name: 'Lê Văn C', role: 'Kế toán' }
            ],
            status: 'scheduled',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        showMeetingModal(meeting);
    } catch (error) {
        showAlert('❌ Lỗi: ' + error.message, 'danger');
    }
}

function showMeetingModal(meeting) {
    const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" id="meeting-modal">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                                <img src="/static/logo/logo.png" alt="Logo" class="w-6 h-6 object-contain">
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-900">${meeting.title}</h3>
                                <p class="text-sm text-gray-600">Chi tiết cuộc họp</p>
                            </div>
                        </div>
                        <button onclick="closeMeetingModal()" 
                                class="text-gray-400 hover:text-gray-600 text-2xl hover:rotate-90 transition-transform">
                            &times;
                        </button>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6">
                    <!-- Meeting details... -->
                    <div class="mb-6">
                        <p class="text-gray-700">${meeting.description}</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-semibold text-blue-800 mb-2">Thời gian</h4>
                            <p><strong>Bắt đầu:</strong> ${new Date(meeting.start_time).toLocaleString('vi-VN')}</p>
                            <p><strong>Kết thúc:</strong> ${new Date(meeting.end_time).toLocaleString('vi-VN')}</p>
                        </div>
                        <div class="bg-green-50 p-4 rounded-lg">
                            <h4 class="font-semibold text-green-800 mb-2">Địa điểm</h4>
                            <p><strong>Loại:</strong> ${meeting.location_type === 'online' ? 'Online' : 'Trực tiếp'}</p>
                            <p><strong>Địa điểm:</strong> ${meeting.location}</p>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <h4 class="font-semibold text-gray-800 mb-2">Người tham dự (${meeting.participants?.length || 0})</h4>
                        <div class="space-y-2">
                            ${meeting.participants?.map(p => `
                                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span>${p.name}</span>
                                    <span class="text-sm text-gray-600">${p.role || 'Thành viên'}</span>
                                </div>
                            `).join('') || '<p class="text-gray-500">Chưa có người tham dự</p>'}
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-gray-500">
                            Tạo: ${new Date(meeting.created_at).toLocaleDateString('vi-VN')}
                        </div>
                        <div class="flex space-x-3">
                            <button onclick="closeMeetingModal()"
                                    class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('meeting-modal');
    if (existingModal) existingModal.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeMeetingModal() {
    const modal = document.getElementById('meeting-modal');
    if (modal) modal.remove();
}

// --- ORIGINAL FUNCTIONS (KEEP THESE) ---

async function checkMicrophoneAccess() {
    micStatusEl.textContent = 'Đang kiểm tra Microphone...';
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStatusEl.textContent = 'Microphone đã sẵn sàng. Nhấn Bắt đầu Ghi.';
        startRecordBtn.disabled = false;
    } catch (err) {
        micStatusEl.textContent = 'Lỗi: Không thể truy cập Microphone. Vui lòng cấp quyền.';
        startRecordBtn.disabled = true;
        showAlert('Không thể truy cập Microphone. Vui lòng kiểm tra quyền truy cập.', 'danger');
    }
}

function startRecording() {
    audioChunks = [];
    recorder = new MediaRecorder(mediaStream);

    recorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    recorder.onstop = () => {
        const mimeType = recorder.mimeType.split(';')[0];
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        
        const recordedFile = new File([audioBlob], `ghi_am_${Date.now()}.webm`, { type: mimeType, lastModified: Date.now() });

        processRecordedFile(recordedFile);

        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordingIndicator.classList.add('hidden');
        recordingTimeEl.textContent = '00:00';
        micStatusEl.textContent = 'Ghi âm đã hoàn thành. Đang chuyển file để phiên âm.';
        recordingMessageEl.classList.add('hidden');
    };

    recorder.start();
    recordingStartTime = Date.now();
    recordingTimer = setInterval(updateRecordingTime, 1000);

    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    recordingIndicator.classList.remove('hidden');
    micStatusEl.textContent = 'Đang Ghi...';
    recordingMessageEl.classList.remove('hidden');
    recordingMessageEl.textContent = 'Nhấn "Dừng Ghi" khi bạn nói xong.';
}

function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        clearInterval(recordingTimer);
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
    
    switchInputTab('upload');

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    transcriptionOptions.classList.remove('hidden');
    
    const fileURL = URL.createObjectURL(file);
    audioPreview.src = fileURL;

    showAlert('Ghi âm hoàn tất! Tự động bắt đầu phiên âm...', 'success');
    startTranscription();
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processSelectedFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('border-indigo-500', 'bg-indigo-100');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('border-indigo-500', 'bg-indigo-100');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('border-indigo-500', 'bg-indigo-100');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        processSelectedFile(file);
    } else {
        showAlert('Vui lòng chọn một file audio hợp lệ.', 'danger');
    }
}

function processSelectedFile(file) {
    selectedFile = file;
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    transcriptionOptions.classList.remove('hidden');
    
    const fileURL = URL.createObjectURL(file);
    audioPreview.src = fileURL;

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

function resetFileUpload() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    transcriptionOptions.classList.add('hidden');
    audioPreview.src = '';
    transcriptionProgress.classList.add('hidden');
    transcriptionResult.classList.add('hidden');

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = true;
    micStatusEl.textContent = 'Sẵn sàng ghi âm. Vui lòng cấp quyền Microphone.';
    recordingTimeEl.textContent = '00:00';
    recordingMessageEl.classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function startTranscription() {
    if (!selectedFile) {
        showAlert('Vui lòng chọn hoặc ghi âm một file audio trước.', 'warning');
        return;
    }

    try {
        transcriptionResult.classList.add('hidden');
        transcriptionProgress.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Đang Tải lên file...';
        
        // Simulate transcription process
        progressBar.style.width = '30%';
        progressStatus.textContent = 'Đang xử lý audio...';
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        progressBar.style.width = '60%';
        progressStatus.textContent = 'Đang phiên âm...';
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        progressBar.style.width = '90%';
        progressStatus.textContent = 'Đang hoàn thiện kết quả...';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        progressBar.style.width = '100%';
        progressStatus.textContent = 'Phiên âm hoàn thành!';
        
        // Show demo results
        setTimeout(() => {
            transcriptionProgress.classList.add('hidden');
            transcriptionResult.classList.remove('hidden');
            
            // Demo transcription data
            const demoData = {
                language: 'vi',
                language_probability: 0.95,
                processing_time: 2.5,
                audio_duration: 120.5,
                segments: [
                    {
                        start: 0,
                        end: 10.5,
                        text: "Xin chào mọi người, hôm nay chúng ta sẽ thảo luận về dự án mới."
                    },
                    {
                        start: 10.5,
                        end: 25.2,
                        text: "Dự án này nhằm mục đích cải thiện trải nghiệm người dùng trên nền tảng của chúng ta."
                    },
                    {
                        start: 25.2,
                        end: 45.8,
                        text: "Chúng ta cần tập trung vào ba yếu tố chính: giao diện người dùng, tốc độ tải trang và tính năng mới."
                    }
                ]
            };
            
            displayTranscriptionResults(demoData);
        }, 500);
        
    } catch (error) {
        console.error('Transcription error:', error);
        showAlert(`Lỗi: ${error.message}`, 'danger');
        progressStatus.textContent = 'Lỗi: ' + error.message;
    }
}

function displayTranscriptionResults(result) {
    modelInfo.textContent = document.getElementById('model-size').value + 
        ' (' + document.getElementById('device').value + ', ' + 
        document.getElementById('compute-type').value + ')';
    
    detectedLanguage.textContent = getLanguageName(result.language) + ' (' + result.language + ')';
    languageProbability.textContent = (result.language_probability * 100).toFixed(2) + '%';
    processingTime.textContent = result.processing_time.toFixed(2) + ' giây';
    audioDuration.textContent = formatTime(result.audio_duration) + ' (' + result.audio_duration.toFixed(2) + ' giây)';
    
    let fullText = '';
    result.segments.forEach(segment => {
        fullText += segment.text + ' ';
    });
    fullTranscript.textContent = fullText.trim();
    
    segmentsContainer.innerHTML = '';
    result.segments.forEach(segment => {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'segment-item p-4 rounded-lg mb-4';
        
        const timeEl = document.createElement('p');
        timeEl.className = 'segment-time inline-block mb-2';
        timeEl.textContent = `${formatTime(segment.start)} → ${formatTime(segment.end)}`;
        
        const textEl = document.createElement('p');
        textEl.className = 'text-gray-700';
        textEl.textContent = segment.text;
        
        segmentEl.appendChild(timeEl);
        segmentEl.appendChild(textEl);
        segmentsContainer.appendChild(segmentEl);
    });
}

async function generateSummary() {
    if (!fullTranscript.textContent.trim()) {
        showAlert('Không có văn bản để tóm tắt.', 'warning');
        return;
    }

    try {
        summarizeBtn.disabled = true;
        summarizeBtn.innerHTML = '<span class="flex items-center space-x-2"><span class="animate-spin">⟳</span><span>Đang tóm tắt...</span></span>';
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const demoSummary = "Cuộc họp thảo luận về dự án mới nhằm cải thiện trải nghiệm người dùng. Trọng tâm là ba yếu tố: giao diện người dùng, tốc độ tải trang và tính năng mới. Cần có kế hoạch cụ thể cho từng mục tiêu.";
        
        summaryContent.innerHTML = `
            <div class="bg-white p-4 rounded-lg border border-green-200">
                <h3 class="font-semibold text-green-700 mb-2">Bản Tóm Tắt:</h3>
                <p class="text-gray-700 leading-relaxed">${demoSummary}</p>
            </div>
        `;

        switchResultTab('summary');
        
        showAlert('Tóm tắt hoàn thành!', 'success');

    } catch (error) {
        console.error('Lỗi tóm tắt:', error);
        summaryContent.innerHTML = `<p class="text-red-600">Lỗi khi tạo tóm tắt: ${error.message}</p>`;
        showAlert('Lỗi khi tạo tóm tắt: ' + error.message, 'danger');
    } finally {
        summarizeBtn.disabled = false;
        summarizeBtn.innerHTML = '<span class="flex items-center space-x-2"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg><span>Tóm Tắt</span></span>';
    }
}

// --- Utility Functions ---
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
        'ru': 'Russian',
        'pt': 'Portuguese',
        'it': 'Italian',
        'nl': 'Dutch',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'th': 'Thai',
        'id': 'Indonesian',
    };
    
    return languages[code] || code;
}

function downloadTranscript(format) {
    if (!fullTranscript.textContent.trim()) {
        showAlert('Không có dữ liệu phiên âm để tải về', 'warning');
        return;
    }
    
    let content = '';
    let filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;
    
    // Demo data for download
    const demoData = {
        language: 'vi',
        text: fullTranscript.textContent,
        timestamp: new Date().toISOString()
    };
    
    switch (format) {
        case 'txt':
            content = `Phiên âm văn bản\nNgày: ${new Date().toLocaleString('vi-VN')}\n\n${fullTranscript.textContent}`;
            break;
            
        case 'srt':
            content = `1\n00:00:00,000 --> 00:00:10,500\nXin chào mọi người, hôm nay chúng ta sẽ thảo luận về dự án mới.\n\n2\n00:00:10,500 --> 00:00:25,200\nDự án này nhằm mục đích cải thiện trải nghiệm người dùng trên nền tảng của chúng ta.\n\n3\n00:00:25,200 --> 00:00:45,800\nChúng ta cần tập trung vào ba yếu tố chính: giao diện người dùng, tốc độ tải trang và tính năng mới.`;
            break;
            
        case 'json':
            content = JSON.stringify(demoData, null, 2);
            break;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert(`Đã tải xuống file ${filename}`, 'success');
}

function showAlert(message, type) {
    // Remove existing alerts
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${getAlertIcon(type)}</span>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.querySelector('.max-w-7xl');
    if (container) {
        container.insertBefore(alertEl, container.firstChild);
    } else {
        document.body.insertBefore(alertEl, document.body.firstChild);
    }
    
    setTimeout(() => {
        if (alertEl.parentNode) {
            alertEl.remove();
        }
    }, 5000);
}

function getAlertIcon(type) {
    const icons = {
        'success': '✅',
        'danger': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

function initializeLogo() {
    const logo = new Image();
    logo.src = '/static/logo/logo.png';
    logo.onload = () => {
        console.log('Logo đã tải thành công');
    };
    logo.onerror = () => {
        console.warn('Không thể tải logo, sử dụng fallback');
    };
}