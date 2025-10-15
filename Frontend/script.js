// ===== State Management & Global Variables =====
let conversationHistory = [];
let questionCount = 0;
const MAX_QUESTIONS = 7;
let currentUser = null;


// ===== Element Selectors =====
const splash = document.getElementById("splash");
const mainContainer = document.getElementById("main-container");
const resultCard = document.getElementById("result-card");
const resultContent = document.getElementById("result-content");
const inputArea = document.getElementById("input-area");
const progressIndicator = document.getElementById("progress-indicator");
const inputCard = document.getElementById("input-card");
const appHeader = document.getElementById("app-header");
const historyCard = document.getElementById("history-card");
const homeBtn = document.getElementById("home-btn");
const historyBtn = document.getElementById("history-btn");
const profileBtn = document.getElementById('profile-btn');
const profileCard = document.getElementById('profile-card');
const historyContentArea = document.getElementById("history-content-area");
const loginCard = document.getElementById('login-card');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const readAloudBtn = document.getElementById('read-aloud-btn');
const startOverLink = document.getElementById('start-over-link');


// ===== Authentication Functions =====
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginCard.style.display = 'none';
        inputCard.classList.remove('hidden');
        appHeader.classList.remove('hidden');
        startConversation();
    } else {
        currentUser = null;
        loginCard.style.display = 'flex';
        inputCard.classList.add('hidden');
        resultCard.style.display = 'none';
        historyCard.style.display = 'none';
        profileCard.style.display = 'none';
        appHeader.classList.add('hidden');
        mainContainer.classList.remove('results-visible');
        readAloudBtn.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return alert("Please enter email and password.");
    firebase.auth().signInWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
});

registerBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return alert("Please enter email and password.");
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
});


// ===== Core Functions =====

function startConversation() {
    questionCount = 0;
    conversationHistory = [];
    renderInitialQuestion();
}

function renderInitialQuestion() {
    progressIndicator.innerHTML = `<div id="progress-bar" style="width: 0%"></div>`;
    inputArea.innerHTML = `
        <p class="question-text">What is the main symptom you're experiencing today?</p>
        <textarea class="dynamic-input" id="symptom-input" placeholder="e.g., Headache, Stomach Pain, Cough..." style="height: 80px;"></textarea>
        <button id="next-btn">Next</button>
    `;

    const textInput = document.getElementById('symptom-input');
    document.getElementById('next-btn').onclick = () => {
        const symptom = textInput.value.trim();
        if (symptom === '') {
            alert('Please provide a symptom.');
            return;
        }
        handleAnswer(symptom);
    };
    textInput.focus();
}

async function handleAnswer(answer) {
    conversationHistory.push({ role: 'user', parts: [{ text: answer }] });
    questionCount++;
    
    progressIndicator.innerHTML = `<div id="progress-bar" style="width: ${(questionCount / MAX_QUESTIONS) * 100}%"></div>`;
    inputArea.classList.add('fade-out');

    setTimeout(async () => {
        inputArea.classList.remove('fade-out');
        if (questionCount >= MAX_QUESTIONS) {
            assembleAndAnalyze();
        } else {
            await fetchNextQuestion();
        }
    }, 300);
}

async function fetchNextQuestion() {
    inputArea.innerHTML = `<p class="question-text">Thinking of the next question...</p>`;

    try {
        const firstSymptom = questionCount === 1 ? conversationHistory[0].parts[0].text : null;
        const response = await fetch("http://localhost:5000/api/generate-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                history: conversationHistory,
                firstSymptom: firstSymptom
            }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const nextQuestion = data.nextQuestion;

        if (nextQuestion === "INVALID_SYMPTOM") {
            inputArea.innerHTML = `
                <p class="question-text">Sorry, I can't help you with that. If you have a medical issue, feel free to ask me.</p>
                <button id="restart-flow">Start Over</button>
            `;
            document.getElementById('restart-flow').onclick = resetSymptomChecker;
            return;
        }
        
        if (nextQuestion === "ANALYSIS_READY") {
            assembleAndAnalyze();
            return;
        }

        conversationHistory.push({ role: 'model', parts: [{ text: nextQuestion }] });
        renderDynamicQuestion(nextQuestion);

    } catch (err) {
        inputArea.innerHTML = `<p class="question-text">⚠️ Error: Could not generate the next question. Please try again.</p><button id="restart-flow">Start Over</button>`;
        document.getElementById('restart-flow').onclick = resetSymptomChecker;
        console.error("Error fetching next question:", err);
    }
}

function renderDynamicQuestion(question) {
    inputArea.innerHTML = `
        <p class="question-text">${question}</p>
        <textarea class="dynamic-input" id="answer-input" placeholder="Provide details here..." style="height: 80px;"></textarea>
        <button id="next-btn">Next</button>
    `;

    const textInput = document.getElementById('answer-input');
    document.getElementById('next-btn').onclick = () => {
        const answer = textInput.value.trim();
        if (answer === '') {
            alert('Please provide an answer.');
            return;
        }
        handleAnswer(answer);
    };
    textInput.focus();
}

