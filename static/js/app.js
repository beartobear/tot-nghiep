// DOM Elements
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

// Global variables
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

// API Base URL
const API_BASE_URL = 'http://localhost:8000';

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
    
    // Initialize toggle switches
    initializeToggleSwitches();
    
    // Set default datetime for meeting form
    setDefaultMeetingTimes();
    updateLocationPlaceholder();
    
    console.log('Application initialized successfully');
});

// --- Tab switching functions ---
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
            const startTime = new Date(info.date);
            startTime.setHours(10, 0, 0);
            const endTime = new Date(info.date);
            endTime.setHours(11, 0, 0);
            
            meetingStart.value = startTime.toISOString().slice(0, 16);
            meetingEnd.value = endTime.toISOString().slice(0, 16);
            
            meetingTitle.focus();
            showAlert('Đã điền thời gian tự động!', 'success');
        },
        height: 600,
        editable: false,
        selectable: true
    });
    
    calendar.render();
    loadCalendarEvents();
}

async function loadCalendarEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/meetings/calendar?start=${new Date().toISOString()}&end=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}`);
        
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
                    borderColor: event.color
                });
            });
        }
    } catch (error) {
        console.error('Error loading calendar events:', error);
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
    meetingLocation.placeholder = isOnline ? 'https://meet.google.com/xxx-yyyy-zzz' : 'Phòng A1, Tầng 5';
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
    
    try {
        showAlert('⏳ Đang tạo cuộc họp...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/meetings`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(meetingData)
        });
        
        if (response.ok) {
            showAlert('✅ Đã tạo cuộc họp thành công!', 'success');
            
            // Reset form
            meetingForm.reset();
            currentParticipants = [];
            setDefaultMeetingTimes();
            
            // Refresh calendar and list
            await loadMeetingsList();
            await loadCalendarEvents();
        } else {
            throw new Error('Lỗi tạo cuộc họp');
        }
    } catch (error) {
        console.error('Error creating meeting:', error);
        showAlert('❌ Lỗi: ' + error.message, 'danger');
    }
}

function addParticipant() {
    const name = prompt('Nhập tên người tham dự:');
    if (!name) return;
    
    const role = prompt('Vai trò (tuỳ chọn):');
    
    currentParticipants.push({
        name: name,
        role: role || null,
        is_required: true
    });
    
    showAlert(`Đã thêm ${name} vào danh sách tham dự`, 'success');
}

async function loadMeetingsList() {
    console.log('Loading meetings list...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/meetings`);
        
        if (response.ok) {
            const meetings = await response.json();
            displayMeetingsList(meetings);
            
            // Update stats
            statsTotal.textContent = meetings.length;
            const upcoming = meetings.filter(m => 
                new Date(m.start_time) > new Date() && m.status === 'scheduled'
            ).length;
            statsUpcoming.textContent = upcoming;
        } else {
            throw new Error('Không thể tải danh sách cuộc họp');
        }
    } catch (error) {
        console.error('Lỗi tải danh sách cuộc họp:', error);
        meetingsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>Không có cuộc họp nào</p>
            </div>
        `;
    }
}

function displayMeetingsList(meetings) {
    if (!meetings || meetings.length === 0) {
        meetingsList.innerHTML = `
            <div class="text-center py-12">
                <div class="w-20 h-20 mx-auto mb-4 text-gray-300">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h4 class="text-lg font-medium text-gray-700 mb-2">Chưa có cuộc họp nào</h4>
                <p class="text-gray-500 mb-6">Hãy tạo cuộc họp đầu tiên của bạn!</p>
            </div>
        `;
        return;
    }
    
    meetingsList.innerHTML = meetings.map(meeting => `
        <div class="glass-effect p-5 rounded-xl hover-lift cursor-pointer">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center mb-3">
                        <span class="status-badge ${getStatusClass(meeting.status)}">
                            ${getStatusText(meeting.status)}
                        </span>
                    </div>
                    
                    <h4 class="font-semibold text-lg text-gray-900 mb-2">${meeting.title}</h4>
                    
                    <div class="space-y-2">
                        <p class="text-sm text-gray-600">
                            <strong>Thời gian:</strong> ${new Date(meeting.start_time).toLocaleString('vi-VN')}
                        </p>
                        
                        <p class="text-sm text-gray-600">
                            <strong>Địa điểm:</strong> ${meeting.location_type === 'online' ? '🔗 Online' : '🏢 '} ${meeting.location || 'Chưa xác định'}
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <div class="text-sm text-gray-500">
                    <strong>Chủ trì:</strong> ${meeting.organizer}
                </div>
                
                <div class="flex space-x-2">
                    <button onclick="showMeetingDetail('${meeting.id}')" 
                            class="btn-secondary px-4 py-2 text-sm rounded-lg">
                        Xem
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function showMeetingDetail(meetingId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`);
        
        if (response.ok) {
            const meeting = await response.json();
            alert(`Chi tiết cuộc họp:\n\nTiêu đề: ${meeting.title}\nThời gian: ${new Date(meeting.start_time).toLocaleString('vi-VN')}\nĐịa điểm: ${meeting.location}\nChủ trì: ${meeting.organizer}`);
        }
    } catch (error) {
        showAlert('❌ Lỗi: ' + error.message, 'danger');
    }
}

function getStatusClass(status) {
    const classes = {
        'scheduled': 'status-scheduled',
        'in_progress': 'status-in-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-scheduled';
}

function getStatusText(status) {
    const texts = {
        'scheduled': 'Đã lên lịch',
        'in_progress': 'Đang diễn ra',
        'completed': 'Đã hoàn thành',
        'cancelled': 'Đã hủy'
    };
    return texts[status] || status;
}

// --- RECORDING FUNCTIONS ---
async function checkMicrophoneAccess() {
    micStatusEl.textContent = 'Đang kiểm tra Microphone...';
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStatusEl.textContent = 'Microphone đã sẵn sàng';
        startRecordBtn.disabled = false;
    } catch (err) {
        micStatusEl.textContent = 'Lỗi: Không thể truy cập Microphone';
        startRecordBtn.disabled = true;
        showAlert('Không thể truy cập Microphone', 'danger');
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
        
        const recordedFile = new File([audioBlob], `ghi_am_${Date.now()}.webm`, { 
            type: mimeType, 
            lastModified: Date.now() 
        });

        processRecordedFile(recordedFile);

        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordingIndicator.classList.add('hidden');
        recordingTimeEl.textContent = '00:00';
        micStatusEl.textContent = 'Ghi âm hoàn thành';
        recordingMessageEl.classList.add('hidden');
    };

    recorder.start();
    recordingStartTime = Date.now();
    recordingTimer = setInterval(updateRecordingTime, 1000);

    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    recordingIndicator.classList.remove('hidden');
    micStatusEl.textContent = 'Đang ghi âm...';
    recordingMessageEl.classList.remove('hidden');
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

    showAlert('Ghi âm hoàn tất! Sẵn sàng phiên âm.', 'success');
}

// --- TRANSCRIPTION FUNCTIONS (REAL API CALLS) ---
async function startTranscription() {
    if (!selectedFile) {
        showAlert('Vui lòng chọn hoặc ghi âm một file audio trước.', 'warning');
        return;
    }

    try {
        // Hide result, show progress
        transcriptionResult.classList.add('hidden');
        transcriptionProgress.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Đang tải lên file...';
        
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
        
        // Show uploading progress
        progressBar.style.width = '30%';
        progressStatus.textContent = 'Đang upload file audio...';
        
        // Call API to start transcription
        console.log('Starting transcription...');
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
                } catch (e2) {
                    // keep default
                }
            }

            throw new Error(errMsg);
        }
        
        progressBar.style.width = '50%';
        progressStatus.textContent = 'Đang xử lý...';
        
        const task = await response.json();
        currentTaskId = task.id;
        
        console.log(`Transcription task started: ${task.id}`);
        
        // Start polling for results
        pollTranscriptionResult(task.id);
        
    } catch (error) {
        console.error('Transcription error:', error);
        showAlert(`Lỗi: ${error.message}`, 'danger');
        progressStatus.textContent = 'Lỗi: ' + error.message;
    }
}

async function pollTranscriptionResult(taskId) {
    console.log(`Polling for task: ${taskId}`);
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
            
            if (!response.ok) {
                throw new Error('Không thể lấy trạng thái task');
            }
            
            const task = await response.json();
            console.log(`Task status: ${task.status}`);
            
            // Update progress
            if (task.status === 'processing') {
                progressBar.style.width = '70%';
                progressStatus.textContent = 'Đang phiên âm...';
            }
            
            // Handle completed task
            if (task.status === 'completed') {
                clearInterval(pollingInterval);
                
                progressBar.style.width = '100%';
                progressStatus.textContent = 'Phiên âm hoàn thành!';
                
                // Wait a moment then show results
                setTimeout(() => {
                    transcriptionProgress.classList.add('hidden');
                    transcriptionResult.classList.remove('hidden');
                    
                    // Display actual results from backend
                    displayTranscriptionResults(task.result);
                    transcriptionData = task.result;
                    
                    showAlert('✅ Phiên âm thành công!', 'success');
                }, 500);
            }
            
            // Handle failed task
            if (task.status === 'failed') {
                clearInterval(pollingInterval);
                const errorText = task.error || 'Không rõ lỗi';
                // Keep the progress visible and show detailed error so user can see it
                progressBar.style.width = '0%';
                progressStatus.textContent = `❌ Phiên âm thất bại: ${errorText}`;
                showAlert(`❌ Phiên âm thất bại: ${errorText}`, 'danger');
                // Do not immediately hide the progress UI so user can read the error
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            clearInterval(pollingInterval);
            showAlert('Lỗi kiểm tra trạng thái phiên âm', 'danger');
            transcriptionProgress.classList.add('hidden');
        }
    }, 2000); // Poll every 2 seconds
}

function displayTranscriptionResults(result) {
    if (!result) {
        showAlert('Không có dữ liệu phiên âm', 'warning');
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
    
    // Display segments with timestamps
    segmentsContainer.innerHTML = '';
    if (result.segments && result.segments.length > 0) {
        result.segments.forEach((segment, index) => {
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
}

async function generateSummary() {
    if (!fullTranscript.textContent.trim()) {
        showAlert('Không có văn bản để tóm tắt.', 'warning');
        return;
    }

    try {
        summarizeBtn.disabled = true;
        summarizeBtn.innerHTML = '<span class="animate-spin">⟳</span> Đang tóm tắt...';
        
        // Call actual summarization API
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
                <div class="bg-white p-4 rounded-lg border border-green-200">
                    <h3 class="font-semibold text-green-700 mb-2">Bản Tóm Tắt:</h3>
                    <p class="text-gray-700 leading-relaxed">${result.summary}</p>
                </div>
            `;

            switchResultTab('summary');
            showAlert('Tóm tắt hoàn thành!', 'success');
        } else {
            throw new Error('Lỗi tạo tóm tắt');
        }
    } catch (error) {
        console.error('Lỗi tóm tắt:', error);
        summaryContent.innerHTML = `<p class="text-red-600">Lỗi khi tạo tóm tắt</p>`;
        showAlert('Lỗi khi tạo tóm tắt', 'danger');
    } finally {
        summarizeBtn.disabled = false;
        summarizeBtn.innerHTML = 'Tóm Tắt';
    }
}