function resetSymptomChecker() {
    mainContainer.classList.remove('results-visible');
    resultCard.style.display = 'none';
    inputCard.classList.remove('hidden');
    if (!homeBtn.classList.contains('active')) {
        homeBtn.click();
    }
    window.speechSynthesis.cancel();
    readAloudBtn.innerHTML = '🔊 Read Aloud';
    readAloudBtn.style.display = 'none';
    startConversation();
}

function assembleAndAnalyze() {
    progressIndicator.innerHTML = `<div id="progress-bar" style="width: 100%"></div>`;
    inputArea.innerHTML = `<p class="question-text">Thank you. Assembling your information for analysis...</p>`;
    readAloudBtn.style.display = 'none';
    window.speechSynthesis.cancel();
    handleBackendAnalysis();
}

function formatAIResponse(text) {
    if (text.startsWith("Sorry, I cant help you")) {
        return `<p class="output-paragraph">${text}</p>`;
    }

    const intro = (text.match(/###empathetic_intro###(.*?)###summary###/s) || [])[1]?.trim();
    const summary = (text.match(/###summary###(.*?)###possible_causes###/s) || [])[1]?.trim();
    const causes = (text.match(/###possible_causes###(.*?)###home_care_plan###/s) || [])[1]?.trim();
    const plan = (text.match(/###home_care_plan###(.*?)###when_to_see_a_doctor###/s) || [])[1]?.trim();
    const seeDoctor = (text.match(/###when_to_see_a_doctor###(.*?)###disclaimer###/s) || [])[1]?.trim();
    const disclaimer = (text.match(/###disclaimer###(.*?)$/s) || [])[1]?.trim();

    let html = '';

    if (intro) html += `<p class="output-paragraph">${intro.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    if (summary) {
        html += `<h4 class="output-heading">Symptom Summary</h4>`;
        html += `<p class="output-paragraph">${summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    }
    if (causes) {
        html += `<h4 class="output-heading">Possible Causes</h4>`;
        causes.split('\n').filter(line => line.trim().startsWith('*')).forEach(line => {
            const content = line.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<p class="output-bullet">${content}</p>`;
        });
    }
    if (plan) {
        html += `<h4 class="output-heading">Home Care Plan</h4>`;
        plan.split('\n').filter(line => line.trim().startsWith('*')).forEach(line => {
            const content = line.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<p class="output-bullet">${content}</p>`;
        });
    }
    if (seeDoctor) {
        html += `<h4 class="output-heading">When to Seek Medical Attention</h4>`;
        seeDoctor.split('\n').filter(line => line.trim().startsWith('*')).forEach(line => {
            const content = line.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<p class="output-bullet">${content}</p>`;
        });
    }
    if (disclaimer) html += `<p class="output-disclaimer"><strong>Disclaimer:</strong> ${disclaimer}</p>`;
    
    return html;
}

async function handleBackendAnalysis() {
    resultContent.innerHTML = `<div class="skeleton-line"></div> <div class="skeleton-line"></div> <div class="skeleton-line short"></div>`;
    resultCard.style.display = 'flex';
    mainContainer.classList.add("results-visible");

    let profileData = {}; 
    try {
        const profileRes = await fetch(`http://localhost:5000/api/profile/${currentUser.uid}`);
        if (profileRes.ok) {
            profileData = await profileRes.json();
        }
    } catch (error) {
        console.log("No profile data to add to context, proceeding without it.");
    }

    try {
        if (!currentUser) throw new Error("You must be logged in to get an analysis.");

        const response = await fetch("http://localhost:5000/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                conversationHistory,
                userId: currentUser.uid,
                age: profileData.age, 
                gender: profileData.gender 
            }),
        });
      
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      
        resultContent.innerHTML = formatAIResponse(data.result);
        readAloudBtn.style.display = 'inline-block';
    } catch (err) {
        resultContent.innerHTML = `⚠️ Error: Failed to get a response. Please try again. <br><br> <small>${err.message}</small>`;
        readAloudBtn.style.display = 'none';
    }
}

async function fetchAndDisplayHistory() {
    if (!currentUser) {
        historyContentArea.innerHTML = "<p>Please log in to see your history.</p>";
        return;
    }
    historyContentArea.innerHTML = "<p>Loading history...</p>";
    try {
        const response = await fetch(`http://localhost:5000/api/history/${currentUser.uid}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const historyList = await response.json();

        if (historyList.length === 0) {
            historyContentArea.innerHTML = "<p style='text-align: center; padding: 2rem;'>No history found.</p>";
            return;
        }

        let historyHTML = '';
        historyList.forEach(item => {
            const date = item.timestamp ? new Date(item.timestamp._seconds * 1000).toLocaleString() : 'Date not available';
            historyHTML += `
                <div class="history-item" data-id="${item.id}">
                    <div class="history-item-header">
                        <p><strong>Symptoms:</strong> ${item.symptoms}</p>
                        <button class="delete-btn" data-id="${item.id}">🗑️ Delete</button>
                    </div>
                    <small><strong>Date:</strong> ${date}</small>
                    <details style="margin-top: 0.5rem;">
                        <summary>View Analysis</summary>
                        <div class="analysis-content">
                            ${formatAIResponse(item.result)}
                        </div>
                    </details>
                </div>
            `;
        });
        historyContentArea.innerHTML = historyHTML;

    } catch (err) {
        historyContentArea.innerHTML = `<p>⚠️ Error fetching history: ${err.message}</p>`;
    }
}

function speakText(textToSpeak) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.onstart = () => { readAloudBtn.innerHTML = '⏹️ Stop Reading'; };
    utterance.onend = () => { readAloudBtn.innerHTML = '🔊 Read Aloud'; };
    window.speechSynthesis.speak(utterance);
}

// ===== Event Listeners =====
// --- CORRECTED FUNCTION ---
readAloudBtn.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
        // If speaking, cancel the speech...
        window.speechSynthesis.cancel();
        // ...and manually reset the button text immediately.
        readAloudBtn.innerHTML = '🔊 Read Aloud';
    } else {
        // If not speaking, get the text and start reading.
        const resultText = resultContent.innerText;
        if (resultText) {
            speakText(resultText);
        }
    }
});

startOverLink.addEventListener('click', (event) => {
    event.preventDefault();
    resetSymptomChecker();
});

historyContentArea.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-btn')) {
        const docId = event.target.dataset.id;
        if (confirm('Are you sure you want to permanently delete this report?')) {
            try {
                const response = await fetch(`http://localhost:5000/api/history/${currentUser.uid}/${docId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Server responded with an error.');
                event.target.closest('.history-item').remove();
            } catch (err) {
                alert('Could not delete the report. Please try again.');
            }
        }
    }
});

homeBtn.addEventListener('click', () => {
    historyBtn.classList.remove('active');
    homeBtn.classList.add('active');
    historyCard.style.display = 'none';
    profileCard.style.display = 'none';
    inputCard.classList.remove('hidden');
    if (mainContainer.classList.contains('results-visible')) {
        resultCard.style.display = 'flex';
    }
});

historyBtn.addEventListener('click', () => {
    homeBtn.classList.remove('active');
    historyBtn.classList.add('active');
    inputCard.classList.add('hidden');
    resultCard.style.display = 'none';
    profileCard.style.display = 'none';
    historyCard.style.display = 'flex';
    fetchAndDisplayHistory();
});

profileBtn.addEventListener('click', async () => {
    homeBtn.classList.remove('active');
    historyBtn.classList.remove('active');
    inputCard.classList.add('hidden');
    resultCard.style.display = 'none';
    historyCard.style.display = 'none';
    profileCard.style.display = 'flex';
    const profileContentArea = document.getElementById('profile-content-area');
    profileContentArea.innerHTML = "<p style='padding: 2rem; text-align: center;'>Loading profile...</p>";

    if (currentUser) {
        profileContentArea.innerHTML = `
            <div class="profile-details" style="padding: 1.5rem;">
                <p>Logged in as: <strong>${currentUser.email}</strong></p>
            </div>
            <div class="input-area">
                <input type="text" id="name-input" class="dynamic-input" placeholder="Name" style="height: 50px;">
                <input type="number" id="age-input" class="dynamic-input" placeholder="Age" style="height: 50px;">
                <select id="gender-select" class="dynamic-input" style="height: 50px;">
                    <option value="">Select Gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div style="padding: 0 1.5rem 1.5rem;">
                <button id="save-profile-btn">Save Profile</button>
                <button id="logout-btn" style="margin-top: 1rem;" class="secondary-btn">Logout</button>
            </div>
        `;

        try {
            const response = await fetch(`http://localhost:5000/api/profile/${currentUser.uid}`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('name-input').value = data.name || '';
                document.getElementById('age-input').value = data.age || '';
                document.getElementById('gender-select').value = data.gender || '';
            }
        } catch (error) {
            console.log("Could not fetch existing profile data. A new one can be created.");
        }

        document.getElementById('save-profile-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-profile-btn');
            const name = document.getElementById('name-input').value;
            const age = document.getElementById('age-input').value;
            const gender = document.getElementById('gender-select').value;
            
            if (!name || !age || !gender) {
                alert("Please fill out all fields.");
                return;
            }
            
            btn.textContent = "Saving...";
            btn.disabled = true;

            try {
                const response = await fetch(`http://localhost:5000/api/profile/${currentUser.uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, age, gender })
                });
                if (!response.ok) throw new Error("Server error");
                btn.textContent = "Profile Saved!";
            } catch (err) {
                alert("Could not save profile.");
            } finally {
                setTimeout(() => {
                    btn.textContent = "Save Profile";
                    btn.disabled = false;
                }, 2000);
            }
        });
        
        document.getElementById('logout-btn').addEventListener('click', () => {
            firebase.auth().signOut();
        });
    } else {
        profileContentArea.innerHTML = '<p style="text-align: center;">You are not logged in.</p>';
    }
});

window.addEventListener("load", () => {
    setTimeout(() => {
        splash.style.display = "none";
    }, 1500);
});