// --- FILE HANDLING FUNCTIONS ---
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
    micStatusEl.textContent = 'Sẵn sàng ghi âm';
    recordingTimeEl.textContent = '00:00';
    recordingMessageEl.classList.add('hidden');
    
    // Clear any polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// --- UTILITY FUNCTIONS ---
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
    const ms = Math.floor((seconds % 1) * 1000);
    
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
        'ja': 'Japanese'
    };
    
    return languages[code] || code;
}

function downloadTranscript(format) {
    if (!transcriptionData || !fullTranscript.textContent.trim()) {
        showAlert('Không có dữ liệu phiên âm để tải về', 'warning');
        return;
    }
    
    let content = '';
    let filename = `transcript_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;
    
    switch (format) {
        case 'txt':
            content = `Phiên âm văn bản\nNgày: ${new Date().toLocaleString('vi-VN')}\nNgôn ngữ: ${transcriptionData.language}\n\n${fullTranscript.textContent}`;
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
        showAlert('Không thể tạo file', 'warning');
        return;
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
    
    showAlert(`Đã tải xuống: ${filename}`, 'success');
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
        <div class="flex items-center">
            <span class="mr-2">${getAlertIcon(type)}</span>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.querySelector('.max-w-7xl');
    if (container) {
        container.insertBefore(alertEl, container.firstChild);
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